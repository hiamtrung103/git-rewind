import { validateHistory, fileTree, changeTotals, formatBytes } from './model.js';

const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = (value, options = {}) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...options });
const state = { data: null, index: 0, playing: false, timer: null, speed: 1, loop: false, view: 'files', selected: null, search: '', changedOnly: false, collapsed: new Set(), demo: true };
const labels = { A: 'Added', M: 'Modified', D: 'Deleted', R: 'Renamed', C: 'Copied', T: 'Type changed', U: 'Unmerged', X: 'Changed', B: 'Changed' };
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2700); }
async function copy(text, message = 'Copied to clipboard') {
  try { await navigator.clipboard.writeText(text); toast(message); } catch { toast('Clipboard unavailable. Select and copy the text manually.'); }
}
function current() { return state.data.commits[state.index]; }
function icon(path) {
  const ext = path.split('.').pop().toLowerCase();
  const label = { ts: 'TS', tsx: 'TSX', js: 'JS', mjs: 'JS', jsx: 'JSX', css: '#', json: '{}', md: 'M↓', html: '⌘', svg: '◇', yml: '≡', yaml: '≡', py: 'PY', go: 'GO', rs: 'RS' }[ext] || '▫';
  return `<span class="file-icon ${['ts','tsx','css','json','md'].includes(ext) ? ext : ''}" aria-hidden="true">${label}</span>`;
}
function openDialog(id) { pause(); if (!$('open-dialog').open && !$('help-dialog').open) $(id).showModal(); }
function setView(view, moveFocus = false) {
  state.view = view;
  for (const mode of ['files', 'diff']) {
    $(`${mode}-view`).hidden = mode !== view;
    $(`${mode}-tab`).classList.toggle('active', mode === view);
    $(`${mode}-tab`).setAttribute('aria-selected', String(mode === view));
    $(`${mode}-tab`).tabIndex = mode === view ? 0 : -1;
  }
  if (view === 'diff') renderDiff();
  if (moveFocus) $(`${view}-tab`).focus();
}
function showFile(path) { state.selected = path; setView('diff'); renderTree(); }
function renderTree() {
  const commit = current();
  const changes = new Map(commit.changes.map(f => [f.path, f]));
  const files = [...commit.tree, ...commit.changes.filter(f => f.status === 'D').map(f => ({ path: f.path, size: 0 }))].filter(f => f.path.toLowerCase().includes(state.search));
  const root = fileTree(files);
  function rows(node, depth = 0) {
    return [...node.children.values()].sort((a,b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name)).map(n => {
      if (!n.file) {
        const collapsed = !state.search && state.collapsed.has(n.path);
        return `<button class="tree-row folder-row" data-folder="${esc(n.path)}" aria-expanded="${!collapsed}" style="padding-left:${depth * 13 + 8}px"><span class="tree-chevron">${collapsed ? '›' : '⌄'}</span><span class="folder-icon" aria-hidden="true">▱</span><span class="name">${esc(n.name)}</span></button>${collapsed ? '' : rows(n, depth + 1)}`;
      }
      const change = changes.get(n.path);
      return `<button class="tree-row ${state.selected === n.path ? 'selected' : ''}" data-file="${esc(n.path)}" title="${esc(n.path)}" style="padding-left:${depth * 13 + 22}px">${icon(n.path)}<span class="name">${esc(n.name)}</span>${change ? `<span class="tree-status status-${change.status}">${change.status}</span>` : ''}</button>`;
    }).join('');
  }
  $('file-tree').innerHTML = rows(root) || '<div class="empty-state">No files found.</div>';
}
function renderLandscape() {
  const commit = current(), changes = new Map(commit.changes.map(f => [f.path, f]));
  const files = [...commit.tree, ...commit.changes.filter(f => f.status === 'D').map(f => ({ path: f.path, size: 0 }))]
    .filter(f => f.path.toLowerCase().includes(state.search) && (!state.changedOnly || changes.has(f.path)))
    .sort((a,b) => Number(changes.has(b.path)) - Number(changes.has(a.path)) || a.path.localeCompare(b.path));
  $('landscape').innerHTML = files.slice(0, 300).map(f => {
    const change = changes.get(f.path), parts = f.path.split('/'), name = parts.pop();
    return `<button class="file-card" data-file="${esc(f.path)}" data-status="${change?.status || ''}" title="${esc(f.path)} · ${formatBytes(f.size)}"><span class="card-top">${icon(f.path)}<span class="card-status">${change ? labels[change.status].toUpperCase() : formatBytes(f.size)}</span></span><span class="card-name">${esc(name)}</span><span class="card-path">${esc(parts.join('/') || '/ root')}</span></button>`;
  }).join('');
  $('landscape-empty').hidden = files.length > 0;
  if (files.length > 300) $('landscape').insertAdjacentHTML('beforeend', '<p class="muted">Showing 300 files. Use search to narrow the view.</p>');
}
function renderDiff() {
  const commit = current();
  const change = commit.changes.find(f => f.path === state.selected);
  const exists = commit.tree.some(f => f.path === state.selected);
  $('diff-filename').textContent = state.selected || 'Select a changed file';
  $('copy-diff').disabled = !change?.diff;
  $('diff-meta').textContent = change ? `${labels[change.status]}${change.oldPath ? ` from ${change.oldPath}` : ''} · ${commit.sha.slice(0,7)}${change.truncated ? ' · Patch truncated at 45,000 characters' : ''}${change.omitted ? ' · Patch omitted by export limit' : ''}` : exists ? 'Unchanged in this commit' : 'No change selected';
  if (!change?.diff) {
    $('diff-code').innerHTML = `<span class="diff-empty">${esc(change?.omitted ? 'This patch was omitted from the export. The exporter includes patches for up to 60 changed files per commit.' : exists ? 'This file has no patch in the selected commit. Choose a changed file in the spotlight to see its diff.' : state.selected ? 'This file is not part of the selected snapshot. Choose another file to explore this moment.' : 'Choose a file in the explorer or commit spotlight to inspect its patch.')}</span>`;
    return;
  }
  $('diff-code').innerHTML = change.diff.split('\n').map((line, i) => {
    const type = line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ') ? 'header' : line.startsWith('+') ? 'add' : line.startsWith('-') ? 'remove' : line.startsWith('@@') ? 'hunk' : '';
    return `<span class="diff-line ${type}"><span class="line-no" aria-hidden="true">${i+1}</span>${esc(line) || ' '}</span>`;
  }).join('');
}
function renderCommit() {
  const c = current();
  $('file-count').textContent = c.tree.length;
  $('stat-files').textContent = c.tree.length.toLocaleString();
  $('stat-size').textContent = formatBytes(c.tree.reduce((sum,f) => sum + f.size, 0));
  $('stat-people').textContent = new Set(state.data.commits.slice(0, state.index + 1).map(c => c.author)).size;
  $('snapshot-sha').textContent = c.sha.slice(0,7);
  $('snapshot-title').textContent = state.index === 0 ? 'Every story starts somewhere.' : state.index === state.data.commits.length - 1 ? 'Look how far you’ve come.' : 'The shape of things.';
  const totals = changeTotals(c);
  $('snapshot-description').textContent = `${c.tree.length} tracked files. ${totals.added ? `${totals.added} new, ` : ''}${totals.modified} modified${totals.deleted ? `, ${totals.deleted} deleted` : ''} in this commit. A small step in a bigger story.`;
  $('commit-position').textContent = `COMMIT ${String(state.index + 1).padStart(2,'0')}`;
  $('commit-type').textContent = c.subject.match(/^(\w+)(?:\([^)]*\))?:/)?.[1] || 'commit';
  $('commit-title').textContent = c.subject;
  $('commit-title').title = c.subject;
  $('commit-author').textContent = c.author;
  $('author-avatar').textContent = c.author.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0,2).join('').toUpperCase();
  $('commit-date').textContent = date(c.date, { year:'numeric' });
  $('commit-sha').textContent = c.sha.slice(0,7);
  $('changed-count').textContent = `${c.changes.length} ${c.changes.length === 1 ? 'file' : 'files'} changed`;
  $('additions').textContent = `+${c.additions.toLocaleString()}`;
  $('deletions').textContent = `−${c.deletions.toLocaleString()}`;
  const total = c.additions + c.deletions;
  const plus = total ? Math.round(c.additions / total * 22) : 0;
  $('change-bar').innerHTML = Array.from({length:22}, (_,i) => `<i class="${total ? i < plus ? 'plus' : 'minus' : ''}"></i>`).join('');
  $('diff-count').textContent = c.changes.length;
  $('change-list-count').textContent = c.changes.length;
  $('changed-files').innerHTML = c.changes.map(f => `<button class="changed-file" data-file="${esc(f.path)}" title="${esc(f.path)}">${icon(f.path)}<span class="name">${esc(f.path.split('/').pop())}</span><span class="change-status status-${f.status}">${f.status}</span></button>`).join('') || '<p class="muted">No file changes in this commit.</p>';
  $('commit-note').textContent = state.index === 0 ? 'One commit. Infinite possibilities.' : state.index === state.data.commits.length - 1 ? 'The story keeps going.' : 'Small steps. A bigger story.';
  $('playback-position').innerHTML = `${String(state.index + 1).padStart(2,'0')} <span>/ ${String(state.data.commits.length).padStart(2,'0')} commits</span>`;
  $('playback-date').textContent = date(c.date);
  $('scrubber').value = state.index;
  $('first-button').disabled = $('previous-button').disabled = state.index === 0;
  $('last-button').disabled = $('next-button').disabled = state.index === state.data.commits.length - 1;
  document.querySelectorAll('.timeline-commit').forEach((el, i) => {
    el.classList.toggle('current', i === state.index);
    el.classList.toggle('future', i > state.index);
    el.setAttribute('aria-current', i === state.index ? 'step' : 'false');
  });
  renderTree(); renderLandscape(); if (state.view === 'diff') renderDiff();
}
function selectCommit(index, userInitiated = false) {
  if (!state.data) return;
  if (userInitiated) pause();
  state.index = Math.max(0, Math.min(state.data.commits.length - 1, index));
  if (state.view === 'diff' && !current().changes.some(f => f.path === state.selected)) state.selected = current().changes[0]?.path || null;
  renderCommit();
}
function loadHistory(data, demo = false) {
  validateHistory(data); pause(); state.data = data; state.demo = demo; state.selected = null; state.search = ''; state.collapsed.clear(); state.changedOnly = false;
  $('file-search').value = ''; $('changed-only').checked = false;
  $('repo-name').textContent = $('root-name').textContent = data.repo;
  $('repo-name').title = data.repo;
  $('branch-name').textContent = data.branch;
  $('demo-badge').hidden = !demo;
  const contributors = new Set(data.commits.map(c => c.author)).size;
  $('repo-summary').textContent = `${data.commits.length} commits · ${contributors} ${contributors === 1 ? 'contributor' : 'contributors'}`;
  const first = data.commits[0], last = data.commits.at(-1);
  $('timeline-range').textContent = `${date(first.date)} — ${date(last.date, { year:'numeric' })}`;
  $('first-date').textContent = date(first.date);
  $('last-date').textContent = date(last.date);
  $('scrubber').max = data.commits.length - 1;
  const max = Math.max(1,...data.commits.map(c => Math.log2(c.additions + c.deletions + 2)));
  $('timeline-bars').innerHTML = data.commits.map((c,i) => `<button class="timeline-commit" data-commit="${i}" aria-label="Commit ${i+1}: ${esc(c.subject)}" title="${esc(c.subject)} · ${date(c.date)}"><span class="timeline-tooltip">${c.sha.slice(0,7)} · ${date(c.date)}</span><span class="bar" style="height:${Math.max(7,Math.round(Math.log2(c.additions+c.deletions+2)/max*49))}px"></span><span class="timeline-node"></span></button>`).join('');
  $('timeline-bars').style.minWidth = data.commits.length > 80 ? `${data.commits.length * 12}px` : '';
  document.querySelector('.timeline-track').style.overflowX = data.commits.length > 80 ? 'auto' : '';
  state.index = demo ? Math.min(10, data.commits.length - 1) : 0;
  setView('files'); renderCommit();
}
function pause() {
  clearTimeout(state.timer); state.playing = false;
  $('play-button').setAttribute('aria-label', 'Play history');
  $('play-icon').innerHTML = '<path d="m7 4 10 6-10 6V4Z" fill="currentColor"/>';
}
function tick() {
  state.timer = setTimeout(() => {
    if (!state.playing) return;
    if (state.index >= state.data.commits.length - 1) { if (state.loop) selectCommit(0); else { pause(); return; } }
    else selectCommit(state.index + 1);
    tick();
  }, 1600 / state.speed);
}
function play() {
  if (!state.data) return;
  if (state.playing) { pause(); return; }
  if (state.index === state.data.commits.length - 1) selectCommit(0);
  state.playing = true;
  $('play-button').setAttribute('aria-label', 'Pause history');
  $('play-icon').innerHTML = '<path d="M5 4h3v12H5zm7 0h3v12h-3z" fill="currentColor"/>';
  tick();
}

for (const id of ['open-button','how-button']) $(id).addEventListener('click', () => openDialog('open-dialog'));
for (const id of ['help-button','shortcuts-button','about-button']) $(id).addEventListener('click', () => openDialog('help-dialog'));
for (const id of ['open-dialog','help-dialog']) $(id).addEventListener('click', event => { if (event.target === $(id)) { const r = $(id).getBoundingClientRect(); if(event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $(id).close(); } });
$('files-tab').addEventListener('click', () => setView('files'));
$('diff-tab').addEventListener('click', () => { if(!state.data) return; state.selected ||= current().changes[0]?.path; setView('diff'); });
for (const id of ['files-tab','diff-tab']) $(id).addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); if (!state.selected && state.data) state.selected = current().changes[0]?.path; setView(id === 'files-tab' ? 'diff' : 'files', true); } });
for (const id of ['file-tree','landscape','changed-files']) $(id).addEventListener('click', event => {
  const file = event.target.closest('[data-file]'), folder = event.target.closest('[data-folder]');
  if (file) showFile(file.dataset.file);
  if (folder) { const p = folder.dataset.folder; state.collapsed.has(p) ? state.collapsed.delete(p) : state.collapsed.add(p); renderTree(); }
});
$('file-search').addEventListener('input', e => { state.search = e.target.value.toLowerCase(); if(state.data){ renderTree(); renderLandscape(); } });
$('changed-only').addEventListener('change', e => { state.changedOnly = e.target.checked; if(state.data) renderLandscape(); });
$('copy-sha').addEventListener('click', () => { if(state.data) copy(current().sha, 'Full commit hash copied'); });
$('copy-diff').addEventListener('click', () => { const change = current().changes.find(f => f.path === state.selected); if(change?.diff) copy(change.diff, 'Patch copied'); });
$('copy-command').addEventListener('click', () => copy('node bin/git-rewind.mjs /path/to/repo --out history.json', 'Export command copied'));
$('timeline-bars').addEventListener('click', e => { const node = e.target.closest('[data-commit]'); if(node) selectCommit(Number(node.dataset.commit), true); });
$('scrubber').addEventListener('input', e => selectCommit(Number(e.target.value), true));
$('play-button').addEventListener('click', play);
$('first-button').addEventListener('click', () => selectCommit(0, true));
$('last-button').addEventListener('click', () => { if(state.data) selectCommit(state.data.commits.length - 1, true); });
$('previous-button').addEventListener('click', () => selectCommit(state.index - 1, true));
$('next-button').addEventListener('click', () => selectCommit(state.index + 1, true));
$('speed').addEventListener('change', e => { state.speed = Number(e.target.value); if(state.playing){ clearTimeout(state.timer); tick(); } });
$('loop-button').addEventListener('click', () => { state.loop = !state.loop; $('loop-button').setAttribute('aria-pressed', String(state.loop)); toast(state.loop ? 'Loop playback on' : 'Loop playback off'); });
$('download-button').addEventListener('click', () => {
  if(!state.data) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(state.data)], {type:'application/json'}));
  const link = document.createElement('a'); link.href=url; link.download=`${state.data.repo.replace(/[^a-zA-Z0-9_-]/g,'-')}-history.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('History exported');
});
async function loadDemo() {
  const response = await fetch('./data/demo.json');
  if (!response.ok) throw new Error('The sample history could not be loaded. Run npm run demo to rebuild it.');
  loadHistory(await response.json(), true);
}
$('demo-button').addEventListener('click', async () => { try { await loadDemo(); $('open-dialog').close(); toast('Demo repository loaded'); } catch(e) { $('import-error').textContent=e.message; $('import-error').hidden=false; } });
$('history-file').addEventListener('change', async e => {
  const file = e.target.files[0]; if(!file) return;
  try {
    if(file.size > 40 * 1024 * 1024) throw new Error('Choose a JSON file smaller than 40 MB. Export fewer commits with --limit.');
    const data = JSON.parse(await file.text()); loadHistory(data);
    $('import-error').hidden=true; $('open-dialog').close(); toast(`Loaded ${data.commits.length} commits. Your file stays in this browser.`);
  } catch(error) { $('import-error').textContent = error instanceof SyntaxError ? 'This file is not valid JSON. Choose the file produced by the Git Rewind exporter.' : error.message; $('import-error').hidden=false; }
  finally { e.target.value=''; }
});
document.addEventListener('keydown', e => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || $('open-dialog').open || $('help-dialog').open || ['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName)) return;
  if(e.key === '?'){e.preventDefault();openDialog('help-dialog');return;}
  if(!state.data) return;
  if(e.code === 'Space'){e.preventDefault();play();}
  if(e.key === 'ArrowLeft'){e.preventDefault();selectCommit(state.index-1,true);}
  if(e.key === 'ArrowRight'){e.preventDefault();selectCommit(state.index+1,true);}
  if(e.key === 'Home'){e.preventDefault();selectCommit(0,true);}
  if(e.key === 'End'){e.preventDefault();selectCommit(state.data.commits.length-1,true);}
  if(e.key === '/'){e.preventDefault();$('file-search').focus();}
});
document.addEventListener('visibilitychange', () => { if(document.hidden) pause(); });
loadDemo().catch(error => { $('repo-summary').textContent='History unavailable'; $('commit-title').textContent='Let’s open your first repo.'; $('snapshot-title').textContent='Your history goes here.'; toast(error.message); });
