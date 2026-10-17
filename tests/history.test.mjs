import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, renameSync, unlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { exportHistory } from '../bin/git-rewind.mjs';
import { validateHistory, fileTree, changeTotals } from '../model.js';

test('real Git history preserves snapshots, Unicode paths, renames, deletions and binary patches', () => {
  const repo = mkdtempSync(join(tmpdir(),'git-rewind-test-'));
  const git = (...args) => execFileSync('git',args,{cwd:repo,encoding:'utf8',windowsHide:true,stdio:'pipe'});
  const commit = message => { git('add','-A'); git('commit','-m',message); };
  try {
    git('init','-b','main'); git('config','user.name','Test Author'); git('config','user.email','test@example.com'); git('config','commit.gpgsign','false'); git('config','core.autocrlf','false');
    writeFileSync(join(repo,'hello.ts'),'export const hello = "world";\n');
    writeFileSync(join(repo,'tiếng Việt.txt'),'Xin chào\n');
    commit('feat: the first commit');
    writeFileSync(join(repo,'hello.ts'),'export const hello = "universe";\n');
    commit('fix: a wider world');
    renameSync(join(repo,'hello.ts'),join(repo,'renamed.ts'));
    commit('refactor: rename a file');
    unlinkSync(join(repo,'tiếng Việt.txt'));
    writeFileSync(join(repo,'binary.bin'),Buffer.from([0,1,2,3,0,255]));
    commit('chore: binary addition and text deletion');
    const result = exportHistory(repo);
    assert.equal(validateHistory(result),result);
    assert.equal(result.commits.length,4);
    const [first,second,third,fourth] = result.commits;
    assert.equal(first.subject,'feat: the first commit');
    assert.equal(first.tree.length,2);
    assert(first.changes.every(c => c.status === 'A'));
    assert(first.changes[0].diff.includes('diff --git'));
    assert.equal(first.additions,2);
    assert(second.changes[0].diff.includes('+export const hello = "universe";'));
    assert.equal(second.deletions,1);
    assert.equal(third.changes[0].status,'R');
    assert.equal(third.changes[0].oldPath,'hello.ts');
    assert.equal(third.changes[0].path,'renamed.ts');
    assert.equal(fourth.changes.find(c => c.status === 'D').path,'tiếng Việt.txt');
    assert(fourth.changes.find(c => c.path === 'binary.bin').diff.includes('Binary files'));
    assert.equal(fourth.tree.some(f => f.path === 'tiếng Việt.txt'),false);
    assert.equal(exportHistory(repo,{limit:2}).commits.length,2);
    assert.throws(() => exportHistory(repo,{limit:0}),/--limit/);
    assert.throws(() => validateHistory({...result,commits:[]}),/history file/);
    const invalid = structuredClone(result); invalid.commits[0].changes[0].status='<script>';
    assert.throws(() => validateHistory(invalid),/file change/);
    const duplicate = structuredClone(result); duplicate.commits[0].tree.push(duplicate.commits[0].tree[0]);
    assert.throws(() => validateHistory(duplicate),/snapshot/);
    assert.deepEqual(changeTotals(fourth),{added:1,modified:0,deleted:1});

    git('checkout','-b','feature');
    writeFileSync(join(repo,'feature.txt'),'feature\n'); commit('feat: branch work');
    git('checkout','main');
    writeFileSync(join(repo,'main.txt'),'main\n'); commit('feat: main work');
    git('merge','feature','--no-ff','-m','merge: feature');
    const merged = exportHistory(repo);
    assert.equal(merged.commits.length,6);
    assert.equal(merged.commits.at(-1).parents.length,2);
    assert.equal(merged.commits.at(-1).changes[0].path,'feature.txt');
    assert(merged.commits.at(-1).tree.some(f=>f.path==='feature.txt'));
    assert(!merged.commits.some(c=>c.subject==='feat: branch work'));
  } finally {
    if(dirname(repo) === resolve(tmpdir()) && basename(repo).startsWith('git-rewind-test-')) rmSync(repo,{recursive:true,force:true});
  }
});

test('tree construction keeps folders distinct from similarly named files', () => {
  const tree=fileTree([{path:'src/app.js',size:3},{path:'src-old.js',size:4},{path:'src/lib/index.js',size:5}]);
  assert.equal(tree.children.size,2);
  assert.equal(tree.children.get('src').children.get('lib').children.get('index.js').file.size,5);
});
