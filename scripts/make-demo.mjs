import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { exportHistory } from '../bin/git-rewind.mjs';

// Fictional project, real commits and patches. Rebuild deterministically with npm run demo.
const root = mkdtempSync(join(tmpdir(), 'git-rewind-demo-'));
let step = 0;
const authors = ['Ada Lin', 'Leo Park', 'Mia Chen'];
const git = (...args) => execFileSync('git', args, { cwd:root, encoding:'utf8', windowsHide:true, stdio:['ignore','pipe','pipe'] });
function put(path, content) { const target=join(root,path); mkdirSync(dirname(target), {recursive:true}); writeFileSync(target, content); }
function append(path, content) { put(path, readFileSync(join(root,path),'utf8') + content); }
function commit(subject, authorIndex = 0) {
  step++;
  git('add','-A');
  const author = authors[authorIndex], stamp = `2026-09-${String(step+1).padStart(2,'0')}T${String(9+step%8).padStart(2,'0')}:30:00+07:00`;
  execFileSync('git',['commit','-m',subject],{cwd:root,windowsHide:true,stdio:'pipe',env:{...process.env,GIT_AUTHOR_NAME:author,GIT_AUTHOR_EMAIL:`${author.toLowerCase().replace(' ','.')}@example.com`,GIT_COMMITTER_NAME:author,GIT_COMMITTER_EMAIL:`${author.toLowerCase().replace(' ','.')}@example.com`,GIT_AUTHOR_DATE:stamp,GIT_COMMITTER_DATE:stamp}});
}
try {
  git('init','-b','main');
  git('config','core.autocrlf','false');
  git('config','commit.gpgsign','false');
  put('README.md','# Orbit\n\nA quieter place to plan your next big thing.\n\nA fictional project for the Git Rewind demo.\n');
  put('.gitignore','node_modules/\ndist/\n.env\n');
  put('package.json',JSON.stringify({name:'orbit',version:'0.1.0',private:true,type:'module',scripts:{dev:'vite',build:'vite build'},dependencies:{react:'^19.0.0','react-dom':'^19.0.0'},devDependencies:{typescript:'^5.7.0',vite:'^6.0.0'}},null,2)+'\n');
  commit('chore: a little space for big ideas');
  put('index.html','<!doctype html>\n<html><head><title>Orbit</title></head>\n<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n');
  put('src/main.tsx',"import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport './styles.css';\n\ncreateRoot(document.getElementById('root')!).render(<h1>Welcome to Orbit</h1>);\n");
  put('src/styles.css',':root {\n  color-scheme: dark;\n  font-family: system-ui, sans-serif;\n  background: #151b14;\n  color: #edf2e7;\n}\n\nbody { margin: 0; }\nbutton { cursor: pointer; }\n');
  put('tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2022',module:'ESNext',jsx:'react-jsx',strict:true,moduleResolution:'bundler'},include:['src']},null,2)+'\n');
  put('vite.config.ts',"import { defineConfig } from 'vite';\nexport default defineConfig({ server: { port: 3000 } });\n");
  commit('chore: give the app a home');
  put('src/components/Sidebar.tsx',"const links = ['Overview', 'Projects', 'Activity', 'Settings'];\n\nexport function Sidebar() {\n  return (\n    <aside className=\"sidebar\">\n      <a className=\"logo\" href=\"/\">Orbit</a>\n      <nav aria-label=\"Main navigation\">\n        {links.map(link => <a key={link} href={`#${link.toLowerCase()}`}>{link}</a>)}\n      </nav>\n    </aside>\n  );\n}\n");
  put('src/components/App.tsx',"import { Sidebar } from './Sidebar';\n\nexport function App() {\n  return <div className=\"app\"><Sidebar /><main><h1>Your workspace</h1></main></div>;\n}\n");
  put('src/main.tsx',"import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport { App } from './components/App';\nimport './styles.css';\n\ncreateRoot(document.getElementById('root')!).render(<App />);\n");
  append('src/styles.css','\n.app { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }\n.sidebar { padding: 28px; border-right: 1px solid #34412c; }\n.sidebar nav { display: flex; flex-direction: column; gap: 20px; margin-top: 48px; }\nmain { padding: 48px; }\n');
  commit('feat: build the workspace shell',1);
  put('src/lib/types.ts',"export type Project = {\n  id: string;\n  name: string;\n  description: string;\n  progress: number;\n  color: string;\n};\n");
  put('src/lib/projects.ts',"import type { Project } from './types';\n\nexport const projects: Project[] = [\n  { id: 'luna', name: 'Luna', description: 'A fresh start', progress: 32, color: '#c4f46e' },\n  { id: 'nova', name: 'Nova', description: 'Explore what is next', progress: 68, color: '#bfa5e0' },\n  { id: 'terra', name: 'Terra', description: 'Build something that lasts', progress: 15, color: '#e3bf82' },\n];\n");
  commit('feat: plant the first project seeds');
  put('src/components/ProjectCard.tsx',"import type { Project } from '../lib/types';\n\nexport function ProjectCard({ project }: { project: Project }) {\n  return (\n    <article className=\"project-card\">\n      <span className=\"project-color\" style={{ background: project.color }} />\n      <h2>{project.name}</h2>\n      <p>{project.description}</p>\n      <progress max={100} value={project.progress} />\n      <span>{project.progress}% complete</span>\n    </article>\n  );\n}\n");
  put('src/components/App.tsx',"import { Sidebar } from './Sidebar';\nimport { ProjectCard } from './ProjectCard';\nimport { projects } from '../lib/projects';\n\nexport function App() {\n  return (\n    <div className=\"app\">\n      <Sidebar />\n      <main>\n        <h1>Your workspace</h1>\n        <p>A little progress, every day.</p>\n        <section className=\"project-grid\" aria-label=\"Projects\">\n          {projects.map(project => <ProjectCard key={project.id} project={project} />)}\n        </section>\n      </main>\n    </div>\n  );\n}\n");
  append('src/styles.css','\n.project-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }\n.project-card { background: #20291d; border: 1px solid #39472e; border-radius: 14px; padding: 24px; }\n.project-color { display: block; width: 28px; height: 28px; border-radius: 8px; }\nprogress { width: 100%; accent-color: #c4f46e; }\n');
  commit('feat: bring projects into the picture',2);
  put('src/hooks/useLocalStorage.ts',"import { useState, useEffect } from 'react';\n\nexport function useLocalStorage<T>(key: string, initial: T) {\n  const [value, setValue] = useState<T>(() => {\n    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? initial; }\n    catch { return initial; }\n  });\n  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value]);\n  return [value, setValue] as const;\n}\n");
  commit('feat: remember the little things');
  put('src/components/EmptyState.tsx',"export function EmptyState({ onCreate }: { onCreate: () => void }) {\n  return <div className=\"empty-state\">\n    <span aria-hidden=\"true\">✦</span>\n    <h2>Room for your next idea.</h2>\n    <p>Start a project and see where it takes you.</p>\n    <button onClick={onCreate}>Create a project</button>\n  </div>;\n}\n");
  append('src/styles.css','\n.empty-state { text-align: center; padding: 80px 24px; }\n.empty-state > span { color: #c4f46e; font-size: 48px; }\n.empty-state button { background: #c4f46e; color: #1f2a17; border: 0; border-radius: 8px; padding: 12px 18px; }\n');
  commit('feat: make room for a fresh start',1);
  put('src/lib/format.ts',"export function formatDate(value: string) {\n  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));\n}\n\nexport function clampProgress(value: number) {\n  return Math.round(Math.min(100, Math.max(0, value)));\n}\n");
  put('src/components/ProjectCard.tsx',readFileSync(join(root,'src/components/ProjectCard.tsx'),'utf8').replace("import type", "import { clampProgress } from '../lib/format';\nimport type").replace('value={project.progress}','value={clampProgress(project.progress)}'));
  commit('fix: keep progress within its orbit',2);
  put('src/components/ActivityFeed.tsx',"type Activity = { id: string; title: string; time: string };\n\nexport function ActivityFeed({ items }: { items: Activity[] }) {\n  return <section aria-label=\"Recent activity\">\n    <h2>A little momentum</h2>\n    <ul className=\"activity-list\">\n      {items.map(item => <li key={item.id}><span>{item.title}</span><time>{item.time}</time></li>)}\n    </ul>\n  </section>;\n}\n");
  append('src/styles.css','\n.activity-list { list-style: none; padding: 0; }\n.activity-list li { display: flex; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid #34412c; }\n.activity-list time { color: #8d9e80; font-size: 12px; }\n');
  commit('feat: a timeline for the small wins',1);
  put('src/components/SearchInput.tsx',"type Props = { value: string; onChange: (value: string) => void };\n\nexport function SearchInput({ value, onChange }: Props) {\n  return <label className=\"search\">\n    <span className=\"sr-only\">Search projects</span>\n    <input type=\"search\" value={value} onChange={e => onChange(e.target.value)} placeholder=\"Find your next thing…\" />\n  </label>;\n}\n");
  append('src/styles.css','\n.search input { background: #141a11; color: inherit; padding: 12px 16px; border: 1px solid #39472e; border-radius: 8px; }\n.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }\n');
  commit('feat: find things a little faster');
  put('src/hooks/useKeyboard.ts',"import { useEffect } from 'react';\n\nexport function useKeyboard(key: string, action: () => void) {\n  useEffect(() => {\n    const handle = (event: KeyboardEvent) => {\n      if ((event.metaKey || event.ctrlKey) && event.key === key) {\n        event.preventDefault();\n        action();\n      }\n    };\n    window.addEventListener('keydown', handle);\n    return () => window.removeEventListener('keydown', handle);\n  }, [key, action]);\n}\n");
  put('src/components/CommandMenu.tsx',"import { useState, useCallback } from 'react';\nimport { useKeyboard } from '../hooks/useKeyboard';\n\nexport function CommandMenu() {\n  const [open, setOpen] = useState(false);\n  const toggle = useCallback(() => setOpen(value => !value), []);\n  useKeyboard('k', toggle);\n  if (!open) return null;\n  return <dialog open className=\"command-menu\" aria-label=\"Quick actions\">\n    <input autoFocus placeholder=\"Where would you like to go?\" />\n    <button onClick={() => setOpen(false)}>Close</button>\n  </dialog>;\n}\n");
  put('src/components/App.tsx',readFileSync(join(root,'src/components/App.tsx'),'utf8').replace("import { Sidebar }", "import { CommandMenu } from './CommandMenu';\nimport { Sidebar }").replace('      <Sidebar />','      <Sidebar />\n      <CommandMenu />'));
  append('src/styles.css','\n.command-menu { width: min(480px, 90vw); background: #20291d; color: inherit; border: 1px solid #6d8c4e; border-radius: 14px; padding: 24px; }\n.command-menu input { width: 100%; padding: 12px; background: #151b14; color: inherit; border: 1px solid #39472e; border-radius: 6px; }\n');
  commit('feat: add a keyboard-first command menu',2);
  append('src/styles.css','\n@media (max-width: 768px) {\n  .app { grid-template-columns: 1fr; }\n  .sidebar { border-right: 0; border-bottom: 1px solid #34412c; }\n  .sidebar nav { flex-direction: row; gap: 16px; margin-top: 20px; }\n  main { padding: 24px; }\n  .project-grid { grid-template-columns: 1fr; }\n}\n');
  commit('style: a little more room on small screens',1);
  put('src/components/ThemeToggle.tsx',"import { useLocalStorage } from '../hooks/useLocalStorage';\n\nexport function ThemeToggle() {\n  const [theme, setTheme] = useLocalStorage('orbit-theme', 'dark');\n  return <button aria-label=\"Toggle color theme\" onClick={() => {\n    const next = theme === 'dark' ? 'light' : 'dark';\n    setTheme(next);\n    document.documentElement.dataset.theme = next;\n  }}>{theme === 'dark' ? '☀' : '☾'}</button>;\n}\n");
  append('src/styles.css','\n:root[data-theme="light"] { background: #f5f7f0; color: #283420; color-scheme: light; }\n:root[data-theme="light"] .project-card { background: #eaf0e2; }\n');
  commit('feat: a different kind of daylight');
  put('src/lib/validators.ts',"export function isProjectName(value: unknown): value is string {\n  return typeof value === 'string' && value.trim().length > 0 && value.length <= 80;\n}\n");
  put('tests/validators.test.ts',"import { describe, it, expect } from 'vitest';\nimport { isProjectName } from '../src/lib/validators';\n\ndescribe('project names', () => {\n  it('accepts a name with a little personality', () => expect(isProjectName('Moonshot')).toBe(true));\n  it('rejects an empty thought', () => expect(isProjectName('   ')).toBe(false));\n  it('rejects non-strings', () => expect(isProjectName(null)).toBe(false));\n});\n");
  commit('test: give project names a safety net',2);
  put('docs/architecture.md','# The shape of Orbit\n\n## Components\nSmall, focused components live in src/components.\n\n## State\nBrowser storage keeps the workspace on your machine.\n\n## Philosophy\nBuild something useful. Keep the details kind.\n');
  append('README.md','\n## Development\n\nnpm install\nnpm run dev\n\n## Design\nSmall components. Local data. A little breathing room.\n');
  commit('docs: leave a map for the next person',1);
  renameSync(join(root,'src/lib/format.ts'),join(root,'src/lib/formatters.ts'));
  put('src/components/ProjectCard.tsx',readFileSync(join(root,'src/components/ProjectCard.tsx'),'utf8').replace("'../lib/format'","'../lib/formatters'"));
  commit('refactor: put the helpers in their place');
  append('src/styles.css','\n:focus-visible { outline: 2px solid #c4f46e; outline-offset: 4px; }\n@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after { animation: none !important; transition: none !important; }\n}\n');
  put('docs/accessibility.md','# A workspace for everyone\n\n- Keyboard focus is always visible.\n- Navigation has accessible labels.\n- Motion respects the system preference.\n- Search inputs have readable names.\n');
  commit('fix: make the quiet details accessible',2);
  rmSync(join(root,'src/components/EmptyState.tsx'));
  append('README.md','\n## 1.0\n\nA small beginning, built one commit at a time.\n');
  put('CHANGELOG.md','# Changelog\n\n## 1.0.0\n\n- Project workspace and activity timeline\n- Keyboard command menu\n- Themes and responsive layout\n- Local persistence\n');
  put('package.json',readFileSync(join(root,'package.json'),'utf8').replace('0.1.0','1.0.0'));
  commit('release: ready for its first orbit');
  mkdirSync('data',{recursive:true});
  const history=exportHistory(root,{limit:120,name:'orbit'});
  history.exportedAt='2026-09-20T12:00:00.000Z';
  writeFileSync('data/demo.json',JSON.stringify(history));
  console.log(`Created ${history.commits.length} real sample commits → data/demo.json`);
} finally {
  if(dirname(root) === resolve(tmpdir()) && basename(root).startsWith('git-rewind-demo-')) rmSync(root,{recursive:true,force:true});
}
