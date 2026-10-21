// CEO-owned PR scope guard: prevent parallel workstream file collisions.
// Only role branches defined below are restricted; integration branches are CEO-reviewed separately.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROLE_PATHS = Object.freeze({
  'feat/team-gameplay-balance': [
    'src/engine.js', 'tests/engine.test.js', 'src/gameplay/', 'tests/gameplay/',
  ],
  'feat/team-visual-skins': [
    'src/render.js', 'src/styles.css', 'src/visual/', 'assets/', 'tests/visual/',
  ],
  'feat/team-economy-free': [
    'src/economy/', 'src/content/economy/', 'tests/economy/', 'docs/ECONOMY_IMPLEMENTATION.md',
  ],
  'feat/team-events-season': [
    'src/events/', 'src/content/events/', 'src/content/seasons/', 'tests/events/', 'docs/EVENTS_IMPLEMENTATION.md',
  ],
  'test/team-qa-regression': [
    'scripts/browser_qa.py', 'tests/qa/', 'docs/QA_TEAM_REPORT.md',
  ],
});

export function allowedRolePaths(branch) {
  // QA can submit new diagnostic PR branches without impersonating the exact
  // historical test/team-qa-regression ref. Treat test/qa-* as QA-owned too.
  // CEO integration branches intentionally remain separately reviewed.
  if (branch.startsWith('test/qa-')) return ROLE_PATHS['test/team-qa-regression'];
  return ROLE_PATHS[branch] ?? null;
}

export function outOfScopePaths(branch, files) {
  const allowed = allowedRolePaths(branch);
  if (!allowed) return [];
  return files.filter(path => !allowed.some(prefix => prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix));
}

function verifySha(sha, name) {
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error(`Invalid ${name} SHA`);
}

function main() {
  const branch = process.env.TEAM_BRANCH || '';
  if (!allowedRolePaths(branch)) {
    process.stdout.write(`No role scope restrictions for integration branch ${branch || '(unknown)'}\n`);
    return;
  }

  const base = process.env.TEAM_BASE;
  const head = process.env.TEAM_HEAD;
  verifySha(base, 'base');
  verifySha(head, 'head');
  const changed = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], { encoding: 'utf8' })
    .split(/\r?\n/).filter(Boolean);
  const violations = outOfScopePaths(branch, changed);
  if (violations.length) {
    console.error(`Out-of-scope files for ${branch}:\n- ${violations.join('\n- ')}\n`);
    console.error('Request CEO API wiring in your role Issue; do not modify another team/CEO-owned file.');
    process.exitCode = 1;
  } else {
    process.stdout.write(`PASS role scope ${branch}: ${changed.length} changed files in owned paths\n`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
