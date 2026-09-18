/**
 * The Never Contract — executable checks (brand: never-contract · honest-by-construction).
 *
 * Every CI-enforced clause on flicked.email/never maps 1:1 to a check below. This script IS
 * the deploy gate: flick-site's `npm run deploy` runs it before shipping, and CI runs it on
 * every push/PR. If any check fails, the build fails — the page can never out-promise the code.
 *
 * The clause register (scripts/never-clauses.json) is the SINGLE source of truth: this script
 * and the public page both read it, and N5 fails the build if the wiring drifts.
 *
 * Checks:
 *   N1  no streak mechanics          — grep src+lib (comments stripped) for streak/daily-goal/chain
 *   N2  no infinite-scroll primitive — grep src/app for FlatList onEndReached / InfiniteScroll
 *   N3  no re-engagement pushes      — grep src+server for re-engagement / win-back / come-back
 *   N4  terminus copy honesty        — lib/terminus.ts must not claim "we closed" (pending if absent)
 *   N5  single source of truth       — every 'ci' clause names a check that exists today; page reads the register
 *
 * Run (from repo root):   npx tsx prototypes/swipe-loop/scripts/never-checks.ts
 * Run (from swipe-loop):  npm run never:check          (alias: tsx ./scripts/never-checks.ts)
 * JSON (for the page/API): npx tsx prototypes/swipe-loop/scripts/never-checks.ts --json
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // prototypes/swipe-loop/scripts
const SWIPE = resolve(HERE, '..'); // prototypes/swipe-loop
const REPO = resolve(HERE, '..', '..', '..'); // repo root
const CLAUSES_PATH = join(HERE, 'never-clauses.json');
const JSON_MODE = process.argv.includes('--json');

type Hit = { file: string; line: number; text: string; pattern: string };
type Result = { id: string; clause: string; ok: boolean; detail: string; pending?: boolean };
const results: Result[] = [];

// ---- source helpers -------------------------------------------------------
function collectSource(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.expo') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectSource(p));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

// Strip comments while PRESERVING line numbers, so a comment that merely *names* an anti-pattern
// ("there is no streak") never trips a check aimed at real streak *mechanics* in code + strings.
// Heuristic (documented on the page as a way this could still lie): block comments and //-to-EOL
// comments preceded by start-of-line or whitespace are removed; the '//' in a URL scheme is kept.
function stripComments(src: string): string {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlock
    .split('\n')
    .map((ln) => ln.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n');
}

function grep(files: string[], patterns: { re: RegExp; label: string }[]): Hit[] {
  const hits: Hit[] = [];
  for (const file of files) {
    const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
    lines.forEach((line, i) => {
      for (const { re, label } of patterns) {
        if (re.test(line)) hits.push({ file: relative(REPO, file), line: i + 1, text: line.trim().slice(0, 120), pattern: label });
      }
    });
  }
  return hits;
}

function record(id: string, clause: string, hits: Hit[], scanned: string): void {
  const ok = hits.length === 0;
  const detail = ok
    ? `clean — scanned ${scanned}`
    : `${hits.length} violation(s): ` + hits.map((h) => `${h.file}:${h.line} [${h.pattern}] "${h.text}"`).join(' · ');
  results.push({ id, clause, ok, detail });
}

// ---- N1: no streak mechanics ---------------------------------------------
{
  const files = [...collectSource(join(SWIPE, 'src')), ...collectSource(join(SWIPE, 'lib'))];
  const hits = grep(files, [
    { re: /\bstreak/i, label: 'streak' },
    { re: /\bdaily.?goal/i, label: 'daily-goal' },
    { re: /don.?t break the chain/i, label: "don't-break-the-chain" },
  ]);
  record('N1', 'no-streak', hits, `${files.length} src+lib file(s)`);
}

// ---- N2: no infinite-scroll primitives -----------------------------------
{
  const files = collectSource(join(SWIPE, 'src', 'app'));
  const hits = grep(files, [
    { re: /FlatList[^\n]*onEndReached/i, label: 'FlatList-onEndReached' },
    { re: /\bInfiniteScroll\b/i, label: 'InfiniteScroll' },
  ]);
  record('N2', 'no-infinite-scroll', hits, `${files.length} src/app file(s)`);
}

// ---- N3: no re-engagement / win-back notifications ------------------------
{
  const files = [...collectSource(join(SWIPE, 'src')), ...collectSource(join(SWIPE, 'server'))];
  const hits = grep(files, [
    { re: /\bre.?engagement/i, label: 're-engagement' },
    { re: /win.?back.?push/i, label: 'win-back-push' },
    { re: /come.?back.?notification/i, label: 'come-back-notification' },
  ]);
  record('N3', 'no-reengagement', hits, `${files.length} src+server file(s)`);
}

// ---- N4: terminus copy honesty (pending until lib/terminus.ts ships) ------
{
  const terminusPath = join(SWIPE, 'lib', 'terminus.ts');
  if (!existsSync(terminusPath)) {
    results.push({ id: 'N4', clause: 'terminus-honesty', ok: true, pending: true, detail: 'lib/terminus.ts not present yet — check is staged, not enforced. Does not fail the build.' });
  } else {
    const src = stripComments(readFileSync(terminusPath, 'utf8')).toLowerCase();
    const banned = ['closed automatically', 'we closed'];
    const found = banned.filter((b) => src.includes(b));
    results.push({
      id: 'N4',
      clause: 'terminus-honesty',
      ok: found.length === 0,
      detail: found.length === 0 ? 'lib/terminus.ts present — copy makes no "we closed" claim' : `lib/terminus.ts contains dishonest close-copy: ${found.map((f) => `"${f}"`).join(', ')}`,
    });
  }
}

// ---- N5: single source of truth ------------------------------------------
{
  const problems: string[] = [];
  let register: { clauses?: { id: number; slug: string; tier: string; check: string | null }[] } = {};
  try {
    register = JSON.parse(readFileSync(CLAUSES_PATH, 'utf8'));
  } catch (e) {
    problems.push(`never-clauses.json does not parse: ${(e as Error).message}`);
  }
  const clauses = register.clauses ?? [];
  if (!clauses.length) problems.push('never-clauses.json has no clauses');

  // Checks THIS script implements, and external checks with a present-today proof.
  const IMPLEMENTED = new Set(['never-checks N1', 'never-checks N2', 'never-checks N3', 'never-checks N4']);
  const ciYmlPath = join(REPO, '.github', 'workflows', 'ci.yml');
  const EXTERNAL: Record<string, () => boolean> = {
    'entitlements:smoke': () => existsSync(join(HERE, 'entitlements-copy-smoke.ts')),
    'og:smoke': () => existsSync(join(HERE, 'og-receipt-smoke.ts')),
    'ci.yml dist grep': () => existsSync(ciYmlPath) && readFileSync(ciYmlPath, 'utf8').includes('react-native-purchases'),
  };

  // Map "never-checks Nx" -> the result id, so a 'ci' clause can never carry a badge while its
  // own check is only staged (pending). If it is, the build fails here — the badge can never
  // outlive its enforcement.
  const idOfNeverCheck = (check: string) => (check.startsWith('never-checks ') ? check.slice('never-checks '.length) : null);

  for (const c of clauses) {
    if (c.tier === 'ci') {
      if (!c.check) {
        problems.push(`clause ${c.id} (${c.slug}) is tier 'ci' but names no check`);
      } else if (IMPLEMENTED.has(c.check)) {
        const rid = idOfNeverCheck(c.check);
        const r = results.find((x) => x.id === rid);
        if (!r) problems.push(`clause ${c.id} (${c.slug}) names ${c.check} but that check did not run`);
        else if (r.pending) problems.push(`clause ${c.id} (${c.slug}) is tier 'ci' but ${c.check} is only STAGED (pending) — not enforced today; downgrade it to 'policy' or make the check active`);
      } else if (EXTERNAL[c.check]) {
        if (!EXTERNAL[c.check]()) problems.push(`clause ${c.id} (${c.slug}) names check "${c.check}" which is NOT present today`);
      } else {
        problems.push(`clause ${c.id} (${c.slug}) names unknown check "${c.check}"`);
      }
    }
  }

  // The public page must read THIS register — proves the page and script share one source.
  // flick-site is a SEPARATE (gitignored) repo, so it is absent from the app-repo CI
  // checkout: only enforce the page↔register link when the site tree is actually present
  // (the deploy gate runs from flick-site cwd, where it always is). In the app-only CI
  // checkout, N5 still fully enforces every 'ci' clause↔check binding above.
  const siteRoot = join(REPO, 'flick-site');
  if (existsSync(siteRoot)) {
    const pagePath = join(siteRoot, 'pages', 'never.page.mjs');
    if (!existsSync(pagePath)) problems.push('flick-site/pages/never.page.mjs missing (page cannot render the register)');
    else if (!readFileSync(pagePath, 'utf8').includes('never-clauses.json')) problems.push('never.page.mjs does not read never-clauses.json — single source of truth broken');
  }

  results.push({
    id: 'N5',
    clause: 'single-source-of-truth',
    ok: problems.length === 0,
    detail: problems.length === 0 ? `${clauses.length} clauses, every 'ci' clause backed by a present check, page reads the register` : problems.join(' · '),
  });
}

// ---- emit -----------------------------------------------------------------
const failed = results.filter((r) => !r.ok);

if (JSON_MODE) {
  let git_sha = 'unknown';
  try {
    git_sha = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim();
  } catch {
    /* not in a git checkout — fine */
  }
  process.stdout.write(
    JSON.stringify(
      {
        ran_at: new Date().toISOString(),
        git_sha,
        ok: failed.length === 0,
        checks: results.map(({ id, clause, ok, detail, pending }) => ({ id, clause, ok, detail, ...(pending ? { pending } : {}) })),
      },
      null,
      2,
    ) + '\n',
  );
} else {
  console.log('The Never Contract — executable checks\n');
  for (const r of results) {
    const badge = r.pending ? 'PEND' : r.ok ? 'PASS' : 'FAIL';
    console.log(`  [${badge}] ${r.id} ${r.clause}\n         ${r.detail}`);
  }
  console.log('');
  if (failed.length) console.log(`NEVER-CHECKS FAILED — ${failed.length} clause(s) the code no longer honors:\n` + failed.map((f) => `  - ${f.id} ${f.clause}: ${f.detail}`).join('\n'));
  else console.log(`never-checks: all ${results.length} clauses honored.`);
}

process.exit(failed.length ? 1 : 0);
