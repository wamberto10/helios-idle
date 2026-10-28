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

let OPTS = {};
function run(opts) {
  OPTS = opts || {}; const t0 = Date.now(); fails = 0; count = 0;
  console.log('Testes de regressão (motor e abas)');
  for (const t of [testImport, testMigration, testManual, testProduction, testRoutes, testSessions, testExpFrags]) {
    try { t(); } catch (e) { fails++; console.log('  ✗ FALHA: ' + t.name + ' lançou exceção: ' + (e.stack || e)); }
  }
  console.log('  ' + (count - fails) + '/' + count + ' verificações OK em ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
  return fails;
}
module.exports = { run };
if (require.main === module) process.exit(run() ? 1 : 0);
