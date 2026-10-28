/* HELIOS IDLE — bot de teste automático.
   Uso: node tools/bot.js [universo] [horasMax]
   Joga a campanha inteira usando apenas as ações do jogador, mede tempos e verifica invariantes. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
if (!globalThis.H || !globalThis.H.E) { // reaproveita o motor já carregado (ex.: pelos testes de regressão)
  globalThis.H = {};
  for (const f of ['data.js', 'engine.js', 'session.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
}
const { DATA: D, E, F } = H;
const RO = D.regionOrder;

let fails = 0;
const assert = (c, msg) => { if (!c) { fails++; console.log('  ✗ FALHA: ' + msg); } };

// ---------------- BOT ----------------
function producers(S, rid, r) { return E.bList(S, rid).filter((b) => D.buildings[b].out && D.buildings[b].out[r]); }
function gens(S, rid) { return E.bList(S, rid).filter((b) => D.buildings[b].gen); }

function tryCost(S, rid, cost, depth) {
  const reg = S.run.regions[rid]; const m = E.mods(S);
  for (const r in cost) {
    if ((reg.st[r] || 0) + 1e-9 >= cost[r]) continue;
    if (cost[r] > E.cap(S, rid, r, m)) { if (depth < 5) tryBuild(S, rid, 'armazem', depth + 1); continue; }
    ensureSupply(S, rid, r, depth + 1);
    // o recurso já chega por uma rota: garante que ele tenha vez no porão
    if ((reg.st[r] || 0) + 1e-9 < cost[r] && S.run.routes.some((rt) => rt.to === rid && rt.res.includes(r))) ensureRoute(S, rid, r, depth + 1);
  }
  return E.afford(reg, cost);
}
function tryBuild(S, rid, b, depth) {
  if (!E.bAvail(S, rid, b)) return false;
  if (botPaused.has(rid + '|' + b)) return false;
  const def = D.buildings[b];
  if (def.e && !def.passive) { const m = E.mods(S); const en = E.regionEnergy(S, rid, m); const extra = E.useOf(def, 1, m); if (en.gen < en.use + extra) ensurePower(S, rid, depth + 1); }
  if (tryCost(S, rid, E.bCost(S, rid, b), depth)) return E.build(S, rid, b).ok;
  return false;
}
function tryUpgrade(S, rid, b, depth) {
  const bs = S.run.regions[rid].b[b]; if (!bs || !bs.n) return tryBuild(S, rid, b, depth);
  if (tryCost(S, rid, E.uCost(S, rid, b), depth)) return E.upgrade(S, rid, b).ok;
  return false;
}
function ensurePower(S, rid, depth) {
  if (depth > 5) return;
  const g = gens(S, rid).filter((b) => b !== 'armazem');
  const m = E.mods(S);
  // gerador com melhor energia por custo aproximado
  let best = null, bv = -1;
  // compara construir mais uma unidade com melhorar as existentes (energia ganha por custo)
  const reg = S.run.regions[rid]; let up = false;
  for (const b of g) {
    const bs = reg.b[b] || { n: 0, lvl: 1 }; const sum = (c) => Object.values(c).reduce((a, x) => a + x, 0);
    const v = E.genOf(S, rid, b, m, 1, bs.lvl) / sum(E.bCost(S, rid, b, m)); if (v > bv) { bv = v; best = b; up = false; }
    if (bs.n && bs.lvl < D.maxBuildingLevel) { const u = (E.genOf(S, rid, b, m, bs.n, bs.lvl + 1) - E.genOf(S, rid, b, m, bs.n, bs.lvl)) / sum(E.uCost(S, rid, b, m)); if (u > bv) { bv = u; best = b; up = true; } }
  }
  if (best) (up ? tryUpgrade : tryBuild)(S, rid, best, depth + 1);
}
// falta de energia sem dinheiro para geradores: pausa as máquinas de transformação de maior nível
// (como um jogador faria) para a extração e o refino voltarem à velocidade; retoma quando sobra energia
const botPaused = new Set();
function energyRescue(S) {
  const m = E.mods(S);
  for (const rid of RO) {
    const reg = S.run.regions[rid]; if (!reg.unlocked) continue;
    const en = E.regionEnergy(S, rid, m);
    if (en.ratio < 0.97) {
      if (S.run.time - (reg._botPauseT || -1e9) < 10) continue;
      // algum gerador cabe no bolso? então ensurePower resolve
      const g = gens(S, rid).filter((x) => x !== 'armazem'); if (g.some((x) => E.afford(reg, E.bCost(S, rid, x, m)) || (reg.b[x] && reg.b[x].n && E.afford(reg, E.uCost(S, rid, x, m))))) continue;
      const need = new Set(); for (const x of g) for (const r in E.bCost(S, rid, x, m)) need.add(r);
      // não pausa quem produz o material dos geradores nem quem produz os insumos desses produtores
      const keep = new Set(); for (const x in reg.b) { const d = D.buildings[x]; if (d.out && Object.keys(d.out).some((r) => need.has(r))) { keep.add(x); for (const r in (d.in || {})) for (const y in reg.b) if ((D.buildings[y].out || {})[r]) keep.add(y); } }
      const ids = Object.keys(reg.b).filter((x) => { const d = D.buildings[x]; return reg.b[x].n && !d.passive && d.in && !keep.has(x) && !reg.b[x].pause && E.isAuto(m, d); })
        .sort((x, y) => D.buildings[y].tier - D.buildings[x].tier);
      if (ids.length) { E.togglePause(S, rid, ids[0]); botPaused.add(rid + '|' + ids[0]); reg._botPauseT = S.run.time; }
    } else {
      for (const k of [...botPaused]) {
        const [r2, x] = k.split('|'); if (r2 !== rid) continue;
        const bs = reg.b[x]; if (!bs || !bs.pause) { botPaused.delete(k); continue; }
        const g = gens(S, rid).filter((y) => y !== 'armazem');
        if (S.run.time - reg._botPauseT >= 60 || g.some((y) => E.afford(reg, E.bCost(S, rid, y, m))) || en.gen >= en.use + E.useOf(D.buildings[x], bs.n, m) * 1.05) { E.togglePause(S, rid, x); botPaused.delete(k); reg._botPauseT = S.run.time; break; }
      }
    }
  }
}
function ensureSupply(S, rid, r, depth) {
  if (depth > 5) return;
  const reg = S.run.regions[rid];
  const prods = producers(S, rid, r);
  if (prods.length) {
    const b = prods[0]; const bs = reg.b[b];
    if (!bs || !bs.n) { tryBuild(S, rid, b, depth); return; }
    if (bs.why && bs.why.startsWith('no:')) { ensureSupply(S, rid, bs.why.slice(3), depth + 1); return; }
    if (bs.why === 'energy' || bs.why === 'energylow') { ensurePower(S, rid, depth); return; }
    if (bs.why && bs.why.startsWith('full:') && !reg.exp[bs.why.slice(5)]) { E.toggleExport(S, rid, bs.why.slice(5)); return; }
    if (bs.n < 12 + 4 * RO.indexOf(rid)) tryBuild(S, rid, b, depth + 2);
    return;
  }
  ensureRoute(S, rid, r, depth);
}
function sourceFor(S, to, r) {
  let best = null, bv = -1;
  for (const rid of RO) {
    if (rid === to || !S.run.regions[rid].unlocked) continue;
    const reg = S.run.regions[rid];
    const hasProd = producers(S, rid, r).some((b) => reg.b[b] && reg.b[b].n);
    const st = reg.st[r] || 0;
    const v = (hasProd ? 1000 : 0) + st;
    if ((hasProd || st > 20) && v > bv) { bv = v; best = rid; }
  }
  return best;
}
const reordered = new WeakMap();
function ensureRoute(S, to, r, depth) {
  if (depth > 6) return;
  const run = S.run;
  const ex = run.routes.find((rt) => rt.to === to && rt.res.includes(r));
  if (ex) {
    const from = run.regions[ex.from];
    // muda a prioridade no máximo uma vez por viagem: recursos que dividem o porão se alternam
    if (ex.res[0] !== r && (run.regions[to].st[r] || 0) < 60 && reordered.get(ex) !== ex.trips) { reordered.set(ex, ex.trips); ex.res = [r].concat(ex.res.filter((x) => x !== r)); }
    if (ex.why === 'nofuel') { ensureSupply(S, ex.from, 'fuel', depth + 1); }
    if (ex.why === 'empty') { ensureSupply(S, ex.from, r, depth + 1); }
    if (ex.lvl < 10) { const c = E.routeUpCost(S, ex); if (E.afford(from, c) && Object.keys(c).every((k) => (from.st[k] || 0) > c[k] * 2)) E.upgradeRoute(S, ex.id); }
    return;
  }
  const src = sourceFor(S, to, r); if (!src) return;
  const same = run.routes.find((rt) => rt.from === src && rt.to === to);
  if (same && same.res.length < 2) { same.res.push(r); return; }
  if (tryCost(S, src, E.routeCost(S, null, src), depth)) E.createRoute(S, src, to, [r]);
}

// Rota parada com destino cheio: o destino não está consumindo o recurso. Como um jogador faria,
// liga “Exportar excedente” no produto que trava os consumidores, para a cadeia voltar a andar.
function unblockDest(S, rt) {
  const to = S.run.regions[rt.to]; let did = false;
  for (const r of rt.res) for (const b in to.b) {
    const def = D.buildings[b]; const bs = to.b[b];
    if (bs.n && def.in && def.in[r] && bs.why && bs.why.startsWith('full:') && !to.exp[bs.why.slice(5)]) { E.toggleExport(S, rt.to, bs.why.slice(5)); did = true; }
  }
  // nenhum consumidor travado: o destino não usa o recurso; liga EXP nele para os cargueiros descarregarem
  if (!did) for (const r of rt.res) if (!to.exp[r]) { E.toggleExport(S, rt.to, r); did = true; }
  return did;
}
function botMission(S, rid, x) {
  const md = x.md; const run = S.run;
  switch (md.t) {
    case 'build': tryBuild(S, rid, md.b, 0); break;
    case 'level': tryUpgrade(S, rid, md.b, 0); break;
    case 'prod': ensureSupply(S, rid, md.r, 0); break;
    case 'cycles': { const bs = run.regions[rid].b[md.b]; if (!bs || !bs.n) tryBuild(S, rid, md.b, 0); else if (bs.why && bs.why.startsWith('full:')) { if (!run.regions[rid].exp[bs.why.slice(5)]) E.toggleExport(S, rid, bs.why.slice(5)); else tryBuild(S, rid, 'armazem', 0); } else if (bs.why && bs.why.startsWith('no:')) ensureSupply(S, rid, bs.why.slice(3), 1); else if (D.buildings[md.b].in) for (const r in D.buildings[md.b].in) if ((run.regions[rid].st[r] || 0) < D.buildings[md.b].in[r] * bs.n) ensureSupply(S, rid, r, 1); break; }
    case 'pay': { const k = 'm:' + x.id; E.contribute(S, k, true); const pr = E.projectProgress(S, k, md.cost); for (const r in md.cost) if ((pr.st[r] || 0) < md.cost[r]) ensureSupply(S, rid, r, 0); break; }
    case 'energy': ensurePower(S, rid, 0); break;
    case 'route': case 'ship': {
      const n = run.routes.filter((r) => r.from === rid || r.to === rid).length;
      if (md.t === 'route' && n < md.n || md.t === 'ship' && n === 0) {
        const prev = RO[RO.indexOf(rid) - 1] || 'marte';
        const has = run.routes.some((r) => r.from === prev && r.to === rid);
        if (!has) { if (tryCost(S, prev, E.routeCost(S, null, prev), 0)) E.createRoute(S, prev, rid, ['fuel', 'metal']); }
        else if (tryCost(S, rid, E.routeCost(S, null, prev), 0)) E.createRoute(S, rid, prev, [producers(S, rid, 'metal').length ? 'metal' : Object.keys(run.regions[rid].st)[0]]);
      }
      for (const rt of run.routes) if ((rt.from === rid || rt.to === rid) && rt.why === 'destfull') unblockDest(S, rt);
      break;
    }
    case 'deliver': ensureRoute(S, rid, md.r, 0); break;
    case 'research': buyResearch(S, true); break;
    case 'dyson': supplyProject(S, 'dyson'); break;
    case 'core': supplyProject(S, 'core'); break;
    case 'total': { const bl = E.bList(S, rid).filter((b) => b !== 'armazem'); let best = null, bc = Infinity; for (const b of bl) { const c = Object.values(E.bCost(S, rid, b)).reduce((a, v) => a + v, 0); if (c < bc) { bc = c; best = b; } } if (best) tryBuild(S, rid, best, 0); break; }
    case 'data': ensureSupply(S, rid, 'cryo', 0); break;
    case 'promote': break;
    case 'exped': break;
  }
}
function supplyProject(S, key) {
  const info = E.projectInfo(S, key); if (!info.avail) return;
  E.contribute(S, key, true);
  const info2 = E.projectInfo(S, key); if (!info2.avail) return;
  const pr = E.projectProgress(S, key, info2.cost);
  for (const r in info2.cost) if ((pr.st[r] || 0) < info2.cost[r] - 1e-9) ensureSupply(S, info2.rid, r, 0);
}
function buyResearch(S, force) {
  let best = null, bc = Infinity;
  for (const id in D.research) { const st = E.resState(S, id); if (st.max || st.locked) continue; if (st.can && st.cost < bc) { bc = st.cost; best = id; } }
  if (best && (force || D.research[best].cur === 'frag' || bc < S.perm.data * 0.5)) E.buyResearch(S, best);
}

const T = {};
function mark(S, k) { if (T[k] === undefined) T[k] = S.run.time; }

function botStep(S) {
  const run = S.run; const m = E.mods(S);
  while (S.perm.chests.length) E.openChest(S, S.perm.chests[0].id);
  for (const e of run.exps.slice()) if (run.time >= e.end) E.collectExp(S, e.uid);
  for (const sid in S.perm.specs) while (E.canPromote(S, sid)) E.promote(S, sid);
  buyResearch(S, false);
  for (let k = 0; k < 4; k++) for (const rid of RO) { if (!run.regions[rid].unlocked) continue; for (const x of E.activeMissions(S, rid)) if (E.mProg(S, rid, x.md, x.id, m).done) { mark(S, 'm_' + x.id); E.claim(S, rid, x.id); } }
  for (const sid in S.perm.specs) mark(S, 'spec_' + sid);
  for (const rid of RO) if (run.regions[rid].unlocked) mark(S, 'reg_' + rid);
  if (run.dyson.stage) mark(S, 'dyson' + run.dyson.stage);
  for (const rid of RO) if (run.regions[rid].unlocked) mark(S, 'ph_' + rid + '_' + run.regions[rid].phase);
  // manual
  for (const rid of RO) { const reg = run.regions[rid]; if (!reg.unlocked) continue; for (const b in reg.b) { const def = D.buildings[b]; if (!def.passive && reg.b[b].n && !E.isAuto(m, def) && !reg.b[b].on) E.operate(S, rid, b); } }
  if (!m.routeAuto) for (const rt of run.routes) if (rt.st === 'idle') E.sendRoute(S, rt.id);
  // energia
  for (const rid of RO) { const reg = run.regions[rid]; if (reg.unlocked && reg.en.ratio < 0.97) ensurePower(S, rid, 0); }
  energyRescue(S);
  // missões ativas
  for (const rid of RO) {
    const reg = run.regions[rid]; if (!reg.unlocked) continue;
    if (E.regionDone(S, rid)) { const nr = E.nextRegion(rid); if (nr && !run.regions[nr].unlocked) supplyProject(S, 'launch:' + nr); continue; }
    for (const x of E.activeMissions(S, rid)) if (!E.mProg(S, rid, x.md, x.id, m).done) botMission(S, rid, x);
  }
  // promoção: expedições para o especialista com mais cartas
  if (run.flags.expeditions && run.exps.length < E.expSlots(S, m)) {
    const ids = Object.keys(D.expeditions).filter((id) => E.expAvail(S, id).ok && E.afford(run.regions[D.expeditions[id].region], D.expeditions[id].cost));
    ids.sort((a, b) => D.expeditions[a].dur - D.expeditions[b].dur);
    if (ids.length) E.startExp(S, ids[0]); else { const any = Object.keys(D.expeditions).find((id) => E.expAvail(S, id).ok); if (any) ensureSupply(S, D.expeditions[any].region, 'fuel', 0); }
  }
  if (run.dyson.stage < D.dysonRequired) supplyProject(S, 'dyson');
  supplyProject(S, 'core');
  for (const d of E.dirs(S)) if (!d.claimed && d.p.done) E.claimDir(S, d.i);
}

function checkInvariants(S) {
  for (const rid of RO) { const st = S.run.regions[rid].st; for (const r in st) if (!(st[r] >= 0) || !isFinite(st[r])) { assert(false, 'recurso inválido ' + rid + '.' + r + '=' + st[r]); st[r] = 0; } }
  assert(S.perm.data >= -1e-6, 'dados negativos'); assert(S.perm.frags >= 0, 'fragmentos negativos');
}

function playUniverse(S, maxH, label) {
  for (const k in T) delete T[k];
  const t0 = Date.now(); let lastProg = 0, lastKey = '';
  while (S.run.time < maxH * 3600) {
    for (let i = 0; i < 2; i++) E.tick(S, 1);
    botStep(S);
    if (Math.floor(S.run.time) % 60 === 0) checkInvariants(S);
    if (E.canCollapse(S)) { mark(S, 'collapse'); break; }
    const key = RO.map((r) => S.run.regions[r].phase).join(',') + Object.keys(S.run.missions).length + '/' + S.run.dyson.stage;
    if (key !== lastKey) { lastKey = key; lastProg = S.run.time; }
    if (S.run.time - lastProg > 3 * 3600) { console.log('  ! progresso parado há 3h de jogo'); break; }
  }
  const fmt = (s) => s === undefined ? '—' : F.t(s);
  console.log(`\n== ${label} (${D.universes[S.run.universe].name}) — simulado em ${((Date.now() - t0) / 1000).toFixed(1)}s reais`);
  console.log('  Íris (1ª automação): ' + fmt(T.spec_iris) + ' | Vulcano: ' + fmt(T.spec_vulcano) + ' | Nix: ' + fmt(T.spec_nix) + ' | Oráculo: ' + fmt(T.spec_oraculo));
  console.log('  Regiões: ' + RO.map((r) => D.regions[r].name.split(' ')[0] + ' ' + fmt(T['reg_' + r])).join(' | '));
  console.log('  Dyson: ' + [1, 2, 3, 4, 5, 6].map((i) => i + ':' + fmt(T['dyson' + i])).join(' '));
  if (process.env.PH) { let prev = 0; for (const rid of RO) D.regions[rid].phases.forEach((ph, p) => { const t = T['ph_' + rid + '_' + (p + 1)]; if (t !== undefined) { console.log('    ' + rid + ' ' + ph.name + ': ' + F.t(t - prev)); if (t - prev > 1200) ph.missions.forEach((md, i) => console.log('        ' + F.t((T['m_' + E.mid(rid, p, i)] || 0) - prev) + '  ' + E.mTitle(md))); prev = t; } }); }
  console.log('  Colapso disponível: ' + fmt(T.collapse) + ' | missões resgatadas: ' + Object.keys(S.run.missions).length);
  if (!T.collapse) {
    for (const rid of RO) { const reg = S.run.regions[rid]; if (!reg.unlocked || E.regionDone(S, rid)) continue;
      console.log('  Travado em ' + rid + ' fase ' + reg.phase + ':');
      for (const x of E.activeMissions(S, rid)) { const p = E.mProg(S, rid, x.md, x.id); console.log('    - ' + E.mTitle(x.md) + ' ' + F.n(p.cur) + '/' + F.n(p.max)); }
      console.log('    estoque: ' + Object.entries(reg.st).filter(([, v]) => v > 0.5).map(([k, v]) => k + '=' + F.n(v)).join(' '));
      console.log('    instalações: ' + Object.entries(reg.b).map(([k, b]) => k + ' ' + b.n + 'x n' + b.lvl + (b.why ? '(' + b.why + ')' : '')).join(', '));
      console.log('    energia ' + F.n(reg.en.gen) + '/' + F.n(reg.en.use));
    }
    console.log('  rotas: ' + S.run.routes.map((r) => r.from + '>' + r.to + '[' + r.res + '] n' + r.lvl + ' ' + r.st + (r.why ? ' ' + r.why : '')).join('; '));
  }
  console.log('  dados=' + F.n(S.perm.data) + ' especialistas=' + Object.entries(S.perm.specs).map(([k, v]) => k + ':' + v.lvl).join(' '));
  return T.collapse;
}

// ---------------- TESTES ----------------
function clone(S) { const r = E.deserialize(E.serialize(S)); return r.S; }

function testOfflineConsistency(S) {
  const a = clone(S), b = clone(S);
  const v0 = S.run.totals.value;
  for (let i = 0; i < 18000; i++) E.tick(a, 0.1); // 30 min online (passos de 0,1s)
  E.simulate(b, 1800);                            // 30 min offline
  const va = a.run.totals.value - v0, vb = b.run.totals.value - v0;
  const d = Math.abs(va - vb) / va;
  // sem rotas, por recurso (isola a simulação de produção)
  const c = clone(S), e = clone(S); c.run.routes = []; e.run.routes = [];
  for (let i = 0; i < 18000; i++) E.tick(c, 0.1); E.simulate(e, 1800);
  let worst = 0, wr = '';
  for (const rid of RO) { if (!c.run.regions[rid].unlocked) continue; for (const r in c.run.regions[rid].stats.prod) {
    const pa = c.run.regions[rid].stats.prod[r] - (S.run.regions[rid].stats.prod[r] || 0), pb = e.run.regions[rid].stats.prod[r] - (S.run.regions[rid].stats.prod[r] || 0);
    if (pa > 50) { const x = Math.abs(pa - pb) / pa; if (x > worst) { worst = x; wr = rid + '.' + r; } } } }
  console.log('  Online×offline (30 min): valor total produzido difere ' + (d * 100).toFixed(2) + '%; sem rotas, maior diferença por recurso ' + (worst * 100).toFixed(2) + '% ' + wr);
  assert(d < 0.03, 'valor total online/offline difere mais de 3%');
  assert(worst < 0.02, 'produção por recurso online/offline difere mais de 2%');
}
function testSave(S) {
  const s1 = E.serialize(S); const r = E.deserialize(s1); assert(r.ok, 'deserialize falhou');
  const s2 = E.serialize(Object.assign(r.S, { lastTick: S.lastTick }));
  const strip = (s) => { const o = JSON.parse(s); delete o.at; return JSON.stringify(o); };
  assert(strip(s1) === strip(s2), 'roundtrip de salvamento alterou dados');
  const ex = E.exportStr(S); const r2 = E.importStr(ex); assert(r2.ok && r2.S.run.universe === S.run.universe, 'export/import falhou');
  assert(!E.importStr('lixo').ok && !E.importStr('HELIOS1:@@@').ok && !E.importStr('{"a":1}').ok, 'import inválido deveria falhar');
  console.log('  Salvamento: roundtrip, exportação e rejeição de dados inválidos OK');
}
function testOfflineOnce(S) {
  const a = clone(S); a.lastTick = Date.now() - 3600 * 1000;
  const now = Date.now(); const r1 = E.applyOffline(a, now); const r2 = E.applyOffline(a, now);
  assert(r1 && r1.used > 3500 && r2 === null, 'intervalo offline concedido mais de uma vez');
  const c = clone(S); c.lastTick = Date.now() - 48 * 3600 * 1000; const r3 = E.applyOffline(c, Date.now());
  assert(Math.abs(r3.used - E.offlineCapSec(c)) < 1, 'limite offline não aplicado');
  console.log('  Offline: concedido uma vez; limite de ' + F.t(E.offlineCapSec(c)) + ' respeitado; relatório com ' + Object.keys(r1.prod).length + ' recursos');
}
function testMultipliers() {
  const S = E.newState(); const reg = S.run.regions.lua;
  E.recruit(S, 'iris'); reg.b.extrator.n = 1; reg.st.metal = 0; reg.b.refinaria.pause = true;
  let m = E.mods(S); assert(m.speed.extract === 2, 'Íris nível 1 deveria dar ×2');
  S.perm.specs.iris.lvl = 2; m = E.mods(S); assert(m.speed.extract === 4, 'Íris nível 2 deveria dar ×4');
  S.perm.specs.iris.lvl = 3; m = E.mods(S); assert(m.speed.extract === 8, 'Íris nível 3 deveria dar ×8');
  // ×4 = 4 vezes mais ciclos no mesmo tempo
  S.perm.specs.iris.lvl = 2; reg.st.ore = 0; reg.b.armazem = { n: 30, lvl: 1, p: 0 };
  const before = reg.stats.cycles.extrator || 0; for (let i = 0; i < 120; i++) E.tick(S, 0.25);
  const cyc = (reg.stats.cycles.extrator || 0) - before;
  assert(Math.abs(cyc - 30 * 4 / 3) <= 1.01, '×4 deveria render ~40 ciclos em 30s (obtido ' + cyc + ')');
  console.log('  Multiplicadores: ×2/×4/×8 por nível e ' + Math.round(cyc) + ' ciclos em 30s com ×4 (base 3s) OK');
}
function testCollapse(S) {
  const before = { data: S.perm.data, specs: JSON.stringify(S.perm.specs), research: JSON.stringify(S.perm.research), frags: S.perm.frags };
  const offer = E.collapseOffer(S); assert(offer.length >= 3, 'deveria oferecer 3 destinos');
  const fc = E.fragCalc(S);
  const r = E.doCollapse(S, offer[0]); assert(r.ok, 'colapso falhou: ' + r.err);
  assert(S.perm.frags === before.frags + fc.total, 'fragmentos incorretos');
  assert(S.perm.data >= before.data, 'dados de pesquisa perdidos');
  const sp = JSON.parse(before.specs); for (const k in sp) assert(S.perm.specs[k] && S.perm.specs[k].lvl === sp[k].lvl, 'nível de especialista perdido: ' + k);
  assert(JSON.stringify(S.perm.research) === before.research, 'pesquisa perdida');
  assert(S.run.dyson.stage === 0 && S.run.routes.length === 0 && !S.run.regions.marte.unlocked && S.run.regions.lua.phase === 0, 'universo não reiniciou');
  assert(S.run.universe === offer[0], 'universo escolhido não aplicado');
  assert(S.perm.specs.eco, 'Eco deveria ser concedido no primeiro Colapso');
  const re = E.deserialize(E.serialize(S)); assert(re.ok && re.S.run.universe === offer[0], 'universo não persistiu no salvamento');
  console.log('  Colapso: +' + fc.total + ' fragmentos (produção ' + fc.prod + ', regiões ' + fc.regions + ', Dyson ' + fc.stages + ', núcleo ' + fc.core + '); preservação e reinício OK → ' + D.universes[offer[0]].name);
  return offer[0];
}
function staticChecks() {
  // nenhuma instalação exige exclusivamente um material que só ela produz
  for (const rid of RO) for (const b in D.regions[rid].build) {
    const def = D.buildings[b];
    for (const r in def.cost) if (def.out && def.out[r]) {
      const other = Object.keys(D.regions[rid].build).some((o) => o !== b && D.buildings[o].out && D.buildings[o].out[r]);
      const start = (D.regions[rid].start.st[r] || 0) >= def.cost[r] * Math.pow(def.g, D.regions[rid].start.b[b] || 0);
      assert(other || start || (D.regions[rid].start.b[b] || 0) > 0, rid + ': ' + b + ' exige ' + r + ' que só ele produz');
    }
  }
  // cada custo/insumo/missão precisa de material obtenível naquela fase (local ou importável de regiões anteriores)
  const imported = new Set();
  RO.forEach((rid, i) => {
    const R = D.regions[rid];
    R.phases.forEach((ph, p) => {
      const avail = Object.keys(R.build).filter((b) => { const v = R.build[b]; return typeof v === 'number' ? v <= p : RO.indexOf(v) < i; });
      const local = new Set(); avail.forEach((b) => { for (const r in (D.buildings[b].out || {})) local.add(r); });
      const ok = (r) => local.has(r) || (i > 0 && imported.has(r));
      for (const b of avail) {
        const def = D.buildings[b];
        for (const r in def.cost) assert(ok(r) || (R.start.b[b] && (R.start.st[r] || 0) > 0), `${rid} fase ${p}: ${b} custa ${r}, indisponível`);
        for (const r in (def.in || {})) assert(ok(r), `${rid} fase ${p}: ${b} consome ${r}, indisponível`);
      }
      for (const md of ph.missions) {
        if (md.t === 'level') for (const [r, , from] of D.buildings[md.b].up) if (from < md.n) assert(ok(r), `${rid} fase ${p}: missão nível ${md.b} ${md.n} exige ${r}`);
        if (md.t === 'pay') for (const r in md.cost) assert(ok(r), `${rid} fase ${p}: pagamento exige ${r}`);
        if (md.t === 'build') assert(avail.includes(md.b), `${rid} fase ${p}: missão constrói ${md.b} indisponível`);
        if (md.t === 'prod' || md.t === 'deliver') assert(ok(md.r) || md.t === 'deliver' && imported.has(md.r), `${rid} fase ${p}: missão de ${md.r} impossível`);
        if (md.t === 'deliver') assert(md.r === 'fuel' || avail.some((b) => D.buildings[b].in && D.buildings[b].in[md.r]), `${rid} fase ${p}: entrega de ${md.r} sem consumo local (o estoque encheria)`);
        if (md.t === 'dyson') for (const r in D.dyson[md.n - 1]) assert(ok(r) || imported.has(r), `${rid}: Dyson ${md.n} exige ${r}`);
      }
    });
    const next = RO[i + 1];
    Object.keys(R.build).forEach((b) => { for (const r in (D.buildings[b].out || {})) imported.add(r); });
    if (next) for (const r in D.regions[next].launch.cost) assert(imported.has(r), `lançamento de ${next} exige ${r}`);
  });
  console.log('  Verificação estática de dependências (custos, insumos, missões, lançamentos) concluída');
}

(function main() {
if (process.env.BOT_LIB) { module.exports = { botStep, E, D, F }; return; }
const uni = process.argv[2] || 'padrao'; const maxH = +(process.argv[3] || 30);
console.log('HELIOS IDLE — bot de teste');
fails += require('./regress.js').run({ botStep }); // regressões do motor e das abas
staticChecks();
testMultipliers();
const S = E.newState(); S.run.universe = uni; S.lastTick = Date.now();
const ok = playUniverse(S, maxH, 'Universo 1');
// testes intermediários com estado avançado
testOfflineConsistency(S);
testSave(S);
testOfflineOnce(S);
if (ok) {
  const next = testCollapse(S);
  const ok2 = playUniverse(S, maxH, 'Universo 2');
  assert(ok2, 'segundo universo não chegou ao Colapso');
  if (ok2) { const fc = E.fragCalc(S); console.log('  Fragmentos no 2º colapso: ' + fc.total); }
} else assert(false, 'primeiro universo não chegou ao Colapso');
console.log('\n' + (fails ? fails + ' falha(s)' : 'Todos os testes passaram.'));
process.exit(fails ? 1 : 0);

})();
