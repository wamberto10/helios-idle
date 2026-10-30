/* Monta a pasta distribuída pelo aplicativo (app/www) a partir da versão web, sem alterá-la.
   node tools/preparar-app.js
   Copia só o que o jogo usa: index.html, css, js e as imagens de assets/ (sem prévias, galerias e prompts).
   Troca a fonte do Google Fonts por uma cópia local quando ela existir em assets/fonts/ (sem internet o
   jogo usa a fonte do sistema). Em seguida, rode "npx cap sync android" dentro de app/. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'app', 'www');
const copy = (rel) => { const src = path.join(ROOT, rel), dst = path.join(OUT, rel); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); return fs.statSync(src).size; };
const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);

fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
let bytes = 0; const files = [];
const take = (rel) => { bytes += copy(rel); files.push(rel.split(path.sep).join('/')); };
for (const f of walk('css')) take(f);
for (const f of walk('js')) take(f);
take('assets/manifest.js');
// imagens usadas pelo jogo: pastas de arte (prévias, galerias e textos de prompts ficam fora)
for (const dir of fs.readdirSync(path.join(ROOT, 'assets'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  // a prancha de recursos (assets/resources/*.png) fica fora: o jogo usa os recortes em assets/resources/icons
  for (const f of walk(path.join('assets', dir))) if (/\.(png|jpe?g|webp|svg|woff2?)$/i.test(f) && !/^assets[\\/]resources[\\/][^\\/]+$/.test(f)) take(f);
}
// index.html: fonte local se existir; sem ela, o CSS já cai para a fonte do sistema
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const fontDir = path.join(ROOT, 'assets', 'fonts');
const localFont = fs.existsSync(fontDir) && fs.readdirSync(fontDir).some((f) => /exo.*\.woff2$/i.test(f));
html = html.replace(/\s*<link rel="preconnect"[^>]*>/g, '').replace(/\s*<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, '');
if (localFont) {
  const faces = fs.readdirSync(fontDir).filter((f) => /exo.*\.woff2$/i.test(f)).map((f) => { const w = (f.match(/(\d{3})/) || [, '400'])[1]; return `@font-face{font-family:"Exo 2";font-weight:${w};font-display:swap;src:url("assets/fonts/${f}") format("woff2")}`; }).join('');
  html = html.replace('<link rel="stylesheet" href="css/style.css">', `<style>${faces}</style>\n  <link rel="stylesheet" href="css/style.css">`);
}
fs.writeFileSync(path.join(OUT, 'index.html'), html); files.push('index.html');
fs.writeFileSync(path.join(OUT, 'arquivos-do-app.txt'), files.sort().join('\n') + '\n');
console.log(`app/www pronto: ${files.length} arquivos, ${(bytes / 1048576).toFixed(1)} MB. Fonte ${localFont ? 'local incluída' : 'do sistema (adicione assets/fonts/exo2-*.woff2 para incluir a Exo 2)'}.`);
