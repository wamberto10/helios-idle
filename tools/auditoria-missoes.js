/* Auditoria de economia/missões. Somente lê dados/motor em uma VM e grava artefatos.
   Uso: node tools/auditoria-missoes.js
   Não altera os valores do jogo nem lê salvamentos pessoais. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, Date, Math, JSON, Buffer, setTimeout, clearTimeout });
for (const file of ['data.js', 'engine.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context, { filename: file });
const { DATA: D, E } = context.H;
const HOURS = 8, HORIZON = HOURS * 3600;
const round = (n, p = 6) => Math.round(n * 10 ** p) / 10 ** p;
const sum = xs => xs.reduce((a, b) => a + b, 0);
const sources = ['data.js', 'engine.js'].map(file => ({ file: 'js/' + file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'js', file))).digest('hex') }));
const assert = (c, message) => { if (!c) throw new Error(message); };

function observatoryCase(id, count, level, oracle, research, fragsTotal, eco) {
  const S = E.newState(); const reg = S.run.regions.lua;
  reg.phase = 3; reg.b = { observatorio: { n: count, lvl: level, p: 0, on: false, pause: false } };
  S.perm.specs.oraculo = { lvl: oracle, cards: 0 }; S.perm.research = { ...research }; S.perm.fragsTotal = fragsTotal;
  if (eco) S.perm.specs.eco = { lvl: eco, cards: 0 };
  const m = E.mods(S), power = E.useOf(D.buildings.observatorio, count, m);
  const panels = Math.ceil(power / E.genOf(S, 'lua', 'painel', m, 1, 1));
  reg.b.painel = { n: panels, lvl: 1, p: 0 };
  const theoreticalPerSecond = E.bRate(S, 'lua', 'observatorio', m), before = S.perm.data;
  const rep = E.simulate(S, HORIZON); const actual = S.perm.data - before;
  assert(Math.abs(actual - theoreticalPerSecond * HORIZON) < 0.01, 'Produção real divergiu no cenário ' + id);
  return { id, setup: { count, buildingLevel: level, oracleLevel: oracle, research, fragsTotal, ecoLevel: eco || 0, panelsLevel1: panels }, powerMW: round(power), energyRatio: reg.en.ratio, dataGainMultiplier: m.dataGain, dataPerSecond: round(theoreticalPerSecond), dataPerHour: round(theoreticalPerSecond * 3600), dataIn8Hours: round(actual), reportData: round(rep.data), assumptions: 'Cenário controlado plausível, não tempo medido de campanha. Lua com somente observatórios e painéis; produção automática, energia suficiente, sem gasto durante 8 h.' };
}
const observatories = [
  observatoryCase('recem-automatizado', 1, 1, 1, {}, 0, 0),
  observatoryCase('base-moderada', 4, 3, 3, { exp4: 2 }, 0, 0),
  observatoryCase('base-avancada-controlada', 8, 8, 5, { exp4: 5, sg3: 2 }, 100, 1),
];

const phases = [], missions = [], otherRewardCounts = { spec: 0, unlock: 0, cards: 0, res: 0, frags: 0 };
for (const rid of D.regionOrder) {
  D.regions[rid].phases.forEach((phase, phaseIndex) => {
    const data = sum(phase.missions.map(md => (md.rw || {}).data || 0));
    const nonData = {};
    phase.missions.forEach((md, missionIndex) => {
      const rw = md.rw || {}, kinds = Object.keys(otherRewardCounts).filter(k => !!rw[k]);
      for (const k of kinds) { otherRewardCounts[k]++; nonData[k] = (nonData[k] || 0) + 1; }
      missions.push({ id: `${rid}.${phaseIndex}.${missionIndex}`, region: rid, phase: phase.name, type: md.t, target: md.n === undefined ? null : md.n, resource: md.r || null, building: md.b || null, title: E.mTitle(md), reward: rw, onlyDataReward: !!rw.data && kinds.length === 0 });
    });
    phases.push({ region: rid, regionName: D.regions[rid].name, phaseIndex, phase: phase.name, missions: phase.missions.length, baseData: data, onlyDataRewards: phase.missions.filter(md => md.rw && md.rw.data && Object.keys(otherRewardCounts).every(k => !md.rw[k])).length, nonDataRewards: nonData, equivalentProductionSeconds: Object.fromEntries(observatories.map(o => [o.id, round(sum(phase.missions.map(md => Math.round((md.rw?.data || 0) * o.dataGainMultiplier))) / o.dataPerSecond)])) });
  });
}
const missionBudget = { totalMissions: missions.length, totalPhases: phases.length, baseData: sum(phases.map(x => x.baseData)), onlyDataRewards: missions.filter(x => x.onlyDataReward).length, otherRewardCounts, dataRange: { min: Math.min(...missions.filter(x => x.reward.data).map(x => x.reward.data)), max: Math.max(...missions.filter(x => x.reward.data).map(x => x.reward.data)) }, phaseChestBaseData: sum(phases.map((x, i) => D.chest(i).data)), phaseChestCards: sum(phases.map((x, i) => D.chest(i).cards)), notes: 'Baús dependem da ordem global de conclusão de fases. Soma base considera gpi 0..20, antes de multiplicador de dados e sem conversão de cartas em dados quando não há especialista.' };
const research = Object.entries(D.research).map(([id, node]) => ({ id, name: node.name, currency: node.cur || 'data', ranks: node.max, rankCosts: Array.from({ length: node.max }, (_, i) => E.resCost(id, i)), totalCost: sum(Array.from({ length: node.max }, (_, i) => E.resCost(id, i))), requirements: (node.req || []).map(k => ({ id: k, minLevel: 1 })), explicitRegionGate: null }));
const promotionCostOneSpecialist = sum(D.specData.slice(1, D.specMaxLevel));
const finiteSinks = { dataResearchNodes: research.filter(x => x.currency === 'data').length, dataResearchRanks: sum(research.filter(x => x.currency === 'data').map(x => x.ranks)), totalDataResearchCost: sum(research.filter(x => x.currency === 'data').map(x => x.totalCost)), totalFragmentResearchCost: sum(research.filter(x => x.currency === 'frag').map(x => x.totalCost)), maxSpecialistLevel: D.specMaxLevel, specialistCount: Object.keys(D.specs).length, dataPromotionCostPerSpecialist: promotionCostOneSpecialist, dataPromotionCostAllSpecialists: promotionCostOneSpecialist * Object.keys(D.specs).length, requiredCardsPerSpecialist: sum(D.specCards.slice(1, D.specMaxLevel)), note: 'Não há manutenção nem pesquisa infinita. Todos esses gastos de dados são permanentes, finitos e preservados no Colapso; ter dados não dispensa cartas para promoção.' };
finiteSinks.totalPermanentDataSink = finiteSinks.totalDataResearchCost + finiteSinks.dataPromotionCostAllSpecialists;

function researchGateProof() {
  const S = E.newState(); S.perm.data = 1e8;
  const path = ['min1', 'min2', 'min4', 'min5'], results = [];
  for (const id of path) results.push({ id, before: E.resState(S, id), result: E.buyResearch(S, id) });
  // Desde as descobertas, a pesquisa avançada exige a tecnologia do planeta: na Lua, só o começo do ramo abre.
  assert(results[0].result.ok && results[1].result.ok, 'Começo do ramo de mineração deveria estar disponível na Lua');
  assert(!results[2].result.ok && results[2].before.disc, 'Pesquisa avançada deveria exigir a descoberta do planeta (achado P1 corrigido)');
  const gate = D.research[path[2]].disc; S.perm.disc = Object.assign({}, S.perm.disc, { [gate.d]: 1 });
  assert(E.buyResearch(S, path[2]).ok, 'Com a descoberta, a pesquisa avançada deveria abrir');
  return { artificialBudget: 1e8, caution: 'Orçamento injetado apenas para testar regras de acesso; não significa que esse valor surge no início de uma campanha.', pathCost: 1e8 - S.perm.data, prerequisitesAfter: S.perm.research, unlockedRegions: D.regionOrder.filter(rid => S.run.regions[rid].unlocked), luaPhase: S.run.regions.lua.phase, boughtAdvancedNode: 'min5', results };
}

function expeditionExpectation(S, id) {
  const def = D.expeditions[id], guaranteed = E.expReward(S, { id, bonus: [] }, false), m = E.mods(S);
  const dataOf = part => Math.round((part.data || 0) * m.dataGain);
  const fragsOf = part => part.frags || 0;
  const gData = sum(guaranteed.map(dataOf)), gFrags = sum(guaranteed.map(fragsOf));
  let expData = gData, expFrags = gFrags;
  for (const [chance, reward] of def.bonus) {
    const all = E.expReward(S, { id, bonus: [reward] }, false);
    expData += chance * (sum(all.map(dataOf)) - gData);
    expFrags += chance * (sum(all.map(fragsOf)) - gFrags);
  }
  return { id, durationSeconds: round(E.expDur(S, id)), guaranteedData: gData, expectedData: round(expData), guaranteedFragments: gFrags, expectedFragments: expFrags, expectedDataPerHour: round(expData / E.expDur(S, id) * 3600), expectedFragmentsPer8Hours: round(Math.floor(HORIZON / E.expDur(S, id)) * expFrags), expRewardMultiplier: m.expReward, dataGainMultiplier: m.dataGain, cost: def.cost };
}
function expeditionState(maxed) {
  const S = E.newState(); S.run.universe = 'ancestral';
  // O universo Ancestral pode ser escolhido depois de um Colapso anterior.
  // O teste mede o ganho SEM OUTRO Colapso durante as oito horas de repetição.
  S.perm.collapses = 1; S.perm.frags = S.perm.fragsTotal = 40;
  for (const rid of ['lua', 'marte']) { S.run.regions[rid].unlocked = true; S.run.regions[rid].st = { fuel: 1e6 }; }
  S.run.flags.expeditions = true;
  S.perm.specs.reliquia = { lvl: maxed ? 10 : 1, cards: 0 };
  if (maxed) { S.perm.research.exp1 = 5; S.perm.research.exp2 = 2; S.perm.research.exp3 = 5; S.perm.research.exp4 = 5; S.perm.specs.oraculo = { lvl: 10, cards: 0 }; }
  return S;
}
function ruinsFarm(maxed) {
  const S = expeditionState(maxed), before = { frags: S.perm.fragsTotal, data: S.perm.data }, ids = ['ruinas', 'ruinas2'];
  const expected = ids.map(id => expeditionExpectation(S, id)), complete = { ruinas: 0, ruinas2: 0 }, counts = { data: 0, frags: 0, cards: {} };
  const start = id => { const r = E.startExp(S, id); assert(r.ok, 'Falhou lançamento controlado ' + id + ': ' + r.err); };
  if (!maxed) S.perm.research.exp2 = 1; // duas sondas apenas; não altera duração/recompensa
  ids.forEach(start);
  while (S.run.exps.length) {
    const due = Math.min(...S.run.exps.map(e => e.end)); if (due > HORIZON + 1e-9) break;
    // Avança só o relógio de expedição: isola a repetição sem fabricar combustível.
    S.run.time = due;
    const finished = S.run.exps.filter(e => e.end <= due + 1e-9);
    for (const exp of finished) {
      const got = E.collectExp(S, exp.uid); assert(got.ok, 'Falhou coleta ' + exp.id);
      complete[exp.id]++; counts.data += got.total.data; counts.frags += got.total.frags;
      for (const [sid, n] of Object.entries(got.total.cards)) counts.cards[sid] = (counts.cards[sid] || 0) + n;
      if (S.run.time + E.expDur(S, exp.id) <= HORIZON + 1e-9) start(exp.id);
    }
  }
  assert(S.perm.collapses === 1 && S.perm.fragsTotal - before.frags === counts.frags, 'Farm deve creditar fragmentos sem outro Colapso');
  return { mode: maxed ? 'pesquisas-maximas-e-reliquia10' : 'reliquia1-duas-sondas', hours: HOURS, expected, completed: complete, actualDeterministicSeed: counts, remainingFuel: { lua: S.run.regions.lua.st.fuel, marte: S.run.regions.marte.st.fuel }, fragmentsTotalGained: S.perm.fragsTotal - before.frags, globalYieldBefore: 1 + D.collapse.fragYield * before.frags, globalYieldAfter: E.mods(S).globalYield, initialCollapses: 1, finalCollapses: S.perm.collapses, collapsesDuringFarm: 0, caution: 'Farm ATIVO: resgate e relançamento imediatos nas chegadas. Combustível inicial controlado suficiente. Começa no Ancestral após um Colapso anterior, com 40 fragmentos iniciais. Não é medição de tempo necessário para atingir os níveis. Não é o que ocorre durante ausência: expedições não relançam sozinhas. Cartas e dados são avaliados com os bônus correntes; nenhum novo nível é comprado durante o teste.' };
}
function ruinsOffline() {
  const S = expeditionState(true); const ids = ['ruinas', 'ruinas2'];
  ids.forEach(id => assert(E.startExp(S, id).ok, 'Lançamento offline falhou'));
  E.simulate(S, HORIZON);
  const pendingBeforeCollection = S.run.exps.length;
  const rewards = S.run.exps.slice().map(e => ({ id: e.id, ...E.collectExp(S, e.uid).total }));
  return { hours: HOURS, pendingBeforeCollection, rewards, fragmentsTotalGained: S.perm.fragsTotal - 40, expeditionsCompleted: S.run.counters.exped, caution: '8 horas sem interação só completam as duas expedições enviadas; não há repetição automática.' };
}

function exportProbe(enabled) {
  const S = E.newState(), reg = S.run.regions.lua;
  S.perm.specs.iris = { lvl: 1, cards: 0 }; reg.b = { extrator: { n: 1, lvl: 1, p: 0 }, painel: { n: 1, lvl: 1 } }; reg.st = {}; reg.exp.ore = enabled;
  E.simulate(S, HORIZON);
  return { exportEnabled: enabled, oreCap: E.cap(S, 'lua', 'ore'), oreStored: round(reg.st.ore || 0), oreProduced: round(reg.stats.prod.ore || 0), totalProducedValue: round(S.run.totals.value), data: round(S.perm.data), exportRate: D.exportRate, note: 'Um extrator nível1, Íris1, um painel, nenhum outro consumidor ou ação.' };
}
function reactorProbe() {
  const S = E.newState(); E.unlockRegion(S, 'jupiter'); const reg = S.run.regions.jupiter;
  reg.b = { reator: { n: 1, lvl: 1 } }; reg.st = { fusion: 100 };
  E.simulate(S, HORIZON);
  return { hours: HOURS, generationMW: reg.en.gen, fusionBefore: 100, fusionAfter: reg.st.fusion, cyclicFusionConsumers: Object.entries(D.buildings).filter(([, d]) => d.in && d.in.fusion).map(([id]) => id), purchaseFusionConsumers: Object.entries(D.buildings).filter(([, d]) => d.cost && d.cost.fusion).map(([id]) => id), note: 'Reator é passivo e não possui in/fuel; o custo de fusão é de construção, não manutenção. Isolado sem outras máquinas.' };
}
const depthCases = [0, 1, 5, 6, 10].map(collapses => {
  const S = E.newState(); S.perm.collapses = collapses;
  const assumedFragments = 40 * collapses; S.perm.fragsTotal = assumedFragments;
  const m = E.mods(S), prodMission = { t: 'prod', r: 'ore', n: 1000, rw: { data: 30 } };
  return { collapses, missionDepthMultiplier: E.depthMult(S), sampleGoalBase1000: E.mTarget(S, 'cinturao', prodMission, m), illustrativeFragmentsTotal: assumedFragments, illustrativeGlobalYield: m.globalYield, yieldDividedByGoalScale: round(m.globalYield / E.depthMult(S)), note: '40 fragmentos por Colapso é hipótese ilustrativa para isolar fórmula, não campanha medida; rendimento pode crescer sem teto, metas param de crescer em6Colapsos.' };
});
const exp4Base = observatoryCase('base-moderada-sem-exp4', 4, 3, 3, {}, 0, 0);
const exp4Cost = research.find(x => x.id === 'exp4');
const exp4Feedback = { wholeResearchCost: exp4Cost.totalCost, wholeResearchDataMultiplier: 1 + D.research.exp4.eff.v * D.research.exp4.max, baseDataPerSecond: exp4Base.dataPerSecond, firstRankCost: exp4Cost.rankCosts[0], firstRankPaybackSecondsUsingOnlyThoseObservatories: round(exp4Cost.rankCosts[0] / (exp4Base.dataPerSecond * D.research.exp4.eff.v)), wholeResearchPaybackSecondsIgnoringStagedAcquisition: round(exp4Cost.totalCost / (exp4Base.dataPerSecond * D.research.exp4.eff.v * D.research.exp4.max)), note: 'Só produção contínua, sem crédito extra de missões, baús ou expedições. Níveis do mesmo nó somam; outros bônus multiplicam. Não é exponenciação por nível.' };

const report = {
  title: 'HELIOS IDLE — auditoria de missões e excesso de economia permanente', sources,
  method: { changesApplied: false, horizonHours: HOURS, realEngineUsed: true, scope: 'Orçamentos estáticos e cenários controlados. Não substitui medição de campanha em 5/10 Colapsos.', seed: 'RNG determinístico do motor, seq inicial 1, collapses 1 para expedições; nenhum Math.random adicionado.', oldBalanceLimit: 'BALANCO.md chamou dados de bem equilibrados usando campanha ativa até o primeiro Colapso (e depois cronometrou o segundo). Não avaliou deixar observatórios por 8 horas, completar gastos permanentes ou farm ativo de fragmentos em ruínas. Essa conclusão não pode ser estendida a esses horizontes.' },
  missionBudget, phases, missions, research, finiteSinks, researchGateProof: researchGateProof(), observatories, exp4Feedback,
  expeditions: { relicLevel1: ruinsFarm(false), capped: ruinsFarm(true), unattended: ruinsOffline(), fragmentScaling: 'scaleRw copia rw.frags sem multiplicar expReward. O bônus de recompensa multiplica cartas/dados, mas não fragmentos; 1 garantido continua1.' },
  exports: [exportProbe(false), exportProbe(true)], reactor: reactorProbe(), depthCases,
  problems: [
    { priority: 'P1', id: 'fragments-without-collapse', finding: 'Ruínas Precursoras é repetível e dá1fragmento garantido semColapso; Câmaras dáchance0,3de1. Ambos aumentam fragsTotal e rendimento global permanente, além de serem moeda gastável.', evidence: 'expeditions.capped / relicLevel1 / unattended', adjustment: 'Vincular a primeira recompensa de fragmento à descoberta única por universo/Colapso; repetições dão cartas e outro ganho limitado. Se quiser farm infinito, orçamento explícito por sessão/dia com retorno decrescente e sem aumentar fragsTotal de rendimento. Não remover a recompensa inicial de Relíquia.' },
    { priority: 'P1', id: 'finite-permanent-sinks', finding: 'Dados crescem continuamente e também recebem globalYield de todos os fragmentos; pesquisa e promoção têm tetos finitos permanentes e não reiniciam. O saldo sobra inevitavelmente depois dos tetos.', evidence: 'finiteSinks / observatories / depthCases', adjustment: 'Separar ciência de execução por universo e conhecimento permanente; ou adicionar uma pesquisa contínua controlada com retornos decrescentes. Preservar ritmo acelerado de construção e automação, sem simplesmente multiplicar todos os custos.' },
    { priority: 'P1', id: 'research-not-tied-to-technology', finding: 'Uma única compra no pré-requisito libera pesquisa avançada e não há condição de planeta/fase. Recursos sobrando permitem saltar árvore ainda naLua.', evidence: 'researchGateProof / research', adjustment: 'Usar marcos tecnológicos concretos para abrir ramos: primeiro componente/raros/fusão/criogenia, com pré-requisito de nível apropriado. Nunca travar min1/en1 até uma missão que já exige uma pesquisa; manter pesquisa inicial acessível pelo orçamento daLua.' },
    { priority: 'P2', id: 'mission-cash-devaluation', finding: 'A maioria das missões só entrega dados; a recompensa equivale a poucos segundos quando a base cresce. Mesmo assim missões continuam necessárias para fase/região/baú; não são removíveis sem redesenhar progressão.', evidence: 'missionBudget / phases', adjustment: 'Transformar objetivos-chave em desbloqueio de tecnologia/projeto, cartas direcionadas e avanço de exploração. Manter dados como ajuda previsível para próximo passo, não escalar recompensa automaticamente pela maior taxa atual que pode realimentar inflação.' },
    { priority: 'P2', id: 'free-fusion-reactors', finding: 'Reator usa fusão só na compra; depois gera energia sem combustível. Produção de fusão tem apenas um consumidor cíclico (laboratório emNetuno).', evidence: 'reactor', adjustment: 'Adicionar consumo operacional leve e reserva/partida de emergência, ou outros sumidouros úteis de fusão. Nunca permitir que falta de fusão paralise o único produtor do próprio combustível ou impeça relançar logística.' },
    { priority: 'P2', id: 'storage-export-and-uncapped-value', finding: 'EXP evita perda de produção com estoque cheio e continua aumentando o valor paraColapso, mas não rende dados pois exportRate=0. Armazenamento passa a importar mais para compras/reservas do que para produção contínua.', evidence: 'exports', adjustment: 'PreservarEXP como válvula de produção e usar armazenagem em reservas/descarga/projetos; não reativar exportação emdados antes de corrigir inflação de pesquisa. Combustível de rotas já escala com sqrt(capacidade/20), portanto não alegar custo fixo porviagem.' },
  ],
  missionDesign: {
    firstSteps: ['LuaPouso: manter min1(custo10) e en1(custo12) acessíveis; recompensas basePouso20, depois primeiros objetivosda fase1 ajudam a segunda compra.', 'LuaPosto: a missão pesquisar1 deve aceitar essas pesquisas iniciais; não exigir tecnologia trancada pela própria conclusão dafase.', 'BaseOrbital: doca libera expedições e cinco ciclos de observatório recrutam Oráculo; esses marcos já são bons modelos de recompensa funcional.'],
    technologyMilestones: ['Marte: primeira fábrica/componente abre engenharia e logística industrial.', 'Cinturão: primeira amostra de metaisraros abre mineração de precisão, depois drones.', 'Mercúrio: primeiro satélite abre engenharia Dyson e concentradores avançados.', 'Júpiter: primeira produção de fusão abre confinamento e reatores compactos.', 'Urano: primeiro supercondutor abre pesquisa profunda e criogenia avançada.', 'Netuno: decodificação daanomalia abre o núcleo/árvore de singularidade.'],
    permanentKnowledge: 'Se marcos de ciência forem permanentes, guardar descobertas emperm e permitir bônus jácomprados apósColapso; não bloquear uma campanha nova por ter reiniciado os planetas. Investigar separadamente se missões antigas de pesquisa passam a auto concluir com pesquisa permanente.',
    acceleration: 'Reduzir repetição e espera vazia com objetivos que introduzem decisões novas; não converter todo desbloqueio em temporizador adicional nem aumentar globalmente custos como resposta ao excesso.'
  }
};
const outDir = path.join(root, 'artifacts'); fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'auditoria-missoes.json'), JSON.stringify(report, null, 2) + '\n');
const fmt = n => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
let md = '# Auditoria de missões e economia permanente\n\nNenhuma alteração aplicada ao jogo. Reproduza com `node tools/auditoria-missoes.js`; dados completos em `auditoria-missoes.json`.\n\n';
md += `Missões: **${missionBudget.totalMissions}**, em **${missionBudget.totalPhases} fases**; **${fmt(missionBudget.baseData)} dados base**. **${missionBudget.onlyDataRewards}** missões só recompensam dados. Baús de todas as fases: **${fmt(missionBudget.phaseChestBaseData)} dados base** e **${missionBudget.phaseChestCards} cartas**, antes dos multiplicadores. As recompensas diretas adicionais incluem oito recrutamentos, um desbloqueio de expedições e três entregas de recursos. Avançar as fases também abre instalações/regiões e concede baús, portanto as missões continuam relevantes além do dinheiro.\n\n`;
md += '## Orçamento por fase\n\n| Região | Fase | Missões | Dados base | Segundos na base moderada | Outras recompensas diretas |\n|---|---|---:|---:|---:|---|\n';
for (const p of phases) md += `| ${p.regionName} | ${p.phase} | ${p.missions} | ${fmt(p.baseData)} | ${fmt(p.equivalentProductionSeconds['base-moderada'])} | ${Object.entries(p.nonDataRewards).map(([k,n]) => k + ':' + n).join(', ') || '—'} |\n`;
md += '\n## Produção controlada por oito horas\n\n| Cenário | Observatórios | Nível | Oráculo | Dados/h | Dados/8h |\n|---|---:|---:|---:|---:|---:|\n';
for (const o of observatories) md += `| ${o.id} | ${o.setup.count} | ${o.setup.buildingLevel} | ${o.setup.oracleLevel} | ${fmt(o.dataPerHour)} | ${fmt(o.dataIn8Hours)} |\n`;
md += '\nCenários plausíveis controlados; não representam níveis atingidos em tempo medido de campanha. Todos usam o motor real por oito horas, com energia suficiente e nenhum gasto de dados. A base moderada usa Telemetria Profunda 2; a avançada usa Telemetria 5, Eco Industrial 2, Eco 1 e 100 fragmentos totais. A tabela completa dos bônus está no JSON.\n\n';
md += `Gastos permanentes máximos: **${fmt(finiteSinks.totalDataResearchCost)}** dados em pesquisa + **${fmt(finiteSinks.dataPromotionCostAllSpecialists)}** em onze especialistas = **${fmt(finiteSinks.totalPermanentDataSink)}**. Promoções também dependem de cartas. Depois desses tetos, o sumidouro permanente de dados termina.\n\n`;
md += '## Farm de ruínas\n\n';
for (const farm of [report.expeditions.relicLevel1, report.expeditions.capped]) md += `- ${farm.mode}: ${farm.completed.ruinas} Ruínas + ${farm.completed.ruinas2} Câmaras em oito horas ativas; **${farm.fragmentsTotalGained} fragmentos**, rendimento global **×${fmt(farm.globalYieldBefore)} → ×${fmt(farm.globalYieldAfter)}**, nenhum novo Colapso.\n`;
md += '\nO multiplicador de recompensa NÃO escala fragmentos: 1 continua 1. O problema é a repetição sem novo Colapso somada ao ganho permanente de fragsTotal. O teste máximo usa duas sondas resgatadas e relançadas de imediato, Relíquia 10, pesquisas e universo Ancestral. Ambos começam após um Colapso anterior e com 40 fragmentos iniciais; não medem o tempo para atingir os níveis máximos. Ausência real de oito horas só completa as duas expedições lançadas; não há relançamento automático.\n\n';
md += '## Problemas e propostas\n\n';
for (const p of report.problems) md += `- **${p.priority} — ${p.id}:** ${p.finding} Proposta: ${p.adjustment}\n`;
md += '\n## Limite do balanço anterior\n\n' + report.method.oldBalanceLimit + '\n\nTambém corrigir qualquer referência antiga a combustível fixo de cargueiro: hoje ele escala pela raiz quadrada da capacidade. Esta auditoria não mede automaticamente campanhas de 5/10 Colapsos; as fórmulas e os limites permanentes estão separados do tempo real de campanha.\n';
fs.writeFileSync(path.join(outDir, 'auditoria-missoes.md'), md);
console.log(JSON.stringify({ missions: missionBudget, finiteSinks, observatories: observatories.map(o => ({ id:o.id, dataPerSecond:o.dataPerSecond, dataIn8Hours:o.dataIn8Hours })), ruins: [report.expeditions.relicLevel1, report.expeditions.capped].map(x => ({ mode:x.mode, completed:x.completed, frags:x.fragmentsTotalGained, yield:x.globalYieldAfter })), unattended: report.expeditions.unattended, files: ['artifacts/auditoria-missoes.json', 'artifacts/auditoria-missoes.md'] }, null, 2));
