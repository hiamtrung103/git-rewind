export function validateHistory(data) {
  const str = (value, max = 2000) => typeof value === 'string' && value.length <= max;
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  if (!data || data.schemaVersion !== 1 || !str(data.repo, 200) || !str(data.branch, 200) || !Array.isArray(data.commits) || !data.commits.length || data.commits.length > 500) throw new Error('This is not a Git Rewind history file (schema v1, 1–500 commits).');
  for (const c of data.commits) {
    if (!/^[a-f0-9]{40,64}$/.test(c.sha) || !str(c.subject) || !str(c.author, 500) || !str(c.date, 100) || !Number.isFinite(Date.parse(c.date)) || !integer(c.additions) || !integer(c.deletions) || !Array.isArray(c.tree) || !Array.isArray(c.changes) || c.tree.length > 10000 || c.changes.length > 10000) throw new Error('A commit has invalid or unsupported data.');
    const paths = new Set();
    for (const f of c.tree) {
      if (!str(f.path, 4000) || !f.path || !integer(f.size) || paths.has(f.path)) throw new Error('A file snapshot is invalid.');
      paths.add(f.path);
    }
    for (const f of c.changes) {
      if (!str(f.path, 4000) || !f.path || !['A','M','D','R','C','T','U','X','B'].includes(f.status) || !str(f.diff, 45000) || (f.oldPath !== undefined && !str(f.oldPath, 4000))) throw new Error('A file change is invalid.');
    }
  }
  return data;
}
export function changeTotals(commit) {
  return commit.changes.reduce((totals, change) => {
    if (change.status === 'A') totals.added++;
    else if (change.status === 'D') totals.deleted++;
    else totals.modified++;
    return totals;
  }, { added: 0, modified: 0, deleted: 0 });
}
export function fileTree(files) {
  const root = { name: '', path: '', children: new Map() };
  for (const file of files) {
    const parts = file.path.split('/');
    let node = root;
    parts.forEach((name, i) => {
      const path = parts.slice(0, i + 1).join('/');
      if (!node.children.has(name)) node.children.set(name, { name, path, children: new Map(), file: null });
      node = node.children.get(name);
      if (i === parts.length - 1) node.file = file;
    });
  }
  return root;
}
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
