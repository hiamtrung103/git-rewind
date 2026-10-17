#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_BUFFER = 32 * 1024 * 1024;
export function exportHistory(repoPath, { limit = 120, name, onProgress = () => {} } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('--limit must be an integer from 1 to 500.');
  const cwd = resolve(repoPath);
  const git = (...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd, encoding: 'utf8', maxBuffer: MAX_BUFFER, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  try { git('rev-parse', '--is-inside-work-tree'); } catch { throw new Error('Choose a Git working tree with at least one commit.'); }
  let fields;
  try { fields = git('log', '--first-parent', `--max-count=${limit}`, '-z', '--format=%H%x00%P%x00%an%x00%aI%x00%s', 'HEAD', '--').split('\0'); }
  catch { throw new Error('The repository has no readable commits on HEAD.'); }
  const metadata = [];
  for (let i = 0; i + 4 < fields.length; i += 5) {
    const [sha, parents, author, date, subject] = fields.slice(i, i + 5);
    if (sha) metadata.push({ sha: sha.trim(), parents: parents.split(' ').filter(Boolean), author, date, subject });
  }
  let branch = 'detached HEAD';
  try { branch = git('symbolic-ref', '--short', 'HEAD').trim(); } catch { /* detached history is supported */ }
  const commits = metadata.reverse().map((commit, index) => {
    onProgress(index + 1, metadata.length);
    const tree = git('ls-tree', '-r', '-l', '-z', commit.sha).split('\0').filter(Boolean).map(entry => {
      const match = entry.match(/^(\d+) (\w+) ([a-f0-9]+)\s+(-|\d+)\t([\s\S]*)$/);
      if (!match) throw new Error('Could not parse Git tree.');
      return { path: match[5], size: match[4] === '-' ? 0 : Number(match[4]), kind: match[2] };
    });
    if (tree.length > 10000) throw new Error('A snapshot exceeds 10,000 files. Export a smaller repository.');
    const base = commit.parents[0];
    const diffArgs = base ? ['diff', base, commit.sha] : ['diff-tree', '--root', '--no-commit-id', '-r', commit.sha];
    const tokens = git(...diffArgs, '--name-status', '-z', '-M', '--').split('\0').filter(Boolean);
    const changes = [];
    for (let i = 0; i < tokens.length;) {
      const rawStatus = tokens[i++];
      const status = rawStatus[0];
      const oldPath = tokens[i++];
      const filePath = /[RC]/.test(status) ? tokens[i++] : oldPath;
      if (!filePath) throw new Error('Could not parse changed paths.');
      changes.push({ path: filePath, status, ...(/[RC]/.test(status) ? { oldPath } : {}) });
    }
    let additions = 0, deletions = 0;
    for (const record of git(...diffArgs, '--numstat', '--no-renames', '-z', '--').split('\0')) {
      const m = record.match(/^(\d+|-)\t(\d+|-)\t/);
      if (m) { additions += Number(m[1]) || 0; deletions += Number(m[2]) || 0; }
    }
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      if (i >= 60) { change.diff = ''; change.omitted = true; continue; }
      try {
        const patch = git(...diffArgs, '--no-ext-diff', '--no-textconv', '--no-color', '--unified=3', '-M', '--', ...new Set([change.oldPath, change.path].filter(Boolean)));
        change.diff = patch.slice(0, 45000);
        change.truncated = patch.length > 45000;
      } catch { change.diff = ''; change.omitted = true; }
    }
    return { ...commit, tree, changes, additions, deletions };
  });
  return { schemaVersion: 1, repo: name || basename(git('rev-parse', '--show-toplevel').trim()), branch,
    exportedAt: new Date().toISOString(), historyMode: 'first-parent', commits };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h') || !args.length) {
    console.log('Git Rewind — export a repository for playback\n\n  node bin/git-rewind.mjs <repo> [--out history.json] [--limit 120] [--name orbit]\n\nReads committed history on HEAD (first-parent); never changes the repository.\nThe JSON contains filenames, authors and patches. Review it before sharing.');
    return;
  }
  const repo = args.shift();
  const options = { limit: 120 };
  let out = 'history.json';
  while (args.length) {
    const flag = args.shift(), value = args.shift();
    if (!value || !['--out', '--limit', '--name'].includes(flag)) throw new Error(`Unknown or incomplete option: ${flag}`);
    if (flag === '--out') out = value;
    if (flag === '--name') options.name = value;
    if (flag === '--limit') options.limit = Number(value);
  }
  options.onProgress = (i, total) => process.stderr.write(`\rExporting commit ${i}/${total}…`);
  const history = exportHistory(repo, options);
  const target = resolve(out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(history));
  console.log(`\nExported ${history.commits.length} commits → ${target}\nOpen Git Rewind and choose Open repository → Import JSON.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(`\nGit Rewind: ${error.message}`); process.exitCode = 1; }
}
