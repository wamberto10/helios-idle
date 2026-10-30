/* HELIOS IDLE — regressões da evolução Painel Solar → Coletor Solar.
   Uso: node tools/solar-upgrade-test.js
   Estados e salvamentos apenas em memória; não lê nem grava partidas pessoais. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const plain = (v) => JSON.parse(JSON.stringify(v));
let checks = 0;
const ok = (condition, message) => { checks++; assert.ok(condition, message); };
const equal = (a, b, message) => { checks++; assert.deepEqual(plain(a), plain(b), message); };
const near = (a, b, message) => ok(Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b)), message + ' (' + a + ' / ' + b + ')');

function load() {
  const c = { console, Buffer, Date, Math, JSON, setTimeout, clearTimeout };
  c.globalThis = c; vm.createContext(c);
  for (const f of ['data.js', 'engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), c, { filename: f });
  return c.H;
}

function run() {
  const { DATA: D, E } = load(); checks = 0;
  let failures = 0;
  const section = (name, fn) => {
    const before = checks;
    try { fn(); console.log('  ✓ ' + name + ' (' + (checks - before) + ')'); }
    catch (error) { failures++; console.error('  ✗ ' + name + ': ' + error.stack); }
  };
  const clone = (S) => { const r = E.deserialize(E.serialize(S)); assert.ok(r.ok, r.err); return r.S; };
  const fixture = ({ rid = 'mercurio', basicN = 3, basicLevel = 1, collectorN = 0, collectorLevel = 1, universe = 'padrao' } = {}) => {
    const S = E.newState(); S.lastTick = 1e12; S.run.universe = universe;
    if (rid !== 'lua') E.unlockRegion(S, rid, true);
    const R = S.run.regions[rid];
    const b = E.bs(R, 'painel'); b.n = basicN; b.lvl = basicLevel;
    if (collectorN) { const c = E.bs(R, 'coletor_solar'); c.n = collectorN; c.lvl = collectorLevel; }
    else delete R.b.coletor_solar;
    S.events = [];
    return { S, R, rid };
  };
  const fund = (R, cost, extra = 20) => { for (const r of D.resOrder) R.st[r] = Math.max(R.st[r] || 0, (cost[r] || 0) + extra); };
  const spent = (before, after) => {
    const out = {}; for (const r of D.resOrder) { const v = (before[r] || 0) - (after[r] || 0); if (v) out[r] = v; } return out;
  };
  const solarGeneration = (S, rid) => {
    const R = S.run.regions[rid], m = E.mods(S);
    return ['painel', 'coletor_solar'].reduce((sum, bid) => { const b = R.b[bid]; return sum + (b ? E.genOf(S, rid, bid, m, b.n, b.lvl) : 0); }, 0);
  };

  console.log('Evolução solar (motor real; estados isolados em memória)');
  section('prévia pura e disponibilidade regional', () => {
    ok(typeof E.solarInfo === 'function' && typeof E.evolveSolar === 'function', 'API solar disponível');
    for (const rid of D.regionOrder) {
      const { S, R } = fixture({ rid }); const before = JSON.stringify(S);
      const info = E.solarInfo(S, rid);
      ok(info.evolutionAvailable === ['mercurio', 'venus'].includes(rid), 'disponibilidade preservada em ' + rid);
      equal(JSON.parse(JSON.stringify(S)), JSON.parse(before), 'consultar a prévia não altera ' + rid);
      near(info.generation, solarGeneration(S, rid), 'geração calculada em ' + rid);
      if (!info.evolutionAvailable) {
        ok(!E.evolveSolar(S, rid).ok, 'conversão recusada fora da disponibilidade: ' + rid);
        equal(JSON.parse(JSON.stringify(S)), JSON.parse(before), 'recusa regional atômica em ' + rid);
      }
      void R;
    }
    const S = E.newState(); const before = JSON.stringify(S);
    ok(!E.evolveSolar(S, 'mercurio').ok, 'região bloqueada não evolui');
    equal(JSON.parse(JSON.stringify(S)), JSON.parse(before), 'recusa de região bloqueada não altera estado');
    const noBasic = fixture({ basicN: 0, collectorN: 2 });
    ok(!E.solarInfo(noBasic.S, noBasic.rid).canEvolve && !E.evolveSolar(noBasic.S, noBasic.rid).ok, 'sem painel básico não cria coletor por evolução');
  });

  section('conversão 1:1, pagamento exato e prévia = resultado', () => {
    const { S, R, rid } = fixture(); const initial = E.solarInfo(S, rid);
    equal(initial.evolutionCost, { metal: 32, cell: 3 }, 'primeiro coletor credita somente os 8 metais básicos');
    const empty = JSON.stringify(S);
    // O estado inicial de Mercúrio tem metal, mas ainda não tem células solares.
    ok(!initial.canEvolve && !E.evolveSolar(S, rid).ok, 'material insuficiente é recusado');
    equal(JSON.parse(JSON.stringify(S)), JSON.parse(empty), 'falha por material é atômica');
    fund(R, initial.evolutionCost); const before = plain(R.st), preview = E.solarInfo(S, rid);
    const result = E.evolveSolar(S, rid);
    ok(result.ok, 'evolução paga aceita');
    ok(R.b.painel.n === 2 && R.b.coletor_solar.n === 1, 'uma unidade básica se torna uma avançada');
    ok(E.solarInfo(S, rid).totalN === preview.totalN, 'quantidade total conservada');
    equal(spent(before, R.st), preview.evolutionCost, 'custo debitado uma única vez');
    equal(result.cost, preview.evolutionCost, 'retorno informa o custo pago');
    near(solarGeneration(S, rid), preview.evolutionAfter, 'geração após conversão confere com a prévia');
    near(result.gain, preview.evolutionGain, 'ganho retornado confere com a prévia');
    ok(E.solarInfo(S, rid).primaryBid === 'coletor_solar', 'modelo principal muda para coletor');
    ok(E.solarInfo(S, rid).evolutionCost.metal > preview.evolutionCost.metal, 'próxima conversão considera a quantidade atual de coletores');
    R.st.cell = 0; const stale = JSON.stringify(S);
    ok(!E.evolveSolar(S, rid).ok, 'ação recalcula requisitos depois de uma prévia antiga');
    equal(JSON.parse(JSON.stringify(S)), JSON.parse(stale), 'prévia antiga não autoriza pagamento parcial');
  });

  section('troca entra no nível atual do gerador melhor (sem herdar nem cobrar nível)', () => {
    for (const [basicLevel, collectorLevel] of [[5, 2], [2, 6]]) {
      const { S, R, rid } = fixture({ basicN: 4, basicLevel, collectorN: 2, collectorLevel });
      const m = E.mods(S), expected = plain(E.bCost(S, rid, 'coletor_solar', m)); expected.metal -= Math.ceil(D.buildings.painel.cost.metal * m.costRed);
      const preview = E.solarInfo(S, rid); equal(preview.evolutionCost, expected, 'custo = construir 1 coletor menos o painel (' + basicLevel + '/' + collectorLevel + ')');
      ok(preview.evolutionLevel === collectorLevel, 'prévia indica o nível atual dos coletores');
      fund(R, preview.evolutionCost); const stock = plain(R.st);
      ok(E.evolveSolar(S, rid).ok, 'troca com níveis diferentes aceita');
      ok(R.b.painel.n === 3 && R.b.painel.lvl === basicLevel, 'painéis restantes mantêm o próprio nível');
      ok(R.b.coletor_solar.n === 3 && R.b.coletor_solar.lvl === collectorLevel, 'coletores continuam no nível deles');
      equal(spent(stock, R.st), expected, 'nenhuma melhoria extra cobrada');
      near(solarGeneration(S, rid), preview.evolutionAfter, 'geração prevista confere');
    }
    const { S, R, rid } = fixture({ basicN: 1, basicLevel: 3 });
    const info = E.solarInfo(S, rid); fund(R, info.evolutionCost);
    ok(E.evolveSolar(S, rid).ok && R.b.coletor_solar.lvl === 1, 'primeiro coletor começa no nível 1 (o do painel não passa)');
    const remaining = plain(R.st);
    ok(!E.evolveSolar(S, rid).ok, 'repetir após converter o último painel não cria outra unidade');
    equal(R.st, remaining, 'repetição recusada não cobra materiais');
  });

  section('expansão básica continua disponível sem baratear coletores', () => {
    for (const basicN of [0, 5]) {
      const { S, R, rid } = fixture({ basicN, collectorN: 2 });
      fund(R, { metal: 1e6, cell: 1e6 });
      const direct = plain(E.bCost(S, rid, 'coletor_solar'));
      const before = plain(R.st), total = E.solarInfo(S, rid).totalN;
      ok(E.build(S, rid, 'painel').ok, 'construir painel barato com coletores existentes');
      ok(E.solarInfo(S, rid).primaryBid === 'coletor_solar', 'expansão básica não regride a tecnologia principal');
      ok(E.evolveSolar(S, rid).ok, 'novo painel também pode evoluir');
      const paid = spent(before, R.st);
      for (const r in direct) ok((paid[r] || 0) >= direct[r], 'construir básico + converter não sai mais barato em ' + r + ' (n=' + basicN + ')');
      ok(E.solarInfo(S, rid).totalN === total + 1 && R.b.painel.n === basicN, 'caminho de expansão adiciona só uma instalação');
    }
    const { S, R, rid } = fixture({ collectorN: 1 }); S.perm.research.ind4 = 3;
    const info = E.solarInfo(S, rid), m = E.mods(S);
    const expected = plain(E.bCost(S, rid, 'coletor_solar', m)); expected.metal -= Math.ceil(8 * m.costRed);
    equal(info.evolutionCost, expected, 'desconto de pesquisa aplicado sem crédito histórico excessivo');
    fund(R, info.evolutionCost); ok(E.evolveSolar(S, rid).ok, 'evolução funciona com desconto de pesquisa');
  });

  section('missões de painéis e coletores continuam concluíveis', () => {
    const { S, R, rid } = fixture({ basicN: 2, basicLevel: 3, collectorN: 1, collectorLevel: 1 });
    const panelBuild = { t: 'build', b: 'painel', n: 3 }, panelLevel = { t: 'level', b: 'painel', n: 3 };
    ok(E.mProg(S, rid, panelBuild, 'test').done && E.mProg(S, rid, panelLevel, 'test').done, 'família já cumpre metas básicas');
    fund(R, E.solarInfo(S, rid).evolutionCost); E.evolveSolar(S, rid);
    ok(E.mProg(S, rid, panelBuild, 'test').done && E.mProg(S, rid, panelBuild, 'test').cur === 3, 'evoluir não regride a contagem de painéis');
    ok(E.mProg(S, rid, { t: 'build', b: 'coletor_solar', n: 2 }, 'test').done, 'conversão conta para construir coletores');
    ok(!E.mProg(S, rid, { t: 'level', b: 'coletor_solar', n: 3 }, 'test').done, 'nível do painel não conta para meta de nível do coletor');
    fund(R, E.solarInfo(S, rid).evolutionCost); E.evolveSolar(S, rid);
    ok(R.b.painel.n === 0 && E.mProg(S, rid, panelLevel, 'test').done, 'só coletores ainda cumprem nível do modelo básico');
    ok(!E.mProg(fixture({ basicN: 10 }).S, rid, { t: 'build', b: 'coletor_solar', n: 1 }, 'test').done, 'painéis básicos não satisfazem missão avançada');
    const v3 = JSON.parse(E.serialize(S)); v3.v = 3;
    const restored = E.deserialize(JSON.stringify(v3)); ok(restored.ok, 'saves versão 3 mantêm missões e grupos solares');
    ok(E.mProg(restored.S, rid, panelBuild, 'test').done, 'meta continua concluída após carregar');
  });

  section('reservas são preservadas ou encerradas de forma coerente', () => {
    const last = fixture({ basicN: 1 }); fund(last.R, E.solarInfo(last.S, last.rid).evolutionCost);
    E.setHold(last.S, last.rid, 'painel'); const r1 = E.evolveSolar(last.S, last.rid);
    ok(r1.ok && r1.holdCancelled && !last.R.hold, 'reserva do último painel termina ao convertê-lo');
    const partial = fixture({ basicN: 2 }); fund(partial.R, E.solarInfo(partial.S, partial.rid).evolutionCost);
    E.setHold(partial.S, partial.rid, 'painel'); const r2 = E.evolveSolar(partial.S, partial.rid);
    ok(r2.ok && !r2.holdCancelled && partial.R.hold.bid === 'painel', 'reserva de painéis restantes continua');
    const catchup = fixture({ basicLevel: 3, collectorN: 1, collectorLevel: 1 }); fund(catchup.R, E.solarInfo(catchup.S, catchup.rid).evolutionCost);
    E.setHold(catchup.S, catchup.rid, 'coletor_solar'); const r3 = E.evolveSolar(catchup.S, catchup.rid);
    ok(r3.ok && !r3.holdCancelled && catchup.R.hold.bid === 'coletor_solar', 'sem cobrança de nível, a reserva da melhoria do coletor continua');
    const other = fixture(); E.bs(other.R, 'refinaria').n = 1; E.setHold(other.S, other.rid, 'refinaria'); fund(other.R, E.solarInfo(other.S, other.rid).evolutionCost);
    ok(E.evolveSolar(other.S, other.rid).ok && other.R.hold.bid === 'refinaria', 'ação manual pode gastar material reservado sem cancelar reserva de outra instalação');
  });

  section('escada de geradores: painel → coletor → reator de fusão', () => {
    const S = E.newState(); S.lastTick = 1e12; for (const r of ['marte', 'cinturao', 'mercurio']) E.unlockRegion(S, r, true);
    ok(E.genNext(S, 'lua', 'painel') === null, 'Lua antes de Júpiter: painel ainda sem gerador melhor');
    ok(E.genNext(S, 'mercurio', 'painel') === 'coletor_solar' && E.genNext(S, 'mercurio', 'coletor_solar') === null, 'Mercúrio antes de Júpiter: painel → coletor; coletor sem próximo');
    for (const r of ['venus', 'jupiter']) E.unlockRegion(S, r, true);
    ok(E.genNext(S, 'lua', 'painel') === 'reator', 'com Júpiter alcançado: na Lua o painel vai direto ao reator');
    ok(E.genNext(S, 'mercurio', 'painel') === 'coletor_solar' && E.genNext(S, 'mercurio', 'coletor_solar') === 'reator', 'em Mercúrio: painel → coletor → reator');
    ok(E.genNext(S, 'jupiter', 'reator') === null, 'reator é o topo da escada');
    // troca na Lua: o reator entra no nível atual dos reatores; o painel restante mantém o nível dele
    const L = S.run.regions.lua; L.b.painel = { n: 3, lvl: 4, p: 0 }; L.b.reator = { n: 1, lvl: 2, p: 0 };
    const info = E.swapInfo(S, 'lua', 'painel'), m = E.mods(S);
    equal(info.cost, plain(E.bCost(S, 'lua', 'reator', m)), 'custo = construir 1 reator (o painel não tem material em comum para descontar)');
    ok(info.to === 'reator' && info.toLevel === 2 && info.gain > 0, 'prévia: reator nível 2 e ganho de energia');
    ok(!E.swapGen(S, 'lua', 'painel').ok, 'sem materiais a troca é recusada');
    fund(L, info.cost); const before = plain(L.st), r = E.swapGen(S, 'lua', 'painel');
    ok(r.ok && L.b.painel.n === 2 && L.b.painel.lvl === 4 && L.b.reator.n === 2 && L.b.reator.lvl === 2, 'troca feita: 2 painéis Nv 4 e 2 reatores Nv 2');
    equal(spent(before, L.st), info.cost, 'custo pago uma vez');
    near(E.genOf(S, 'lua', 'painel', m, 2, 4) + E.genOf(S, 'lua', 'reator', m, 2, 2), info.after, 'energia depois = prévia');
    // reator novo (sem nenhum antes) começa no nível 1, mesmo com painel de nível alto
    const T = E.newState(); T.lastTick = 1e12; for (const x of ['marte', 'cinturao', 'mercurio', 'venus', 'jupiter']) E.unlockRegion(T, x, true);
    const TL = T.run.regions.lua; TL.b.painel = { n: 1, lvl: 5, p: 0 }; delete TL.b.reator; fund(TL, E.swapInfo(T, 'lua', 'painel').cost);
    ok(E.swapGen(T, 'lua', 'painel').ok && TL.b.reator.lvl === 1 && TL.b.painel.n === 0, 'primeiro reator começa no nível 1');
    ok(E.mProg(T, 'lua', { t: 'build', b: 'painel', n: 1 }, 'x').done && E.mProg(T, 'lua', { t: 'level', b: 'painel', n: 5 }, 'x').done, 'metas de painel continuam cumpridas depois de trocar tudo pelo reator');
    ok(!E.mProg(T, 'lua', { t: 'level', b: 'reator', n: 2 }, 'x').done, 'nível do painel não vale para metas do reator');
    // em Mercúrio o coletor também sobe para reator
    const M = S.run.regions.mercurio; M.b.coletor_solar = { n: 2, lvl: 3, p: 0 }; M.b.reator = { n: 0, lvl: 1, p: 0 }; fund(M, E.swapInfo(S, 'mercurio', 'coletor_solar').cost);
    ok(E.swapGen(S, 'mercurio', 'coletor_solar').ok && M.b.coletor_solar.n === 1 && M.b.reator.n === 1 && M.b.reator.lvl === 1, 'Mercúrio: coletor trocado por reator Nv 1');
  });

  section('saves mistos preservam níveis e energia; online = offline', () => {
    const { S, R, rid } = fixture({ basicN: 7, basicLevel: 8, collectorN: 3, collectorLevel: 2 });
    const old = JSON.parse(E.serialize(S)); old.v = 3;
    const before = solarGeneration(S, rid), loaded = E.deserialize(JSON.stringify(old));
    ok(loaded.ok, 'save antigo misto aceito');
    equal(loaded.S.run.regions[rid].b.painel, R.b.painel, 'painéis antigos preservados exatamente');
    equal(loaded.S.run.regions[rid].b.coletor_solar, R.b.coletor_solar, 'coletores antigos preservados exatamente');
    near(solarGeneration(loaded.S, rid), before, 'carregar save misto não altera geração');
    const again = clone(loaded.S); near(solarGeneration(again, rid), before, 'recarregar não aplica evolução novamente');
    const state = fixture({ basicN: 2 }); const pre = E.solarInfo(state.S, state.rid); fund(state.R, pre.evolutionCost); E.evolveSolar(state.S, state.rid); E.recruit(state.S, 'iris');
    const online = clone(state.S), offline = clone(state.S);
    E.simulate(online, 3600); const report = E.applyOffline(offline, state.S.lastTick + 3600e3);
    ok(report && report.used === 3600, 'uma hora offline aplicada');
    near(online.run.time, offline.run.time, 'tempo online e offline coincidem');
    for (const region of ['lua', 'mercurio']) equal(online.run.regions[region].st, offline.run.regions[region].st, 'produção online/offline igual em ' + region);
    ok(offline.run.regions.mercurio.b.painel.n === 1 && offline.run.regions.mercurio.b.coletor_solar.n === 1, 'offline preserva quantidades evoluídas');
    ok(E.applyOffline(offline, state.S.lastTick + 3600e3) === null, 'retomar novamente não duplica a ausência');
  });

  section('multiplicadores solares e Colapso', () => {
    for (const universe of D.universeOrder) {
      const { S, R, rid } = fixture({ universe });
      S.perm.specs.helio = { lvl: 4, cards: 0 }; S.perm.research.en1 = 3; S.run.dyson.stage = 2;
      const preview = E.solarInfo(S, rid); fund(R, preview.evolutionCost);
      ok(E.evolveSolar(S, rid).ok, 'evolui no universo ' + universe);
      near(solarGeneration(S, rid), preview.evolutionAfter, 'prévia respeita Hélio, pesquisa e Dyson em ' + universe);
      near(E.regionEnergy(S, rid, E.mods(S)).gen, preview.evolutionAfter, 'energia regional não conta painel e coletor em dobro em ' + universe);
    }
    const { S, R, rid } = fixture(); fund(R, E.solarInfo(S, rid).evolutionCost); E.evolveSolar(S, rid);
    for (const region of D.regionOrder) { S.run.regions[region].unlocked = true; S.run.regions[region].phase = D.regions[region].phases.length; }
    S.run.dyson.stage = D.dysonRequired; S.run.core = true; S.run.totals.value = 5e7;
    ok(E.canCollapse(S), 'fixture pode colapsar');
    ok(E.doCollapse(S, E.collapseOffer(S)[0]).ok, 'Colapso aceita partida com evolução solar');
    ok(!S.run.regions.mercurio.unlocked && !(S.run.regions.lua.b.coletor_solar || {}).n, 'novo universo reinicia a evolução local');
    ok(E.solarInfo(S, 'lua').primaryBid === 'painel' && E.solarInfo(S, 'lua').totalN >= 2, 'novo universo volta ao modelo inicial sem perder instalações iniciais');
  });

  console.log('  ' + checks + ' verificações; ' + failures + ' seção(ões) com falha.');
  return failures;
}

module.exports = { run };
if (require.main === module) process.exit(run() ? 1 : 0);
