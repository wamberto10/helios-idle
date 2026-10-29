/* HELIOS IDLE — testes de regressão do motor e da coordenação entre abas (Node, sem navegador).
   Uso: node tools/regress.js   (também roda no início de node tools/bot.js)
   Cada teste usa estados próprios em memória; nenhum salvamento pessoal é lido ou gravado. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
if (!globalThis.H || !globalThis.H.E) {
  globalThis.H = {};
  for (const f of ['data.js', 'engine.js', 'session.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
} else if (!globalThis.H.makeSession) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'session.js'), 'utf8'), { filename: 'session.js' });
const { DATA: D, E } = H;
const RO = D.regionOrder;

let fails = 0, count = 0;
const assert = (c, msg) => { count++; if (!c) { fails++; console.log('  ✗ FALHA: ' + msg); } };
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6) * Math.max(1, Math.abs(a), Math.abs(b));
const clone = (S) => { const r = E.deserialize(E.serialize(S)); if (!r.ok) throw new Error('clone: ' + r.err); return r.S; };
const fresh = () => { const S = E.newState(); S.events = []; S.lastTick = Date.now(); return S; };
const section = (t) => console.log('  · ' + t);

// =============== 1. IMPORTAÇÃO ===============
function testImport() {
  section('Importação válida, inválida e com campos ausentes');
  const base = fresh(); E.recruit(base, 'iris'); base.run.regions.lua.st.ore = 50;
  const good = JSON.parse(E.serialize(base));
  const tryIt = (mut, label, expectOk) => {
    const o = JSON.parse(JSON.stringify(good)); mut(o);
    let r; try { r = E.importStr('HELIOS1:' + Buffer.from(JSON.stringify(o), 'utf8').toString('base64')); } catch (e) { assert(false, label + ': importStr lançou exceção ' + e.message); return; }
    if (expectOk) {
      assert(r.ok, label + ': deveria aceitar (' + r.err + ')');
      if (r.ok) { try { for (let i = 0; i < 20; i++) E.tick(r.S, 0.5); } catch (e) { assert(false, label + ': aceito mas o motor falhou: ' + e.message); } }
    } else {
      assert(!r.ok, label + ': deveria rejeitar');
      if (!r.ok) assert(typeof r.err === 'string' && r.err.length > 10 && !/undefined|null\b/.test(r.err.replace(/“[^”]*”/g, '')), label + ': mensagem pouco clara: ' + r.err);
    }
  };
  tryIt(() => {}, 'salvamento válido', true);
  tryIt((o) => { o.perm.specs.iris = null; }, 'perm.specs.iris = null', false);
  tryIt((o) => { o.run.routes = {}; }, 'run.routes como objeto', false);
  tryIt((o) => { o.run.regions = null; }, 'run.regions = null', false);
  tryIt((o) => { o.run.regions.lua.b.extrator = null; }, 'instalação = null', false);
  tryIt((o) => { o.run.regions.lua.b.foguete = { n: 1, lvl: 1 }; }, 'instalação desconhecida', false);
  tryIt((o) => { o.run.regions.lua.b.extrator.lvl = 999; }, 'nível fora do limite', false);
  tryIt((o) => { o.run.regions.lua.b.extrator.n = 'muitos'; }, 'quantidade não numérica', false);
  tryIt((o) => { o.perm.specs.iris.lvl = 0; }, 'nível de especialista 0', false);
  tryIt((o) => { o.run.routes = [{ id: 1, from: 'lua', to: 'plutao', res: ['metal'] }]; }, 'rota para região desconhecida', false);
  tryIt((o) => { o.run.routes = [{ id: 1, from: 'lua', to: 'marte', res: ['metal'], st: 'voando' }]; }, 'estado de rota desconhecido', false);
  tryIt((o) => { o.run.routes = [{ id: 1, from: 'lua', to: 'marte', res: ['metal'], cargo: [] }]; }, 'carga como lista', false);
  tryIt((o) => { o.run.exps = [{ id: 'inexistente', uid: 1, end: 5, dur: 5, bonus: [] }]; }, 'expedição desconhecida', false);
  tryIt((o) => { o.perm.chests = [{ id: 1, cards: 'x' }]; }, 'cartas do baú inválidas', false);
  tryIt((o) => { o.run.dyson = { stage: 50 }; }, 'etapa do Dyson fora do limite', false);
  tryIt((o) => { o.run.universe = 'espelho'; }, 'universo desconhecido', false);
  tryIt((o) => { o.v = 99; }, 'versão futura', false);
  tryIt((o) => { delete o.run.dirs; delete o.run.log; delete o.perm.ach; delete o.settings; delete o.run.counters; delete o.run.regions.venus; }, 'campos opcionais ausentes', true);
  tryIt((o) => { o.run.regions.lua.st.ore = -40; o.run.regions.lua.st.metal = null; o.run.regions.lua.st.unobtainium = 5; o.settings.sound = 'sim'; }, 'valores corrigíveis (negativo, nulo, recurso desconhecido, ajuste inválido)', true);
  assert(!E.importStr('').ok && !E.importStr('lixo').ok && !E.importStr('HELIOS1:@@@').ok && !E.importStr('{"a":1}').ok && !E.importStr('null').ok && !E.importStr('[]').ok, 'textos inválidos deveriam ser rejeitados');
  // varredura: trocar campos aleatórios por valores estranhos nunca derruba o jogo
  const paths = []; (function walk(o, p) { for (const k in o) { const v = o[k]; paths.push(p.concat(k)); if (v && typeof v === 'object' && p.length < 6) walk(v, p.concat(k)); } })(good, []);
  const weird = [null, [], {}, 'x', -1, 1e308, true, 0.5];
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let crashes = 0, accepted = 0;
  for (let i = 0; i < 600; i++) {
    const o = JSON.parse(JSON.stringify(good)); const p = paths[Math.floor(rnd() * paths.length)];
    let t = o; for (let j = 0; j < p.length - 1; j++) t = t[p[j]]; t[p[p.length - 1]] = weird[Math.floor(rnd() * weird.length)];
    try { const r = E.deserialize(JSON.stringify(o)); if (r.ok) { accepted++; E.tick(r.S, 1); E.tick(r.S, 30); E.serialize(r.S); } } catch (e) { crashes++; if (crashes < 4) console.log('    falha com ' + p.join('.') + ': ' + e.message); }
  }
  assert(crashes === 0, 'varredura de 600 salvamentos alterados: ' + crashes + ' derrubaram o jogo');
  console.log('    varredura: 600 salvamentos alterados, ' + accepted + ' aceitos com correção segura, 0 exceções');
}

// =============== 2. MIGRAÇÃO ===============
function testMigration() {
  section('Migração v1 → v2 (ciclo manual em andamento)');
  const S = fresh(); const lua = S.run.regions.lua; lua.st.ore = 40; lua.st.metal = 0;
  const o = JSON.parse(E.serialize(S)); o.v = 1; delete o.rev;
  const rb = o.run.regions.lua.b.refinaria; rb.n = 2; rb.on = true; rb.p = 0.5; delete rb.mc; // formato antigo: sem registro do ciclo
  const r = E.deserialize(JSON.stringify(o));
  assert(r.ok && r.from === 1, 'salvamento v1 deveria carregar e migrar (' + r.err + ')');
  if (!r.ok) return;
  const b = r.S.run.regions.lua.b.refinaria;
  assert(b.mc && b.mc.n === 2 && b.mc.lvl === 1, 'migração deveria registrar as máquinas do ciclo');
  const m0 = r.S.run.regions.lua.st.metal || 0; const ore0 = r.S.run.regions.lua.st.ore;
  for (let i = 0; i < 40; i++) E.tick(r.S, 0.25);
  const per = D.buildings.refinaria.out.metal * 2;
  assert(near((r.S.run.regions.lua.st.metal || 0) - m0, per), 'ciclo migrado deveria entregar uma vez (' + ((r.S.run.regions.lua.st.metal || 0) - m0) + ' ≠ ' + per + ')');
  assert(r.S.run.regions.lua.st.ore === ore0, 'ciclo migrado não deveria cobrar insumos de novo');
  assert(JSON.parse(E.serialize(r.S)).v === D.SAVE_VERSION, 'regravação deveria usar a versão atual');
  assert(E.peekRev(E.serialize(r.S)) === 0 && E.peekRev(JSON.stringify(o)) === 0, 'revisão de salvamento antigo deveria ser 0');
}

// =============== 3. CICLOS MANUAIS ===============
function testManual() {
  section('Ciclos manuais: construção, melhoria, especialista, salvamento e armazenamento cheio');
  const per = D.buildings.refinaria.out.metal, inn = D.buildings.refinaria.in.ore;
  const setup = () => { const S = fresh(); const L = S.run.regions.lua; L.b.extrator.n = 0; L.b.painel.n = 4; L.b.armazem = { n: 10, lvl: 1, p: 0, on: false, pause: false, why: '', blk: false }; L.st.ore = 100; L.st.metal = 200; L.st.alloy = 200; return { S, L }; };
  const run = (S, sec) => { for (let i = 0; i < sec * 10; i++) E.tick(S, 0.1); };
  { // construir durante o ciclo
    const { S, L } = setup(); assert(E.operate(S, 'lua', 'refinaria').ok, 'operar refinaria');
    assert(near(L.st.ore, 100 - inn), 'operar deveria cobrar ' + inn + ' minérios');
    const m0 = L.st.metal; assert(E.build(S, 'lua', 'refinaria').ok, 'construir 2ª refinaria'); const paid = m0 - L.st.metal;
    run(S, 10); assert(near(L.st.metal - (m0 - paid), per), 'construção durante o ciclo: entrega deveria ser ' + per + ', foi ' + (L.st.metal - (m0 - paid)));
    assert(!L.b.refinaria.on && L.stats.cycles.refinaria === 1, 'ciclo concluído exatamente uma vez');
    const ore1 = L.st.ore; assert(E.operate(S, 'lua', 'refinaria').ok && near(ore1 - L.st.ore, inn * 2), 'ciclo seguinte usa as 2 máquinas');
    const m1 = L.st.metal; run(S, 10); assert(near(L.st.metal - m1, per * 2), 'ciclo seguinte entrega para 2 máquinas');
  }
  { // melhorar durante o ciclo
    const { S, L } = setup(); L.st.metal = 500; E.operate(S, 'lua', 'refinaria');
    const c = E.uCost(S, 'lua', 'refinaria'); for (const r in c) L.st[r] = Math.max(L.st[r] || 0, c[r] + 50);
    const before = Object.assign({}, L.st); assert(E.upgrade(S, 'lua', 'refinaria').ok, 'melhorar refinaria');
    const m0 = L.st.metal; run(S, 10); assert(near(L.st.metal - m0, per * D.levelYield(1)), 'melhoria durante o ciclo vale a partir do próximo');
    void before;
  }
  { // especialista recrutado durante o ciclo: termina o manual uma vez e segue automático
    const { S, L } = setup(); L.st.ore = 20; E.operate(S, 'lua', 'refinaria'); E.recruit(S, 'vulcano'); S.events = [];
    const ore0 = L.st.ore, m0 = L.st.metal; run(S, 30);
    const cyc = L.stats.cycles.refinaria; const autoC = cyc - 1; const usedOre = ore0 - L.st.ore;
    assert(near(usedOre, autoC * inn, 1e-6), 'após o recrutamento, minério gasto = ciclos automáticos × receita');
    assert(near(L.st.metal - m0, cyc * per, 1e-6), 'metal = ciclo manual + automáticos, sem duplicar (' + (L.st.metal - m0) + ' vs ' + cyc * per + ')');
  }
  { // salvar e carregar no meio do ciclo
    const { S, L } = setup(); E.operate(S, 'lua', 'refinaria'); run(S, 1); E.build(S, 'lua', 'refinaria');
    const T = clone(S); const m0 = T.run.regions.lua.st.metal, o0 = T.run.regions.lua.st.ore;
    assert(T.run.regions.lua.b.refinaria.mc && T.run.regions.lua.b.refinaria.mc.n === 1, 'ciclo salvo preserva as máquinas pagas');
    run(T, 10); assert(near(T.run.regions.lua.st.metal - m0, per) && T.run.regions.lua.st.ore === o0, 'ciclo carregado conclui uma vez, sem nova cobrança');
    void L;
  }
  { // armazenamento cheio: o produto espera (não desaparece)
    const { S, L } = setup(); const cap = E.cap(S, 'lua', 'metal'); E.operate(S, 'lua', 'refinaria'); L.st.metal = cap;
    run(S, 10); const bs = L.b.refinaria;
    assert(bs.on && E.manualWaiting(bs) && bs.why === 'full:metal', 'com estoque cheio o ciclo aguarda espaço');
    assert(E.regionEnergy(S, 'lua', E.mods(S)).use === 0, 'ciclo parado aguardando espaço não consome energia');
    L.st.metal = cap - 1; run(S, 1); assert(bs.on && near(L.st.metal, cap), 'entrega parcial do que couber');
    L.st.metal = 0; run(S, 1); assert(!bs.on && near(L.st.metal, per - 1), 'restante entregue quando houver espaço (total = ' + per + ')');
    assert(L.stats.cycles.refinaria === 1 && near(L.stats.prod.metal, per), 'produção registrada apenas do que foi entregue, uma vez');
  }
}

// =============== 4. PRODUÇÃO ===============
function testProduction() {
  section('Produção: passos diferentes, estoques intermediários cheios e conservação');
  const mk = () => { const S = fresh(); E.recruit(S, 'iris'); E.recruit(S, 'vulcano'); S.events = []; const L = S.run.regions.lua; L.st.ore = 200; L.st.metal = 0; return S; };
  const a = mk(), b = mk(), c = mk();
  E.tick(a, 1); for (let i = 0; i < 10; i++) E.tick(b, 0.1); for (let i = 0; i < 100; i++) E.tick(c, 0.01);
  const La = a.run.regions.lua, Lb = b.run.regions.lua, Lc = c.run.regions.lua;
  assert(near(La.st.ore, Lb.st.ore) && near(La.st.ore, Lc.st.ore), 'minério deveria ser igual com passos de 1s, 0,1s e 0,01s (' + [La.st.ore, Lb.st.ore, Lc.st.ore].join(', ') + ')');
  assert(near(La.st.metal, Lb.st.metal) && near(La.stats.prod.ore, Lb.stats.prod.ore) && near(La.stats.prod.ore, Lc.stats.prod.ore), 'metal e produção registrada deveriam ser iguais em todos os passos');
  assert(near(La.st.ore, 200), 'minério cheio consumido e reposto no mesmo passo: nada some (' + La.st.ore + ')');
  // conservação: Δminério = produzido − consumido pela receita
  const S = mk(); const L = S.run.regions.lua; for (let i = 0; i < 600; i++) E.tick(S, 0.37);
  const consumed = L.stats.cycles.refinaria * D.buildings.refinaria.in.ore;
  assert(near(L.st.ore, 200 + L.stats.prod.ore - consumed, 1e-6), 'conservação do minério (estoque = inicial + produzido − consumido)');
  assert(near(L.st.metal, L.stats.prod.metal, 1e-6), 'metal em estoque = metal produzido');
  // estoque intermediário cheio com exportação desligada: quem produz pausa, nada é descontado sem registro
  const T = mk(); const LT = T.run.regions.lua; LT.st.metal = E.cap(T, 'lua', 'metal');
  const ore0 = LT.st.ore; for (let i = 0; i < 50; i++) E.tick(T, 0.2);
  assert(near(LT.st.ore, Math.min(E.cap(T, 'lua', 'ore'), ore0 + (LT.stats.prod.ore || 0) - (LT.stats.cycles.refinaria || 0) * D.buildings.refinaria.in.ore)), 'metal cheio: refinaria pausa sem consumir minério à toa');
  assert(LT.b.refinaria.why === 'full:metal', 'motivo de parada: armazenamento cheio');
  // exportação ligada: produção continua e conta como produzida
  E.toggleExport(T, 'lua', 'metal'); const p0 = LT.stats.prod.metal || 0; for (let i = 0; i < 50; i++) E.tick(T, 0.2);
  assert((LT.stats.prod.metal || 0) > p0 && near(LT.st.metal, E.cap(T, 'lua', 'metal')), 'exportação: produção continua com estoque cheio');
  // estado avançado: online × offline × passos grandes
  const B = { botStep: OPTS.botStep || (process.env.BOT_LIB = '1', require('./bot.js').botStep) };
  const A = fresh(); for (let i = 0; i < 2700; i++) { E.tick(A, 1); E.tick(A, 1); B.botStep(A); }
  const x = clone(A), y = clone(A), z = clone(A); for (const s of [x, y, z]) s.run.routes = [];
  for (let i = 0; i < 6000; i++) E.tick(x, 0.1); E.simulate(y, 600); for (let i = 0; i < 20; i++) E.tick(z, 30);
  let worst = 0, wr = '';
  for (const rid of RO) { if (!A.run.regions[rid].unlocked) continue; for (const r in x.run.regions[rid].stats.prod) {
    const p0 = A.run.regions[rid].stats.prod[r] || 0; const px = x.run.regions[rid].stats.prod[r] - p0;
    if (px < 20) continue;
    for (const o of [y, z]) { const d = Math.abs(px - (o.run.regions[rid].stats.prod[r] - p0)) / px; if (d > worst) { worst = d; wr = rid + '.' + r; } }
  } }
  assert(worst < 0.02, 'estado avançado: produção por recurso diverge ' + (worst * 100).toFixed(2) + '% em ' + wr);
  console.log('    estado avançado (' + Object.keys(A.perm.specs).length + ' especialistas): passos de 0,1s × offline × 30s, maior diferença ' + (worst * 100).toFixed(2) + '% ' + wr);
  const t0 = Date.now(); const w = clone(A); E.simulate(w, 8 * 3600); const ms = Date.now() - t0;
  assert(ms < 4000, 'simulação offline de 8h deveria levar menos de 4s (levou ' + ms + 'ms)');
  console.log('    desempenho: 8h offline simuladas em ' + ms + 'ms');
}

// =============== 5. ROTAS ===============
function testRoutes() {
  section('Rotas: várias ao mesmo tempo, destino cheio, entrega parcial, recarga e Colapso');
  const setup = () => {
    const S = fresh(); E.unlockRegion(S, 'marte'); S.events = [];
    for (const rid of ['lua', 'marte']) { const g = S.run.regions[rid]; for (const b in g.b) g.b[b].n = 0; g.st = {}; }
    S.run.regions.lua.st.ore = 300; S.run.regions.lua.st.fuel = 200; S.run.regions.lua.st.alloy = 500; S.perm.specs.vega = { lvl: 1, cards: 0 };
    return S;
  };
  const total = (S) => S.run.regions.lua.st.ore + (S.run.regions.marte.st.ore || 0) + S.run.routes.reduce((a, rt) => a + (rt.cargo.ore || 0), 0);
  { // duas rotas para um destino quase cheio: reserva de capacidade
    const S = setup(); const M = S.run.regions.marte; const cap = E.cap(S, 'marte', 'ore'); M.st.ore = cap - 20;
    const r1 = E.createRoute(S, 'lua', 'marte', ['ore']).rt, r2 = E.createRoute(S, 'lua', 'marte', ['ore']).rt;
    r1.auto = r2.auto = false; const t0 = total(S);
    assert(E.sendRoute(S, r1.id).ok && r1.cargo.ore === 20, '1ª rota leva só o espaço livre (20)');
    const s2 = E.sendRoute(S, r2.id); assert(!s2.ok && r2.why === 'destfull', '2ª rota não embarca: espaço já reservado');
    assert(near(S.run.regions.lua.st.ore, 280), 'origem perde só o que embarcou (20)');
    for (let i = 0; i < 400; i++) E.tick(S, 0.25);
    assert(near(M.st.ore, cap) && near(total(S), t0), 'destino recebe 20; minério total conservado');
    assert(M.stats.deliv.ore === 20 && r1.trips === 1, 'entrega e viagem contadas uma vez');
  }
  { // produção local durante a viagem respeita a reserva
    const S = setup(); const M = S.run.regions.marte; M.b.extrator = { n: 3, lvl: 1, p: 0, on: false, pause: false, why: '', blk: false }; M.b.painel = { n: 6, lvl: 1, p: 0, on: false, pause: false, why: '', blk: false };
    E.recruit(S, 'iris'); S.events = []; const cap = E.cap(S, 'marte', 'ore'); M.st.ore = cap - 60;
    const rt = E.createRoute(S, 'lua', 'marte', ['ore']).rt; rt.auto = false; E.sendRoute(S, rt.id);
    for (let i = 0; i < 400; i++) E.tick(S, 0.25);
    assert(M.stats.deliv.ore === 20 && rt.st !== 'wait' && M.stats.prod.ore > 0, 'carga reservada entregue integralmente mesmo com produção local');
    assert(near(M.st.ore, cap), 'estoque termina no limite, sem estourar');
  }
  { // destino cheio na chegada (sem reserva possível): carga espera a bordo, salva/carrega, descarrega depois
    const S = setup(); const M = S.run.regions.marte; const cap = E.cap(S, 'marte', 'ore');
    const rt = E.createRoute(S, 'lua', 'marte', ['ore']).rt; rt.auto = false; E.sendRoute(S, rt.id); const load = rt.cargo.ore;
    M.st.ore = cap - 5; const t0 = total(S); // espaço ocupado por fora durante a viagem
    for (let i = 0; i < 400; i++) E.tick(S, 0.25);
    assert(rt.st === 'wait' && near(rt.cargo.ore, load - 5) && near(M.st.ore, cap), 'entrega parcial: 5 descarregados, restante a bordo');
    assert(M.stats.deliv.ore === 5 && E.routeWhyText(rt.why) === 'Aguardando espaço no destino', 'só a parte descarregada conta; estado explicado');
    assert(near(total(S), t0), 'carga conservada enquanto espera');
    const T = clone(S); const rt2 = T.run.routes[0]; assert(rt2.st === 'wait' && near(rt2.cargo.ore, load - 5), 'carga pendente preservada ao salvar e carregar');
    T.run.regions.marte.st.ore = 0; for (let i = 0; i < 400; i++) E.tick(T, 0.25);
    assert(near(T.run.regions.marte.stats.deliv.ore, load) && rt2.trips === 1 && !rt2.cargo.ore, 'retoma sozinho quando há espaço; viagem contada uma vez');
  }
  { // desmontar com carga a bordo: destino, depois origem, perda informada antes
    const S = setup(); const M = S.run.regions.marte; const L = S.run.regions.lua;
    const rt = E.createRoute(S, 'lua', 'marte', ['ore']).rt; rt.auto = false; E.sendRoute(S, rt.id); const load = rt.cargo.ore;
    M.st.ore = E.cap(S, 'marte', 'ore') - 4; L.st.ore = E.cap(S, 'lua', 'ore') - 6;
    const pv = E.removePreview(S, rt.id);
    assert(pv.toDest.ore === 4 && pv.toOrigin.ore === 6 && near(pv.lost.ore, load - 10), 'prévia de desmontagem mostra destino, origem e excedente');
    const r = E.removeRoute(S, rt.id); assert(r.ok && S.run.routes.length === 0 && near(M.st.ore, E.cap(S, 'marte', 'ore')), 'desmontagem aplica a prévia');
  }
  { // Colapso com carga a bordo: não volta a ser creditada no novo universo
    const S = setup(); const rt = E.createRoute(S, 'lua', 'marte', ['ore']).rt; rt.auto = false; E.sendRoute(S, rt.id);
    for (const r of RO) { if (!S.run.regions[r].unlocked) E.unlockRegion(S, r); S.run.regions[r].phase = D.regions[r].phases.length; }
    S.run.dyson.stage = D.dysonRequired; S.run.core = true; S.events = [];
    const res = E.doCollapse(S, E.collapseOffer(S)[0]);
    assert(res.ok && res.sum.cargo > 0, 'Colapso informa a carga a bordo');
    assert(S.run.routes.length === 0 && !(S.run.regions.marte.st.ore > 0), 'carga do universo anterior não é creditada depois do reinício');
    for (let i = 0; i < 100; i++) E.tick(S, 1);
    assert(!(S.run.regions.marte.stats.deliv.ore > 0), 'nenhuma entrega tardia no novo universo');
  }
}

// =============== 6. ABAS E ARMAZENAMENTO ===============
function testSessions() {
  section('Abas: uma gravadora, posse, aba antiga, travamento e offline único');
  const mem = {}; let failMode = null;
  const raw = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { if (failMode && !k.endsWith('_lock')) { const e = new Error('falha'); e.name = failMode; throw e; } mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
  const store = H.safeStorage(() => raw);
  let clock = 1e12; const now = () => clock;
  const tab = (id) => H.makeSession({ storage: store, key: 'helios_teste', now, id, ttl: 6000 });
  const A = tab('A'), B = tab('B');
  const SA = fresh();
  assert(A.claim(false) && A.confirm(), 'A assume a partida');
  assert(!B.claim(false) && B.lockState() === 'other', 'B fica em modo de leitura');
  SA.data = 0; let r = A.write(SA); assert(r.ok && A.rev === 1 && E.peekRev(mem.helios_teste) === 1, 'A grava revisão 1');
  const SB = clone(SA); r = B.write(SB); assert(!r.ok && r.status === 'readonly' && E.peekRev(mem.helios_teste) === 1, 'B (leitura) não grava');
  // avançar em A e fechar B: B nunca grava, mesmo "ao fechar"
  SA.perm.data = 500; A.write(SA); B.release(); r = B.write(SB);
  assert(!r.ok && JSON.parse(mem.helios_teste).perm.data === 500, 'fechar B não sobrescreve o avanço de A');
  // assumir em B: carrega o mais recente; A percebe e para de gravar
  clock += 1000; B.requestRelease(); assert(A.isReleaseRequest(mem.helios_teste_req) && !B.isReleaseRequest(mem.helios_teste_req), 'pedido de liberação identificado pela gravadora');
  A.write(SA); A.release(); assert(B.lockState() === 'free' && B.claim(false), 'A libera e B assume');
  const L = E.deserialize(mem.helios_teste); B.rev = L.S.rev; assert(L.S.perm.data === 500, 'B carrega o estado mais recente');
  SA.perm.data = 1; r = A.write(SA); assert(!r.ok && JSON.parse(mem.helios_teste).perm.data === 500, 'A antiga não grava depois de perder a posse');
  // posse tomada à força (A não respondeu): A detecta no heartbeat
  const C = tab('C'); assert(C.claim(true), 'C toma a posse à força'); let lostWhy = null;
  const A2 = H.makeSession({ storage: store, key: 'helios_teste', now, id: 'B', onLost: (w) => { lostWhy = w; } }); A2.role = 'writer'; A2.rev = B.rev; A2.heartbeat();
  assert(A2.role === 'passive' && lostWhy === 'taken', 'aba que perdeu a posse vira leitura');
  // aba desatualizada: revisão gravada maior que a sua
  const SC = clone(L.S); C.rev = L.S.rev; assert(C.write(SC).ok, 'C grava');
  const D2 = tab('D'); D2.role = 'writer'; D2.rev = 0; r = D2.write(SC); assert(!r.ok && (r.status === 'stale' || r.status === 'readonly'), 'aba com revisão antiga não grava');
  // travamento: sem heartbeat por mais que ttl, outra aba pode assumir
  clock += 7000; const E2 = tab('E'); assert(E2.lockState() === 'stale' && E2.claim(false), 'aba travada: posse expira e outra assume');
  // importar em A e recuperar foco em B: B (leitura) não grava nada
  const before = mem.helios_teste; const F2 = tab('F'); F2.heartbeat(); r = F2.write(SC); assert(!r.ok && mem.helios_teste === before, 'aba em leitura não grava ao recuperar o foco');
  // offline concedido uma vez entre abas
  const W = tab('W'); clock += 7000; const SO = fresh(); SO.lastTick = clock - 2 * 3600e3; W.claim(true); W.rev = E.peekRev(mem.helios_teste); W.write(SO);
  const rep1 = E.applyOffline(SO, clock); W.write(SO);
  const other = E.deserialize(mem.helios_teste).S; const rep2 = E.applyOffline(other, clock);
  assert(rep1 && rep1.used > 7000 && rep2 === null, 'o mesmo período offline não é creditado por uma segunda aba');
  // falhas de armazenamento
  section('Armazenamento: cheio, bloqueado e recuperação');
  failMode = 'QuotaExceededError'; const rv = W.rev; const SQ = clone(SO);
  r = W.write(SQ); assert(!r.ok && r.status === 'error' && r.reason === 'quota' && W.rev === rv && SQ.rev === rv, 'armazenamento cheio: erro explícito, revisão não avança');
  failMode = 'SecurityError'; r = W.write(SQ); assert(!r.ok && r.reason === 'blocked', 'armazenamento bloqueado: erro explícito');
  failMode = null; r = W.write(SQ); assert(r.ok && W.rev === rv + 1, 'recupera após falha temporária');
  const blocked = H.safeStorage(() => { throw new Error('bloqueado'); });
  assert(!blocked.available() && blocked.getItem('x') === null, 'acesso ao localStorage bloqueado não derruba o jogo');
  const Z = H.makeSession({ storage: blocked, key: 'k' }); assert(Z.claim(false), 'sem armazenamento a aba ainda joga');
  r = Z.write(fresh()); assert(!r.ok && r.reason === 'blocked', 'sem armazenamento: salvar informa bloqueio');
}

// =============== 7. EXPEDIÇÕES COM FRAGMENTO ===============
function testExpFrags() {
  section('Expedições com fragmento: no máximo 1 por expedição em cada universo');
  const S = fresh(); S.run = E.newRun(S, 'ancestral'); S.run.flags.expeditions = true;
  const go = (id, bonus) => { const uid = ++S.run.expSeq; S.run.exps.push({ id, uid, end: 0, dur: 1, bonus: bonus || [] }); return E.collectExp(S, uid, true); };
  const f0 = S.perm.fragsTotal;
  let r = go('ruinas');
  assert(r.ok && r.total.frags === 1 && S.perm.fragsTotal === f0 + 1, 'Ruínas: a primeira conclusão no universo dá 1 fragmento');
  assert(E.expFragDone(S, 'ruinas'), 'a conclusão fica registrada no universo');
  const d0 = S.perm.data; r = go('ruinas');
  assert(r.ok && r.total.frags === 0 && r.total.fragsDone === 1 && S.perm.fragsTotal === f0 + 1, 'Ruínas repetida: sem fragmento');
  assert(S.perm.data > d0 && Object.keys(r.total.cards).length > 0, 'Ruínas repetida: dados e cartas continuam');
  r = go('ruinas2', [{ frags: 1 }]); assert(r.total.frags === 1 && S.perm.fragsTotal === f0 + 2, 'Câmaras: o bônus de fragmento vale uma vez');
  r = go('ruinas2', [{ frags: 1 }]); assert(r.total.frags === 0 && S.perm.fragsTotal === f0 + 2, 'Câmaras: bônus de fragmento repetido não conta');
  r = go('ruinas2', []); assert(r.total.frags === 0 && !r.total.fragsDone, 'Câmaras sem bônus sorteado: nada a avisar');
  const C = clone(S); assert(E.expFragDone(C, 'ruinas') && E.expFragDone(C, 'ruinas2'), 'o registro sobrevive ao salvar e carregar');
  const kept = S.perm.frags; S.run = E.newRun(S, 'ancestral'); S.run.flags.expeditions = true;
  assert(!E.expFragDone(S, 'ruinas') && S.perm.frags === kept, 'novo universo: o fragmento volta a ser possível e os já ganhos são mantidos');
  r = go('ruinas'); assert(r.total.frags === 1, 'novo universo: primeira conclusão volta a dar 1 fragmento');
  const old = clone(S); delete old.run.flags['frag:ruinas']; const O = clone(old);
  assert(!E.expFragDone(O, 'ruinas') && O.perm.frags === S.perm.frags, 'salvamento antigo sem o registro carrega sem perder fragmentos');
}

// =============== 8. CIÊNCIA, DESCOBERTAS E RECOMPENSAS ===============
// Fixtures controladas (energia e materiais fornecidos): verificam regras, não tempo de campanha.
function withLua(S, b) { const L = S.run.regions.lua; L.phase = 3; Object.assign(L.b, b); L.b.painel = { n: 200, lvl: 1, p: 0 }; return L; }
function readyToCollapse(S) {
  for (const rid of RO) { const reg = S.run.regions[rid]; reg.unlocked = true; reg.phase = D.regions[rid].phases.length; }
  S.run.dyson.stage = D.dysonRequired; S.run.core = true;
}
function testScience() {
  section('Ciência: escala própria, dataGain único, manual = automático, fragmentos limitados');
  const S = fresh(); withLua(S, { observatorio: { n: 4, lvl: 5, p: 0 } });
  S.perm.specs.oraculo = { lvl: 10, cards: 0 }; let m = E.mods(S);
  const def = D.buildings.observatorio;
  assert(near(E.speedOf(def, m), D.science.oracleSpeed[10]), 'observatório usa a curva científica do Oráculo (×12), não a industrial (×96)');
  assert(near(E.speedOf(D.buildings.lab_anomalia, m), D.specSpeed[10]), 'Laboratório de Anomalia (matéria exótica) mantém a curva industrial');
  const rate = E.bRate(S, 'lua', 'observatorio', m);
  const expect = def.out.data * 4 * D.science.levelYield(5) * m.sciYield * m.dataGain * m.sciSpeed / def.t;
  assert(near(rate, expect), 'produção teórica = quantidade × nível científico × velocidade científica × dataGain (uma vez)');
  const d0 = S.perm.data; E.simulate(S, 600); assert(near(S.perm.data - d0, rate * 600, 1e-6), 'produção real em 10 min confere com a teórica (energia suficiente)');
  S.perm.fragsTotal = 1000; m = E.mods(S);
  assert(near(m.sciYield, 1 + D.science.fragBonusMax) && m.globalYield > 30, 'fragmentos: ciência limitada a +' + Math.round(D.science.fragBonusMax * 100) + '%, indústria mantém +3% por fragmento');
  S.perm.research.sg3 = 4; m = E.mods(S);
  assert(near(m.sciSpeed, D.science.oracleSpeed[10] * Math.sqrt(m.globalSpeed)), 'velocidade global entra pela raiz na ciência');
  // ciclo manual entrega o mesmo por ciclo que o automático
  const M = fresh(); withLua(M, { observatorio: { n: 2, lvl: 3, p: 0 } }); const mm = E.mods(M);
  const per = def.out.data * 2 * D.science.levelYield(3) * mm.sciYield * mm.dataGain;
  const dm = M.perm.data; assert(E.operate(M, 'lua', 'observatorio').ok, 'operar observatório manualmente');
  E.tick(M, def.t + 1); assert(near(M.perm.data - dm, per), 'ciclo manual entrega o produto de um ciclo (com dataGain uma vez)');
}
function testDiscoveries() {
  section('Descobertas: bloqueio no motor, marco único, herança no Colapso');
  const S = fresh(); S.perm.data = 1e7; S.perm.research = { ind1: 1, ind2: 1, en1: 1, min1: 1, min2: 1 };
  let r = E.buyResearch(S, 'ind3'); assert(!r.ok && /descoberta/.test(r.err) && !S.perm.research.ind3, 'pesquisa avançada sem descoberta é recusada pelo motor, com motivo');
  assert(E.resState(S, 'ind3').disc === 'componentes', 'estado da pesquisa informa a descoberta que falta');
  for (let i = 0; i < 3; i++) assert(E.buyResearch(S, 'en3').ok, 'Concentradores Solares nível ' + (i + 1) + ' livre');
  r = E.buyResearch(S, 'en3'); assert(!r.ok && S.perm.research.en3 === 3, 'níveis finais de Concentradores Solares exigem Engenharia solar orbital');
  for (const id of ['min1', 'ind1', 'en1', 'log1', 'exp1']) assert(!E.resDiscNeed(fresh(), id), 'primeira pesquisa ' + id + ' não exige descoberta');
  const md = D.regions.marte.phases[0].missions[4]; assert(md.rw.disc === 'componentes', 'marte.0.4 concede Engenharia de componentes');
  const pv = E.rewardPreview(S, 'marte', md.rw); assert(pv.disc === 'componentes' && !E.knows(S, 'componentes'), 'prévia anuncia a descoberta sem concedê-la');
  let got = E.grant(S, 'marte', md.rw, 'mission'); assert(got.disc === 'componentes' && E.knows(S, 'componentes'), 'resgate concede a descoberta');
  assert(E.buyResearch(S, 'ind3').ok, 'com a descoberta, a pesquisa pode ser comprada');
  const d0 = S.perm.data; got = E.grant(S, 'marte', md.rw, 'mission');
  assert(!got.disc && got.discKnown === 'componentes' && E.rewardPreview(S, 'marte', md.rw).discKnown === 'componentes', 'repetição anuncia “já conhecida” e não concede de novo');
  assert(S.perm.data - d0 === Math.round(md.rw.data * E.mods(S).dataGain), 'repetição mantém só os dados da missão');
  const C = fresh(); C.perm.disc.fusao = 1; readyToCollapse(C); E.doCollapse(C, E.collapseOffer(C)[0]);
  assert(E.knows(C, 'fusao'), 'descoberta sobrevive ao Colapso');
  const P = fresh(); readyToCollapse(P); P.run.regions.marte.phase = 0; P.run.regions.marte.stats.prod.comp = 999;
  for (let i = 0; i < 4; i++) P.run.missions['marte.0.' + i] = 1;
  const pend = E.collapsePending(P); assert(pend.missions.some((x) => x.x.id === 'marte.0.4'), 'marco concluído e não resgatado aparece como pendência do Colapso');
  const rc = E.doCollapse(P, E.collapseOffer(P)[0]); assert(E.knows(P, 'componentes') && rc.sum.disc.includes('componentes'), 'Colapso credita a descoberta pendente uma vez');
}
function testDiscMigration() {
  section('Migração v2 → v3: descobertas reconhecidas pelo histórico, sem ganhos extras');
  const mk = (fn) => { const S = fresh(); fn(S); const o = JSON.parse(E.serialize(S)); o.v = 2; delete o.perm.disc; return JSON.stringify(o); };
  let r = E.deserialize(mk((S) => { S.perm.collapses = 1; S.perm.data = 123; }));
  assert(r.ok && D.discOrder.every((d) => E.knows(r.S, d)) && r.S.perm.data === 123, 'save com Colapso anterior: todas as descobertas, saldo intacto');
  r = E.deserialize(mk((S) => { E.unlockRegion(S, 'marte', true); S.run.regions.marte.phase = 1; }));
  assert(r.ok && E.knows(r.S, 'componentes') && !E.knows(r.S, 'raros'), 'fase do marco concluída: só a descoberta correspondente');
  r = E.deserialize(mk((S) => { S.run.missions['cinturao.0.2'] = 1; }));
  assert(r.ok && E.knows(r.S, 'raros') && Object.keys(r.S.perm.disc).length === 1, 'marco resgatado: descoberta reconhecida');
  const raw = mk((S) => { S.perm.research = { en1: 5, en2: 5, en4: 2, ind1: 1, ind2: 1, ind3: 3 }; S.perm.data = 50; });
  r = E.deserialize(raw);
  assert(r.ok && r.S.perm.research.en4 === 2 && r.S.perm.research.ind3 === 3 && r.S.perm.research.en2 === 5, 'pesquisas já compradas são mantidas (nenhum nível retirado)');
  assert(E.knows(r.S, 'fusao') && E.knows(r.S, 'componentes') && E.knows(r.S, 'criogenia'), 'pesquisa avançada já comprada comprova a descoberta');
  const r2 = E.deserialize(E.serialize(r.S)); const r3 = E.deserialize(E.serialize(r2.S));
  assert(JSON.stringify(r3.S.perm.disc) === JSON.stringify(r.S.perm.disc) && r3.S.perm.data === 50, 'carregar várias vezes não muda descobertas nem saldo');
  r = E.deserialize(mk((S) => { S.perm.data = 1e9; }));
  assert(r.ok && Object.keys(r.S.perm.disc).length === 0, 'saldo alto sozinho não libera descobertas');
  const bad = JSON.parse(E.serialize(fresh())); bad.perm.disc = { inventada: 1, fusao: 'sim', raros: 0 };
  r = E.deserialize(JSON.stringify(bad)); assert(r.ok && !r.S.perm.disc.inventada && r.S.perm.disc.fusao === 1 && !r.S.perm.disc.raros, 'IDs desconhecidos descartados; valores normalizados');
  bad.perm.disc = 'tudo'; r = E.deserialize(JSON.stringify(bad)); assert(!r.ok, 'tipo inválido de descobertas é recusado sem exceção');
}
function testRewardPreview() {
  section('Prévia de recompensas = crédito real (missões, recrutamento, expedições)');
  const S = fresh(); S.perm.specs.oraculo = { lvl: 3, cards: 0 }; S.perm.research.exp4 = 2;
  const rw = { data: 100 }; const pv = E.rewardPreview(S, null, rw); const d0 = S.perm.data; const got = E.grant(S, null, rw, 'mission');
  assert(pv.data === got.data && got.data === S.perm.data - d0 && got.data === Math.round(100 * E.mods(S).dataGain) && got.data > 100, 'missão: anuncia e paga o valor com bônus (' + got.data + ')');
  const R = fresh(); let p = E.rewardPreview(R, null, { spec: 'iris' }); assert(p.spec === 'iris' && !p.specCard, 'recrutamento novo anunciado como recrutamento');
  E.grant(R, null, { spec: 'iris' }, 'mission'); p = E.rewardPreview(R, null, { spec: 'iris' });
  const g2 = E.grant(R, null, { spec: 'iris' }, 'mission');
  assert(p.specCard === 'iris' && g2.cards.iris === 1 && R.perm.specs.iris.cards === 1 && !g2.spec, 'recrutamento repetido: anuncia e informa +1 carta');
  const X = fresh(); X.run.flags.expeditions = true; X.perm.specs.iris = { lvl: 1, cards: 0 }; X.perm.specs.oraculo = { lvl: 4, cards: 0 }; X.perm.research.exp1 = 3;
  const xp = E.expPreview(X, 'insp_lua'); const uid = ++X.run.expSeq; X.run.exps.push({ id: 'insp_lua', uid, end: 0, dur: 1, bonus: [] });
  const dx = X.perm.data; const cx = X.perm.specs.iris.cards; const rx = E.collectExp(X, uid, true, true);
  assert(rx.total.data === xp.g.data && X.perm.data - dx === xp.g.data && X.perm.specs.iris.cards - cx === xp.g.cards.iris, 'expedição: prévia garantida = crédito (dados com expReward e dataGain, cartas)');
  const seq = X.perm.seq; E.expPreview(X, 'insp_lua'); assert(X.perm.seq === seq, 'prévia de expedição não consome sorteio');
  const A = fresh(); A.run = E.newRun(A, 'ancestral'); A.run.flags.expeditions = true;
  assert(E.expPreview(A, 'ruinas').g.frags === 1, 'Ruínas: prévia mostra o fragmento disponível');
  A.run.flags['frag:ruinas'] = true; const ap = E.expPreview(A, 'ruinas'); assert(ap.g.frags === 0 && ap.g.fragBlocked && A.run.flags['frag:ruinas'], 'Ruínas: prévia mostra o limite atingido sem alterá-lo');
  const C = fresh(); C.perm.specs.vega = { lvl: 1, cards: 0 }; const k = { cards: { vega: 4, ion: 3 }, cardsOwned: true };
  const cp = E.rewardPreview(C, null, k); const cg = E.grant(C, null, k, 'mission');
  assert(cp.cards.vega === 4 && !cp.cards.ion && cg.cards.vega === 4 && !C.perm.specs.ion, 'cartas de missão só para quem já está na tripulação (não recruta por carta)');
}
function testPendingSupplies() {
  section('Recompensa material com estoque cheio: aguarda espaço, sem perda nem duplicação');
  const S = fresh(); const L = S.run.regions.lua; const cap = E.cap(S, 'lua', 'metal'); L.st.metal = cap; L.b.extrator.n = 3;
  const md = D.regions.lua.phases[0].missions[0];
  const pv = E.rewardPreview(S, 'lua', md.rw); assert(pv.res.metal === 0 && pv.pend.metal === 10, 'prévia avisa que os 10 metais aguardam espaço');
  const r = E.claim(S, 'lua', 'lua.0.0'); assert(r.ok && r.got.res.metal === 0 && r.got.pend.metal === 10 && near(L.pend.metal, 10), 'resgate guarda o que não coube');
  assert(!E.claim(S, 'lua', 'lua.0.0').ok && near(L.pend.metal, 10), 'clicar de novo não duplica');
  const C = clone(S); assert(near(C.run.regions.lua.pend.metal, 10), 'pendência sobrevive ao salvar e carregar');
  L.st.metal = cap - 4; E.tick(S, 0.1); assert(near(L.st.metal, cap) && near(L.pend.metal, 6), 'entrega parcial quando abre espaço');
  L.st.metal = 0; E.tick(S, 0.1); assert(!L.pend.metal && near(L.st.metal, 6), 'resto entregue; pendência zerada');
  const P = fresh(); P.run.regions.lua.pend = { metal: 50 }; readyToCollapse(P); const rc = E.doCollapse(P, E.collapseOffer(P)[0]);
  assert(rc.sum.pend === 50 && !E.pendingTotal(P.run.regions.lua), 'Colapso: suprimentos pendentes são locais e informados no resumo');
}
function testCollapseDirs() {
  section('Colapso: diretrizes concluídas e não resgatadas são creditadas uma vez');
  const setup = (claimFirst) => {
    const S = fresh(); readyToCollapse(S); S.run.totals.prod.metal = 30000; S.run.counters.exped = 10; S.run.dyson.stage = 7;
    if (claimFirst) for (const d of E.dirs(S)) E.claimDir(S, d.i);
    return S;
  };
  const A = setup(false); assert(E.collapsePending(A).dirs.length === 3, 'três diretrizes prontas aparecem como pendência');
  const ra = E.doCollapse(A, E.collapseOffer(A)[0]);
  const B = setup(true); const rb = E.doCollapse(B, E.collapseOffer(B)[0]);
  assert(ra.sum.dirs === 3 && rb.sum.dirs === 0, 'resgatadas antes não são pagas de novo');
  assert(near(A.perm.data, B.perm.data) && A.perm.fragsTotal === B.perm.fragsTotal && A.perm.fragsTotal >= 1, 'resultado igual a resgatar manualmente antes do Colapso (dados e fragmentos)');
  const I = fresh(); readyToCollapse(I); I.run.totals.prod.metal = 100; const ri = E.doCollapse(I, E.collapseOffer(I)[0]);
  assert(ri.sum.dirs === 0, 'diretriz incompleta não é paga');
}
function testChests() {
  section('Baús: cartas só para quem pode evoluir; sem cartas inúteis');
  const S = fresh(); for (const sid of ['iris', 'vulcano']) S.perm.specs[sid] = { lvl: D.specMaxLevel, cards: 0 }; S.perm.specs.nix = { lvl: 9, cards: 0 };
  E.makeChest(S, 'lua', 5, 't'); let ch = S.perm.chests[S.perm.chests.length - 1];
  assert(!ch.cards.iris && !ch.cards.vulcano && ch.cards.nix > 0, 'especialistas no máximo não recebem cartas');
  S.perm.specs.nix.cards = 400; E.makeChest(S, 'lua', 5, 't2'); ch = S.perm.chests[S.perm.chests.length - 1];
  assert(!Object.keys(ch.cards).length && ch.sup === D.chest(5).cards, 'com todos completos, as cartas viram suprimentos limitados');
  const d0 = S.perm.data; const m0 = S.run.regions.lua.st.metal || 0; const r = E.openChest(S, ch.id);
  const metalGot = (S.run.regions.lua.st.metal - m0) + ((S.run.regions.lua.pend || {}).metal || 0);
  assert(r.ok && r.sup && near(metalGot, E.chestSupply(ch.sup).metal) && S.perm.data - d0 === Math.round(ch.data * E.mods(S).dataGain), 'abrir entrega os suprimentos (sem dados extras nem fragmentos)');
  const old = JSON.parse(E.serialize(S)); old.perm.chests.push({ id: 999, title: 'antigo', rid: 'lua', data: 10, cards: { iris: 3 } });
  const O = E.deserialize(JSON.stringify(old)); assert(O.ok && O.S.perm.chests.find((c) => c.id === 999).cards.iris === 3, 'baú antigo preservado como foi gerado');
}
function testHold() {
  section('Reserva para melhoria: material protegido, melhoria paga uma vez, cancelável');
  const S = fresh(); E.unlockRegion(S, 'urano', true); const U = S.run.regions.urano; S.perm.specs.nix = { lvl: 3, cards: 0 };
  U.b = { criogenico: { n: 2, lvl: 2, p: 0 }, reator: { n: 10, lvl: 1, p: 0 } }; U.st = { ice: 400, rare: 30, alloy: 500, comp: 500 };
  const T = clone(S); E.simulate(T, 120); assert((T.run.regions.urano.st.rare || 0) < 30, 'sem reserva o processador gasta os raros');
  const c2 = E.uCost(S, 'urano', 'criogenico'); assert(c2.rare > 0, 'melhoria do nível 2 exige metais raros (' + c2.rare + ')');
  assert(E.setHold(S, 'urano', 'criogenico').on, 'reserva criada');
  U.st.rare = c2.rare - 1; const lv = U.b.criogenico.lvl;
  E.simulate(S, 60); assert(near(U.st.rare, c2.rare - 1, 1e-6) && U.b.criogenico.lvl === lv, 'consumidor automático não usa o material reservado');
  const M = clone(S); delete M.perm.specs.nix; const om = E.operate(M, 'urano', 'criogenico');
  assert(!om.ok && near(M.run.regions.urano.st.rare, c2.rare - 1, 1e-6), 'ciclo manual também respeita a reserva');
  U.st.fuel = 999; const rt = E.createRoute(S, 'urano', 'lua', ['rare']);
  if (rt.ok) { E.sendRoute(S, rt.rt.id); assert(!(rt.rt.cargo && rt.rt.cargo.rare), 'rota não leva o material reservado'); }
  const alloy0 = U.st.alloy; U.st.rare = c2.rare + 0.5; E.tick(S, 0.1);
  assert(U.b.criogenico.lvl === lv + 1 && !U.hold && near(alloy0 - U.st.alloy, c2.alloy), 'custo completo: melhora uma vez, paga e encerra a reserva');
  E.tick(S, 1); assert(U.b.criogenico.lvl === lv + 1, 'não melhora de novo sem nova reserva');
  E.setHold(S, 'urano', 'criogenico'); assert(U.hold && !E.setHold(S, 'urano', 'criogenico').on && !U.hold, 'reserva cancelável');
  const B = JSON.parse(E.serialize(S)); B.run.regions.urano.hold = { bid: 'inexistente' }; const rb = E.deserialize(JSON.stringify(B));
  assert(rb.ok && !rb.S.run.regions.urano.hold, 'reserva inválida descartada ao carregar');
}

let OPTS = {};
function run(opts) {
  OPTS = opts || {}; const t0 = Date.now(); fails = 0; count = 0;
  console.log('Testes de regressão (motor e abas)');
  for (const t of [testImport, testMigration, testManual, testProduction, testRoutes, testSessions, testExpFrags, testScience, testDiscoveries, testDiscMigration, testRewardPreview, testPendingSupplies, testCollapseDirs, testChests, testHold]) {
    try { t(); } catch (e) { fails++; console.log('  ✗ FALHA: ' + t.name + ' lançou exceção: ' + (e.stack || e)); }
  }
  console.log('  ' + (count - fails) + '/' + count + ' verificações OK em ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
  return fails;
}
module.exports = { run };
if (require.main === module) process.exit(run() ? 1 : 0);
