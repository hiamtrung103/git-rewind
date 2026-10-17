import { mkdirSync, copyFileSync, cpSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
for (const file of ['index.html', 'style.css', 'app.js', 'model.js', 'favicon.svg']) copyFileSync(file, `dist/${file}`);
cpSync('data', 'dist/data', { recursive: true });
console.log('Built Git Rewind → dist/ (static, no runtime dependencies)');
