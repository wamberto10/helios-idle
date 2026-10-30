/* Recorta a prancha de recursos (assets/resources/recursos-helios-idle-v1.png) em 16 ícones separados.
   node tools/recortar-recursos.js
   - Lê o PNG sem bibliotecas externas (zlib do Node).
   - Separa cada ícone pelos pixels conectados (alfa > 12), atribuídos à célula onde fica o centro de cada
     peça: pedaços de um vizinho que invadem a célula não vêm junto; partes que passam da borda vêm inteiras.
   - Salva 128 × 128 px com margem transparente em assets/resources/icons/<id>.png (suficiente para 32 px em
     telas de alta densidade). A prancha original não é alterada. */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets/resources/recursos-helios-idle-v1.png');
const OUT = path.join(ROOT, 'assets/resources/icons');
const IDS = ['ore', 'metal', 'alloy', 'comp', 'ice', 'gas', 'fuel', 'rare', 'cell', 'fusion', 'hull', 'cryo', 'exotic', 'sat', 'data', 'frag'];
const SIZE = 128, PAD = 0.06;

function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('não é PNG');
  let p = 8, w, h, depth, ctype, inter; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; inter = data[12]; }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || inter !== 0 || (ctype !== 6 && ctype !== 2)) throw new Error('formato não suportado (profundidade ' + depth + ', tipo ' + ctype + ')');
  const bpp = ctype === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      if (f === 1) line[i] = (line[i] + a) & 255; else if (f === 2) line[i] = (line[i] + b) & 255;
      else if (f === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
    }
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; px[o] = line[x * bpp]; px[o + 1] = line[x * bpp + 1]; px[o + 2] = line[x * bpp + 2]; px[o + 3] = bpp === 4 ? line[x * bpp + 3] : 255; }
    prev = line;
  }
  return { w, h, px };
}
function crc32(b) { let c, crc = 0xffffffff; for (let n = 0; n < b.length; n++) { c = (crc ^ b[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); }
function encode(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const { w, h, px } = decode(fs.readFileSync(SRC));
const A = (i) => px[i * 4 + 3];
// componentes conectados (8 vizinhos) sobre alfa > 12
const lab = new Int32Array(w * h).fill(-1); const comps = [];
for (let i = 0; i < w * h; i++) {
  if (lab[i] !== -1 || A(i) <= 12) continue;
  const id = comps.length; const st = [i]; lab[i] = id; let n = 0, sx = 0, sy = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
  while (st.length) {
    const k = st.pop(); const x = k % w, y = (k / w) | 0; n++; sx += x; sy += y;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx; if (lab[j] === -1 && A(j) > 12) { lab[j] = id; st.push(j); }
    }
  }
  comps.push({ n, cx: sx / n, cy: sy / n, x0, y0, x1, y1 });
}
const cell = w / 4; const warn = [];
for (const c of comps) if (c.x1 - c.x0 > cell * 1.25 || c.y1 - c.y0 > cell * 1.25) warn.push('peça grande demais (' + (c.x1 - c.x0) + '×' + (c.y1 - c.y0) + ')');
fs.mkdirSync(OUT, { recursive: true });
const report = [];
IDS.forEach((id, i) => {
  const q = i % 4, r = (i / 4) | 0;
  const mine = comps.map((c, k) => ({ c, k })).filter(({ c }) => c.n >= 20 && Math.floor(c.cx / cell) === q && Math.floor(c.cy / cell) === r);
  const keep = new Set(mine.map((m) => m.k));
  const x0 = Math.min(...mine.map((m) => m.c.x0)), y0 = Math.min(...mine.map((m) => m.c.y0)), x1 = Math.max(...mine.map((m) => m.c.x1)), y1 = Math.max(...mine.map((m) => m.c.y1));
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, side = Math.max(bw, bh) / (1 - 2 * PAD);
  const ox = x0 - (side - bw) / 2, oy = y0 - (side - bh) / 2, scale = side / SIZE;
  // redução por média de área com alfa pré-multiplicado (bordas limpas); só pixels das peças deste ícone
  const out = Buffer.alloc(SIZE * SIZE * 4);
  for (let Y = 0; Y < SIZE; Y++) for (let X = 0; X < SIZE; X++) {
    const sx0 = ox + X * scale, sy0 = oy + Y * scale; let r2 = 0, g2 = 0, b2 = 0, a2 = 0, wt = 0;
    for (let yy = Math.floor(sy0); yy < Math.ceil(sy0 + scale); yy++) for (let xx = Math.floor(sx0); xx < Math.ceil(sx0 + scale); xx++) {
      const fw = Math.max(0, Math.min(xx + 1, sx0 + scale) - Math.max(xx, sx0)) * Math.max(0, Math.min(yy + 1, sy0 + scale) - Math.max(yy, sy0)); if (!fw) continue;
      wt += fw; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx; const al = keep.has(lab[j]) ? px[j * 4 + 3] / 255 : 0; if (!al) continue;
      r2 += px[j * 4] * al * fw; g2 += px[j * 4 + 1] * al * fw; b2 += px[j * 4 + 2] * al * fw; a2 += al * fw;
    }
    const o = (Y * SIZE + X) * 4; if (a2 > 0) { out[o] = Math.round(r2 / a2); out[o + 1] = Math.round(g2 / a2); out[o + 2] = Math.round(b2 / a2); out[o + 3] = Math.round(255 * a2 / wt); }
  }
  const file = path.join(OUT, id + '.png'); fs.writeFileSync(file, encode(SIZE, SIZE, out));
  report.push(id + ': ' + mine.length + ' peça(s), recorte ' + bw + '×' + bh + ' px, ' + (fs.statSync(file).size / 1024).toFixed(1) + ' KB');
});
console.log(report.join('\n'));
if (warn.length) console.log('Atenção: ' + warn.join('; '));
console.log('Ícones em assets/resources/icons/ (' + SIZE + '×' + SIZE + ' px).');
