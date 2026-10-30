/* HELIOS IDLE — dados configuráveis de balanceamento.
   Todo número de custo, receita, tempo, missão, recompensa, especialista,
   pesquisa, universo e regra do Colapso fica aqui. */
(function (H) {
  'use strict';
  const D = {};

  D.SAVE_KEY = 'helios_idle_save';
  D.SAVE_VERSION = 4; // v4: construções que saíram de uma região (Plataforma Atmosférica em Júpiter) são desmontadas com reembolso
  // v3: descobertas permanentes (perm.disc). v2: ciclos manuais registram máquinas/nível pagos (mc), cargueiros podem aguardar descarga, revisão (rev)
  D.AUTOSAVE_SEC = 20;
  D.OFFLINE_BASE_H = 8;

  // Identidade visual do jogador. Não concede bônus nem interfere no progresso.
  D.commanderAvatars = {
    aurora: { name: 'Aurora', label: 'Exploradora', color: '#3fe0ff' },
    atlas: { name: 'Atlas', label: 'Navegante', color: '#ffd76a' },
    sentinela: { name: 'Sentinela', label: 'Sintético', color: '#b07cff' },
    eclipse: { name: 'Eclipse', label: 'Traje orbital', color: '#7fe0c0' },
  };

  // ---------------- RECURSOS ----------------
  // v = valor usado no cálculo do Colapso; cap = armazenamento base por região
  D.res = {
    ore:    { name: 'Minério',            pl: 'minérios',              v: 1,    cap: 200, color: '#b9a48a', glyph: 'ore' },
    metal:  { name: 'Metal',              pl: 'metais',                v: 3,    cap: 150, color: '#9fb4c8', glyph: 'metal' },
    alloy:  { name: 'Ligas',              pl: 'ligas',                 v: 10,   cap: 100, color: '#e0a35a', glyph: 'alloy' },
    comp:   { name: 'Componentes',        pl: 'componentes',           v: 30,   cap: 80,  color: '#7fe0c0', glyph: 'comp' },
    ice:    { name: 'Gelo',               pl: 'unidades de gelo',      v: 1,    cap: 200, color: '#a8e6ff', glyph: 'ice' },
    gas:    { name: 'Gases',              pl: 'unidades de gás',       v: 2,    cap: 200, color: '#e6d27a', glyph: 'gas' },
    fuel:   { name: 'Combustível',        pl: 'unidades de combustível', v: 4,  cap: 150, color: '#ff8f5a', glyph: 'fuel' },
    rare:   { name: 'Metais Raros',       pl: 'metais raros',          v: 20,   cap: 80,  color: '#d58cff', glyph: 'rare' },
    cell:   { name: 'Células Solares',    pl: 'células solares',       v: 60,   cap: 60,  color: '#5ab0ff', glyph: 'cell' },
    fusion: { name: 'Comb. de Fusão',     pl: 'unidades de combustível de fusão', v: 80, cap: 60, color: '#ff5ad1', glyph: 'fusion' },
    hull:   { name: 'Módulos Estruturais', pl: 'módulos estruturais',  v: 200,  cap: 40,  color: '#c8c8d8', glyph: 'hull' },
    cryo:   { name: 'Supercondutores',    pl: 'supercondutores',       v: 150,  cap: 40,  color: '#6ff0ff', glyph: 'cryo' },
    exotic: { name: 'Matéria Exótica',    pl: 'unidades de matéria exótica', v: 1000, cap: 20, color: '#b07cff', glyph: 'exotic' },
    sat:    { name: 'Satélites Dyson',    pl: 'satélites Dyson',       v: 400,  cap: 30,  color: '#ffd76a', glyph: 'sat' },
  };
  D.resOrder = ['ore', 'metal', 'alloy', 'comp', 'ice', 'gas', 'fuel', 'rare', 'cell', 'fusion', 'hull', 'cryo', 'exotic', 'sat'];

  // ---------------- CATEGORIAS ----------------
  D.cats = {
    extract:  { name: 'Extração',  spec: 'iris' },
    industry: { name: 'Indústria', spec: 'vulcano' },
    ice:      { name: 'Gelo',      spec: 'nix' },
    gas:      { name: 'Gases',     spec: 'aura' },
    solar:    { name: 'Solar',     spec: 'helio' },
    fusion:   { name: 'Fusão',     spec: 'ion' },
    research: { name: 'Pesquisa',  spec: 'oraculo' },
    power:    { name: 'Energia',   spec: null },
    storage:  { name: 'Logística', spec: null },
  };

  // ---------------- INSTALAÇÕES ----------------
  // in/out por ciclo e por unidade construída. t = segundos por ciclo. e = energia consumida (por unidade).
  // gen = energia gerada (passiva). cost = custo base; g = crescimento por unidade.
  // up = custo de melhoria [recurso, base, nível mínimo]; ug = crescimento por nível.
  D.buildings = {
    painel: { name: 'Painel Solar', pl: 'painéis solares', cat: 'power', tier: 0, passive: true, gen: 4, solar: true,
      cost: { metal: 8 }, g: 1.22, up: [['metal', 20, 1], ['alloy', 8, 3], ['comp', 4, 5]], ug: 1.8,
      desc: 'Gera energia contínua. Rende menos longe do Sol.' },
    coletor_solar: { name: 'Coletor Solar', pl: 'coletores solares', cat: 'power', tier: 0, passive: true, gen: 15, solar: true,
      cost: { metal: 40, cell: 3 }, g: 1.28, up: [['metal', 60, 1], ['cell', 6, 2], ['comp', 8, 4]], ug: 1.8,
      desc: 'Grande espelho de captação. Ideal perto do Sol.' },
    reator: { name: 'Reator de Fusão', pl: 'reatores de fusão', cat: 'power', tier: 0, passive: true, gen: 60,
      cost: { alloy: 40, comp: 12, fusion: 8 }, g: 1.32, up: [['alloy', 80, 1], ['comp', 30, 1], ['fusion', 15, 3]], ug: 1.9,
      desc: 'Energia constante em qualquer órbita.' },
    armazem: { name: 'Armazém', pl: 'armazéns', cat: 'storage', tier: 0, passive: true, storage: 0.6,
      cost: { metal: 30 }, g: 1.5, up: [['metal', 60, 1], ['alloy', 20, 2], ['comp', 10, 4]], ug: 1.9,
      desc: 'Aumenta o armazenamento de todos os recursos da região.' },

    extrator: { name: 'Extrator de Minério', pl: 'extratores', cat: 'extract', tier: 1, t: 3, e: 1,
      out: { ore: 3 }, cost: { metal: 10 }, g: 1.28, up: [['metal', 15, 1], ['alloy', 6, 3], ['comp', 3, 5]], ug: 1.85,
      desc: 'Perfura o regolito e extrai minério.' },
    min_ast: { name: 'Minerador de Asteroides', pl: 'mineradores de asteroides', cat: 'extract', tier: 1, t: 4, e: 3,
      out: { ore: 8 }, cost: { metal: 30, alloy: 5 }, g: 1.28, up: [['metal', 40, 1], ['alloy', 15, 2], ['comp', 6, 4]], ug: 1.85,
      desc: 'Captura rochas do cinturão e as tritura.' },
    garimpo: { name: 'Garimpeira de Raros', pl: 'garimpeiras de raros', cat: 'extract', tier: 1, t: 6, e: 4,
      out: { rare: 1 }, cost: { metal: 40, alloy: 10 }, g: 1.32, up: [['metal', 60, 1], ['alloy', 25, 1], ['comp', 10, 3]], ug: 1.9,
      desc: 'Separa metais raros de asteroides metálicos.' },
    esc_gelo: { name: 'Escavadora de Gelo', pl: 'escavadoras de gelo', cat: 'ice', tier: 1, t: 4, e: 1,
      out: { ice: 3 }, cost: { metal: 12 }, g: 1.28, up: [['metal', 18, 1], ['alloy', 6, 3], ['comp', 3, 5]], ug: 1.85,
      desc: 'Escava gelo de crateras e anéis.' },
    plataforma: { name: 'Plataforma Atmosférica', pl: 'plataformas atmosféricas', cat: 'gas', tier: 1, t: 5, e: 2,
      out: { gas: 4 }, cost: { metal: 30, alloy: 8 }, g: 1.28, up: [['metal', 40, 1], ['alloy', 15, 1], ['comp', 6, 3]], ug: 1.85,
      desc: 'Flutua nas nuvens e coleta gases.' },

    refinaria: { name: 'Refinaria', pl: 'refinarias', cat: 'industry', tier: 2, t: 4, e: 2,
      in: { ore: 4 }, out: { metal: 2 }, cost: { metal: 15, ore: 10 }, g: 1.3, up: [['metal', 20, 1], ['alloy', 8, 3], ['comp', 4, 5]], ug: 1.85,
      desc: 'Funde minério em metal.' },
    eletrolisador: { name: 'Eletrolisador', pl: 'eletrolisadores', cat: 'ice', tier: 2, t: 5, e: 3,
      in: { ice: 4 }, out: { fuel: 2 }, cost: { metal: 25 }, g: 1.3, up: [['metal', 30, 1], ['alloy', 10, 2], ['comp', 5, 4]], ug: 1.85,
      desc: 'Separa gelo em hidrogênio e oxigênio: combustível.' },
    quimica: { name: 'Refinaria Química', pl: 'refinarias químicas', cat: 'gas', tier: 2, t: 6, e: 3,
      in: { gas: 5 }, out: { fuel: 3 }, cost: { metal: 30, alloy: 10 }, g: 1.3, up: [['metal', 40, 1], ['alloy', 15, 1], ['comp', 6, 3]], ug: 1.85,
      desc: 'Converte gases em combustível.' },
    forja: { name: 'Forja', pl: 'forjas', cat: 'industry', tier: 3, t: 6, e: 3,
      in: { metal: 3 }, out: { alloy: 1 }, cost: { metal: 40 }, g: 1.32, up: [['metal', 50, 1], ['alloy', 12, 2], ['comp', 5, 4]], ug: 1.85,
      desc: 'Combina metais em ligas resistentes.' },
    fotovoltaica: { name: 'Fundição Fotovoltaica', pl: 'fundições fotovoltaicas', cat: 'solar', tier: 3, t: 8, e: 6,
      in: { metal: 3, rare: 1 }, out: { cell: 1 }, cost: { metal: 50, alloy: 10 }, g: 1.34, up: [['metal', 80, 1], ['alloy', 20, 1], ['comp', 10, 2]], ug: 1.9,
      desc: 'Fabrica células solares com metais raros.' },
    ref_fusao: { name: 'Refinaria de Fusão', pl: 'refinarias de fusão', cat: 'fusion', tier: 3, t: 10, e: 10,
      in: { gas: 6 }, out: { fusion: 1 }, cost: { alloy: 40, comp: 10 }, g: 1.36, up: [['alloy', 60, 1], ['comp', 20, 1], ['fusion', 6, 2]], ug: 1.9,
      desc: 'Separa hélio-3 e deutério para fusão.' },
    fabrica: { name: 'Fábrica de Componentes', pl: 'fábricas de componentes', cat: 'industry', tier: 4, t: 8, e: 4,
      in: { alloy: 2, metal: 2 }, out: { comp: 1 }, cost: { metal: 40, alloy: 15 }, g: 1.34, up: [['metal', 60, 1], ['alloy', 25, 1], ['comp', 8, 2]], ug: 1.9,
      desc: 'Monta componentes para instalações e naves.' },
    criogenico: { name: 'Processador Criogênico', pl: 'processadores criogênicos', cat: 'ice', tier: 4, t: 12, e: 10,
      in: { ice: 6, rare: 1 }, out: { cryo: 1 }, cost: { alloy: 40, comp: 10 }, g: 1.36, up: [['alloy', 60, 1], ['comp', 20, 1], ['rare', 10, 2]], ug: 1.9,
      desc: 'Produz supercondutores a temperaturas extremas.' },
    fab_sat: { name: 'Fábrica de Satélites', pl: 'fábricas de satélites', cat: 'solar', tier: 5, t: 20, e: 15,
      in: { cell: 3, comp: 2 }, out: { sat: 1 }, cost: { metal: 80, alloy: 30, cell: 8 }, g: 1.4, up: [['metal', 120, 1], ['alloy', 40, 1], ['cell', 15, 1]], ug: 1.9,
      desc: 'Monta os satélites coletores do enxame de Dyson.' },
    estaleiro: { name: 'Grande Estaleiro', pl: 'grandes estaleiros', cat: 'industry', tier: 5, t: 15, e: 12,
      in: { alloy: 4, comp: 2 }, out: { hull: 1 }, cost: { alloy: 60, comp: 20 }, g: 1.4, up: [['alloy', 90, 1], ['comp', 30, 1], ['hull', 4, 3]], ug: 1.9,
      desc: 'Constrói módulos estruturais gigantes.' },
    observatorio: { name: 'Observatório', pl: 'observatórios', cat: 'research', tier: 6, t: 30, e: 5,
      out: { data: 1 }, cost: { metal: 60, alloy: 20 }, g: 1.5, up: [['metal', 80, 1], ['alloy', 30, 1], ['comp', 10, 2]], ug: 2,
      desc: 'Produz dados de pesquisa permanentes.' },
    obs_profundo: { name: 'Observatório Profundo', pl: 'observatórios profundos', cat: 'research', tier: 6, t: 30, e: 25,
      in: { cryo: 1 }, out: { data: 6 }, cost: { alloy: 100, comp: 40, cryo: 5 }, g: 1.45, up: [['alloy', 120, 1], ['comp', 40, 1], ['cryo', 10, 1]], ug: 1.9,
      desc: 'Escuta o sinal vindo da borda do sistema.' },
    lab_anomalia: { name: 'Laboratório de Anomalia', pl: 'laboratórios de anomalia', cat: 'research', tier: 7, t: 25, e: 30,
      in: { cryo: 2, fusion: 2 }, out: { exotic: 1 }, cost: { alloy: 120, comp: 50, hull: 2 }, g: 1.4, up: [['alloy', 150, 1], ['comp', 60, 1], ['hull', 4, 1]], ug: 1.9,
      desc: 'Condensa matéria exótica perto da anomalia.' },
  };
  D.levelYield = (lvl) => 1 + 0.5 * (lvl - 1);
  // Consumo de energia = e × máquinas × velocidade^energySpeedExp (velocidade de especialistas, pesquisa e universo).
  // 0 = consumo fixo; 1 = proporcional à velocidade.
  D.energySpeedExp = 0.3;
  // Exportação de excedente: com a opção ligada, o que passa do armazenamento é enviado à Terra e conta
  // como produzido (valor do Colapso). Taxa de conversão em dados: 0 (zerada para conter o excesso de dados
  // em partidas de farm); valor do recurso × taxa se for religada.
  D.exportRate = 0;
  D.maxBuildingLevel = 25;

  // ---------------- ESPECIALISTAS ----------------
  D.specSpeed = [1, 2, 4, 8, 12, 16, 24, 32, 48, 64, 96];          // por nível
  // ---------------- CIÊNCIA ----------------
  // Instalações cuja saída é "data" (Observatório e Observatório Profundo) usam esta escala própria, em vez da
  // curva industrial (D.specSpeed) e do rendimento global dos fragmentos. O Laboratório de Anomalia (matéria
  // exótica) continua na curva industrial. dataGain (Oráculo e Telemetria) continua aplicado uma única vez.
  D.science = {
    oracleSpeed: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12],   // velocidade científica por nível do Oráculo (início igual ao industrial)
    globalSpeedExp: 0.5,                                 // velocidade global (Eco, Eco Industrial) entra pela raiz
    fragBonus: 0.005, fragBonusMax: 0.5,                 // +0,5% por fragmento total, até +50% (indústria: +3% sem teto)
    levelYield: (lvl) => 1 + 0.3 * (lvl - 1),            // rendimento por nível do observatório (indústria: +50%/nível)
  };
  D.specCards = [0, 5, 10, 20, 35, 60, 100, 150, 250, 400];         // cartas para subir do nível i para i+1
  D.specData  = [0, 100, 250, 600, 1500, 3500, 8000, 18000, 40000, 90000];
  D.specMaxLevel = 10;
  D.rarities = { comum: { name: 'Comum', color: '#9fb4c8' }, raro: { name: 'Raro', color: '#3fe0ff' },
    epico: { name: 'Épico', color: '#b07cff' }, lendario: { name: 'Lendário', color: '#ffc857' } };

  D.specs = {
    iris:    { name: 'Íris', role: 'Engenheira Lunar', kind: 'Humana', rarity: 'comum', cat: 'extract', color: '#3fe0ff',
      desc: 'Automatiza os extratores e acelera a mineração.', quote: 'Toda rocha guarda um caminho.' },
    vulcano: { name: 'Vulcano', role: 'Mestre de Forja', kind: 'Robô', rarity: 'comum', cat: 'industry', color: '#ff8f5a',
      desc: 'Automatiza refinarias, forjas, fábricas e estaleiros.', quote: 'Calor, pressão, paciência.' },
    nix:     { name: 'Nix', role: 'Especialista Criogênica', kind: 'Humana', rarity: 'raro', cat: 'ice', color: '#a8e6ff',
      desc: 'Automatiza extração e processamento de gelo.', quote: 'O frio também trabalha.' },
    oraculo: { name: 'Oráculo', role: 'IA de Pesquisa', kind: 'IA', rarity: 'epico', cat: 'research', color: '#b07cff',
      desc: 'Automatiza observatórios e aumenta os dados de pesquisa (+10% por nível).', quote: 'Eu vejo padrões no ruído.' },
    vega:    { name: 'Vega', role: 'Piloto de Carga', kind: 'Humano', rarity: 'raro', cat: 'route', color: '#5ef2a0',
      desc: 'Automatiza rotas e acelera viagens (+50% de velocidade por nível).', quote: 'Me dá uma janela e eu chego.' },
    helio:   { name: 'Hélio', role: 'IA Solar', kind: 'IA', rarity: 'epico', cat: 'solar', color: '#ffd76a',
      desc: 'Automatiza instalações solares e aumenta a geração solar (+25% por nível).', quote: 'O Sol é generoso com quem escuta.' },
    aura:    { name: 'Aura', role: 'Exploradora Atmosférica', kind: 'Humana', rarity: 'raro', cat: 'gas', color: '#e6d27a',
      desc: 'Automatiza plataformas de gás e refinarias químicas.', quote: 'Entre as nuvens, sempre há vento a favor.' },
    ion:     { name: 'Íon', role: 'Engenheiro de Fusão', kind: 'Robô', rarity: 'epico', cat: 'fusion', color: '#ff5ad1',
      desc: 'Automatiza instalações de combustível de fusão.', quote: 'Contenção é uma forma de arte.' },
    // especiais (conquistas)
    lumen:   { name: 'Lúmen', role: 'Arquiteta do Enxame', kind: 'IA', rarity: 'lendario', cat: 'dyson', color: '#ffc857', special: true,
      desc: 'Concedida ao concluir o enxame de Dyson. +20% de energia em todas as regiões por nível e contribuição automática ao enxame.', quote: 'Cada satélite é uma estrela emprestada.' },
    eco:     { name: 'Eco', role: 'Eco da Singularidade', kind: 'Desconhecido', rarity: 'lendario', cat: 'global', color: '#b07cff', special: true,
      desc: 'Concedido no primeiro Colapso. +15% de velocidade global por nível e +2h de progresso offline.', quote: 'Já estive aqui. Você também.' },
    reliquia:{ name: 'Relíquia', role: 'Guardião Ancestral', kind: 'Robô', rarity: 'epico', cat: 'exped', color: '#e0a35a', special: true,
      desc: 'Encontrado em ruínas precursoras. +25% de recompensas e −5% de duração das expedições por nível.', quote: 'Esperei um ciclo inteiro do universo.' },
  };
  D.specOrder = ['iris', 'vulcano', 'nix', 'oraculo', 'vega', 'helio', 'aura', 'ion', 'lumen', 'eco', 'reliquia'];

  // ---------------- MISSÕES (helpers) ----------------
  const B = (b, n, rw, extra) => Object.assign({ t: 'build', b, n, rw }, extra);
  const L = (b, n, rw, extra) => Object.assign({ t: 'level', b, n, rw }, extra);
  const P = (r, n, rw, extra) => Object.assign({ t: 'prod', r, n, rw }, extra);
  const C = (b, n, rw, extra) => Object.assign({ t: 'cycles', b, n, rw }, extra);
  const PAY = (cost, title, desc, rw) => ({ t: 'pay', cost, title, desc, rw });
  const EN = (n, rw) => ({ t: 'energy', n, rw });
  const RT = (n, rw) => ({ t: 'route', n, rw });
  const DL = (r, n, rw) => ({ t: 'deliver', r, n, rw });
  const SH = (n, rw, extra) => Object.assign({ t: 'ship', n, rw }, extra);
  const EX = (n, rw) => ({ t: 'exped', n, rw });
  const RS = (n, rw) => ({ t: 'research', n, rw });
  const PR = (n, rw) => ({ t: 'promote', n, rw });
  const DY = (n, rw) => ({ t: 'dyson', n, rw });
  const TT = (n, rw) => ({ t: 'total', n, rw });
  const DA = (n, rw) => ({ t: 'data', n, rw });
  const CORE = (rw) => ({ t: 'core', n: 1, rw, title: 'Construir o Núcleo da Singularidade' });
  const REC = (s) => ({ spec: s });

  // ---------------- REGIÕES ----------------
  // au = raio orbital real (distâncias/rotas). vis = raio no mapa. period = segundos por órbita (tempo comprimido).
  // build: instalação -> fase em que é liberada (número) ou id de região que precisa estar liberada (texto).
  // A ordem das chaves é a ordem dos cartões na tela (Painel Solar e Armazém sempre no topo).
  D.regions = {
    lua: { name: 'Lua', sub: 'Satélite da Terra', au: 1.0, vis: 128, period: 600, a0: 0.4, solar: 1, color: '#cfd6e6', color2: '#6f7a90',
      role: 'Mineração inicial, gelo, refino básico e o primeiro combustível.',
      specs: ['iris', 'vulcano', 'nix', 'oraculo'],
      build: { painel: 0, armazem: 1, extrator: 0, refinaria: 0, forja: 2, esc_gelo: 1, eletrolisador: 2, observatorio: 3, reator: 'jupiter' },
      start: { b: { extrator: 1, refinaria: 1, painel: 2 }, st: { metal: 25 } },
      phases: [
        { name: 'Pouso', tutorial: true, story: 'O módulo Aurora toca o regolito. A Terra brilha no horizonte. Hora de trabalhar.',
          missions: [
            B('extrator', 3, { data: 5, res: { metal: 10 } }),
            P('ore', 60, { data: 5 }),
            PAY({ metal: 30 }, 'Restaurar a estação abandonada', 'Os módulos da antiga Estação Selene ainda respondem. Entregue metal para religá-los.', { data: 10, res: { ore: 30 } }),
            C('extrator', 12, REC('iris'), { title: 'Recrutar Íris', desc: 'Opere os extratores {n} vezes. A engenheira Íris acorda na estação restaurada.' }),
          ] },
        { name: 'Posto de Extração', story: 'Íris assume os extratores. As primeiras luzes da base se acendem na cratera.',
          missions: [
            B('esc_gelo', 2, { data: 10 }),
            P('metal', 100, { data: 10 }),
            L('extrator', 2, { data: 10 }),
            C('refinaria', 20, REC('vulcano'), { title: 'Recrutar Vulcano', desc: 'Opere a refinaria {n} vezes. O robô Vulcano chega no próximo módulo de carga.' }),
            B('painel', 4, { data: 10, res: { metal: 20 } }),
            RS(1, { data: 15 }, { }),
            P('ice', 150, { data: 10 }),
            B('armazem', 1, { data: 15 }),
          ] },
        { name: 'Complexo Industrial', story: 'O gelo das crateras escuras vira combustível. A Lua começa a se sustentar sozinha.',
          missions: [
            B('forja', 1, { data: 10 }),
            B('eletrolisador', 1, { data: 10 }),
            P('fuel', 30, { data: 15 }, { title: 'Produzir o primeiro combustível' }),
            C('esc_gelo', 30, REC('nix'), { title: 'Recrutar Nix', desc: 'Opere as escavadoras de gelo {n} vezes. Nix vem estudar as crateras.' }),
            P('alloy', 50, { data: 15 }),
            L('refinaria', 3, { data: 15 }),
            B('extrator', 6, { data: 15 }),
            P('metal', 800, { data: 20 }),
          ] },
        { name: 'Base Orbital', story: 'Uma doca em órbita lunar abre caminho para sondas e cargueiros.',
          missions: [
            PAY({ metal: 120, alloy: 40 }, 'Montar a Doca Orbital', 'A doca libera as expedições com sondas.', { data: 20, unlock: 'expeditions' }),
            B('observatorio', 1, { data: 15 }),
            P('alloy', 200, { data: 20 }),
            EX(1, { data: 20 }),
            C('observatorio', 5, REC('oraculo'), { title: 'Recrutar Oráculo', desc: 'Opere o observatório {n} vezes. Uma IA responde ao sinal.' }),
            L('forja', 2, { data: 20 }),
            P('fuel', 150, { data: 20 }),
            EN(40, { data: 25 }),
          ] },
      ] },

    marte: { name: 'Marte', sub: 'O planeta vermelho', au: 1.52, vis: 165, period: 1080, a0: 2.1, solar: 0.6, color: '#d9653b', color2: '#7a2e1a',
      role: 'Indústria pesada: ligas, componentes e cargueiros.',
      specs: ['vulcano', 'vega', 'iris'],
      launch: { cost: { metal: 150, alloy: 50, fuel: 60 } },
      build: { extrator: 0, refinaria: 0, forja: 0, fabrica: 0, painel: 0, armazem: 0, observatorio: 1, reator: 'jupiter' },
      start: { b: { extrator: 1, refinaria: 1, forja: 1, painel: 4 }, st: { metal: 80, alloy: 25, fuel: 40 } },
      phases: [
        { name: 'Cabeça de Ponte', story: 'Poeira vermelha e um céu cor de ferrugem. Marte será a forja do sistema.',
          missions: [
            B('extrator', 3, { data: 15 }),
            RT(1, { data: 20 }, { }),
            B('fabrica', 1, { data: 20 }),
            SH(3, REC('vega'), { title: 'Recrutar Vega', desc: 'Complete {n} viagens de carga envolvendo Marte. A piloto Vega aceita o contrato.' }),
            P('comp', 15, { data: 20 }),
            B('painel', 6, { data: 20 }),
            DL('fuel', 40, { data: 20 }),
            L('fabrica', 2, { data: 25 }),
          ] },
        { name: 'Forjas Vermelhas', story: 'As forjas marcianas nunca dormem. Cargueiros cruzam o vazio até a Lua.',
          missions: [
            B('forja', 2, { data: 25 }),
            P('alloy', 250, { data: 25 }),
            P('comp', 100, { data: 25 }),
            L('extrator', 4, { data: 25 }),
            RT(2, { data: 25 }),
            B('armazem', 2, { data: 25 }),
            EX(3, { data: 30 }),
            P('metal', 2500, { data: 30 }),
          ] },
        { name: 'Estaleiros de Marte', story: 'Cascos de cargueiros surgem em Valles Marineris. O cinturão está ao alcance.',
          missions: [
            B('fabrica', 3, { data: 30 }),
            L('forja', 3, { data: 30 }),
            PR(2, { data: 30 }),
            P('comp', 400, { data: 30 }),
            EN(60, { data: 30 }),
            TT(25, { data: 30 }),
            RS(4, { data: 35 }),
            P('alloy', 1200, { data: 40 }),
          ] },
      ] },

    cinturao: { name: 'Cinturão de Asteroides', sub: 'Entre Marte e Júpiter', au: 2.7, vis: 202, period: 1800, a0: 4.0, solar: 0.4, color: '#a08f7a', color2: '#4d4238', belt: true,
      role: 'Metais raros e expansão da logística.',
      specs: ['iris', 'vulcano', 'vega'],
      launch: { cost: { comp: 40, alloy: 80, fuel: 60 } },
      build: { min_ast: 0, garimpo: 0, refinaria: 0, forja: 0, painel: 0, armazem: 0, reator: 'jupiter' },
      start: { b: { min_ast: 1, refinaria: 1, painel: 6 }, st: { metal: 100, alloy: 40, fuel: 40 } },
      phases: [
        { name: 'Fronteira de Rocha', story: 'Milhões de rochas girando no escuro. Algumas valem mais que planetas inteiros.',
          missions: [
            B('min_ast', 2, { data: 30 }),
            B('garimpo', 1, { data: 30 }),
            P('rare', 20, { data: 30 }),
            RT(2, { data: 30 }),
            P('ore', 2500, { data: 30 }),
            L('min_ast', 2, { data: 30 }),
            DL('fuel', 80, { data: 30 }),
            B('painel', 10, { data: 35 }),
          ] },
        { name: 'Rede Logística', story: 'O cinturão vira um entroncamento: tudo que é raro passa por aqui.',
          missions: [
            B('garimpo', 3, { data: 35 }),
            P('rare', 150, { data: 35 }),
            L('garimpo', 3, { data: 35 }),
            SH(10, { data: 35 }),
            P('metal', 1500, { data: 35 }),
            B('armazem', 2, { data: 35 }),
            EX(5, { data: 40 }),
            P('rare', 300, { data: 45 }),
          ] },
      ] },

    mercurio: { name: 'Mercúrio', sub: 'À beira do Sol', au: 0.39, vis: 62, period: 180, a0: 1.0, solar: 3, color: '#a7a19a', color2: '#5b5550',
      role: 'Grandes estruturas de geração solar e a fundação do enxame de Dyson.',
      specs: ['helio', 'iris', 'vulcano'],
      launch: { cost: { rare: 40, alloy: 80, fuel: 80 } },
      build: { extrator: 0, refinaria: 0, forja: 0, fotovoltaica: 0, painel: 0, coletor_solar: 0, armazem: 0, fab_sat: 1, reator: 'jupiter' },
      start: { b: { extrator: 1, refinaria: 1, painel: 2 }, st: { metal: 120, alloy: 40, rare: 20, comp: 10, fuel: 40 } },
      phases: [
        { name: 'Margem do Sol', story: 'O Sol ocupa metade do céu. Aqui, luz é matéria-prima.',
          missions: [
            B('fotovoltaica', 1, { data: 40 }),
            P('cell', 15, { data: 40 }),
            B('coletor_solar', 2, { data: 40 }),
            C('fotovoltaica', 15, REC('helio'), { title: 'Recrutar Hélio', desc: 'Opere a fundição fotovoltaica {n} vezes. A IA Hélio desperta nos arquivos solares.' }),
            DL('rare', 50, { data: 40 }),
            EN(120, { data: 40 }),
            L('fotovoltaica', 2, { data: 40 }),
            P('metal', 1500, { data: 45 }),
          ] },
        { name: 'Fundação do Enxame', story: 'O primeiro satélite coletor abre suas velas. O enxame de Dyson começou.',
          missions: [
            B('fab_sat', 1, { data: 45 }),
            P('sat', 5, { data: 45 }),
            DL('comp', 50, { data: 45 }),
            DY(1, { data: 50 }),
            L('coletor_solar', 2, { data: 45 }),
            P('cell', 200, { data: 45 }),
            B('fotovoltaica', 3, { data: 45 }),
            P('sat', 15, { data: 55 }),
          ] },
      ] },

    venus: { name: 'Vênus', sub: 'Nuvens de ácido', au: 0.72, vis: 95, period: 420, a0: 3.0, solar: 1.8, color: '#e8c27a', color2: '#9a6b2a',
      role: 'Plataformas atmosféricas, coleta de gases e combustível.',
      specs: ['aura', 'helio', 'vega'],
      launch: { cost: { cell: 30, metal: 300, fuel: 100 } },
      build: { plataforma: 0, quimica: 0, painel: 0, coletor_solar: 0, armazem: 0, reator: 'jupiter' },
      start: { b: { plataforma: 1, quimica: 1, painel: 2 }, st: { metal: 150, alloy: 50, fuel: 20 } },
      phases: [
        { name: 'Céus Ácidos', story: 'A cinquenta quilômetros do chão, a pressão é quase terrestre. As plataformas flutuam.',
          missions: [
            B('plataforma', 3, { data: 50 }),
            P('gas', 300, { data: 50 }),
            B('quimica', 2, { data: 50 }),
            C('plataforma', 20, REC('aura'), { title: 'Recrutar Aura', desc: 'Opere as plataformas {n} vezes. Aura assume os céus de Vênus.' }),
            P('fuel', 300, { data: 50 }),
            RT(1, { data: 50 }),
            L('plataforma', 2, { data: 50 }),
            EN(100, { data: 55 }),
          ] },
        { name: 'Cidades Flutuantes', story: 'Vênus vira o posto de combustível do sistema interior.',
          missions: [
            B('plataforma', 6, { data: 55 }),
            L('quimica', 3, { data: 55 }),
            P('fuel', 1500, { data: 55 }),
            DY(2, { data: 60 }),
            SH(10, { data: 55 }),
            B('armazem', 2, { data: 55 }),
            P('gas', 4000, { data: 55 }),
            EX(8, { data: 65 }),
          ] },
      ] },

    jupiter: { name: 'Júpiter', sub: 'O gigante e suas luas', au: 5.2, vis: 245, period: 3000, a0: 5.2, solar: 0.15, color: '#d8b48a', color2: '#8a5a3a',
      role: 'Combustíveis avançados e tecnologia de fusão, com gases trazidos de Vênus.',
      specs: ['ion', 'aura', 'vega'],
      launch: { cost: { fuel: 300, alloy: 80, metal: 200 } },
      // sem coleta própria de gases: Vênus é o polo e abastece as refinarias de Júpiter por rota
      build: { quimica: 0, ref_fusao: 0, reator: 0, painel: 0, armazem: 0 },
      start: { b: { ref_fusao: 1, reator: 1 }, st: { alloy: 120, comp: 40, metal: 150, fuel: 60, gas: 150 } },
      phases: [
        { name: 'Gigante Gasoso', story: 'Tempestades maiores que a Terra. Nas camadas altas, hélio-3 espera.',
          missions: [
            RT(1, { data: 60 }),
            DL('gas', 600, { data: 60 }),
            B('ref_fusao', 2, { data: 60 }),
            C('ref_fusao', 10, REC('ion'), { title: 'Recrutar Íon', desc: 'Opere as refinarias de fusão {n} vezes. Íon chega de Europa.' }),
            P('fusion', 30, { data: 60 }),
            B('reator', 2, { data: 60 }),
            SH(6, { data: 60 }),
            EN(200, { data: 65 }),
          ] },
        { name: 'Forja de Fusão', story: 'Reatores acendem em Ganimedes. O sistema exterior tem energia própria.',
          missions: [
            L('ref_fusao', 3, { data: 65 }),
            P('fusion', 200, { data: 65 }),
            B('reator', 4, { data: 65 }),
            DY(3, { data: 70 }),
            RT(2, { data: 65 }),
            P('fusion', 500, { data: 65 }),
            L('reator', 3, { data: 65 }),
            PR(3, { data: 75 }),
          ] },
      ] },

    saturno: { name: 'Saturno', sub: 'Senhor dos anéis', au: 9.5, vis: 282, period: 4500, a0: 0.2, solar: 0.08, color: '#e6cf8f', color2: '#9a8550', rings: true,
      role: 'Gelo dos anéis e grandes estaleiros.',
      specs: ['nix', 'vulcano', 'vega'],
      launch: { cost: { fusion: 40, alloy: 100, fuel: 200 } },
      build: { esc_gelo: 0, eletrolisador: 0, estaleiro: 0, reator: 0, armazem: 0, painel: 0 },
      start: { b: { esc_gelo: 1, eletrolisador: 1, reator: 1 }, st: { alloy: 160, comp: 60, fusion: 20, metal: 150 } },
      phases: [
        { name: 'Anéis de Gelo', story: 'Os anéis são feitos de gelo quase puro. Um oceano congelado em órbita.',
          missions: [
            B('esc_gelo', 4, { data: 70 }),
            B('estaleiro', 1, { data: 70 }),
            P('hull', 5, { data: 70 }),
            DL('comp', 60, { data: 70 }),
            P('ice', 3000, { data: 70 }),
            L('estaleiro', 2, { data: 70 }),
            B('eletrolisador', 2, { data: 70 }),
            EN(250, { data: 75 }),
          ] },
        { name: 'Grandes Estaleiros', story: 'Módulos do tamanho de cidades deixam as docas de Titã.',
          missions: [
            B('estaleiro', 3, { data: 75 }),
            P('hull', 40, { data: 75 }),
            DY(4, { data: 80 }),
            L('esc_gelo', 4, { data: 75 }),
            P('fuel', 2000, { data: 75 }),
            B('reator', 5, { data: 75 }),
            SH(15, { data: 75 }),
            P('hull', 80, { data: 85 }),
          ] },
      ] },

    urano: { name: 'Urano', sub: 'O gigante inclinado', au: 19.2, vis: 315, period: 6000, a0: 3.6, solar: 0.04, color: '#9fe3e8', color2: '#3f8a92',
      role: 'Processamento criogênico e materiais avançados.',
      specs: ['nix', 'ion', 'oraculo'],
      launch: { cost: { hull: 10, fuel: 300, fusion: 30 } },
      build: { esc_gelo: 0, eletrolisador: 0, criogenico: 0, reator: 0, armazem: 0, painel: 0 },
      start: { b: { esc_gelo: 1, criogenico: 1, reator: 2 }, st: { alloy: 160, comp: 60, rare: 30, fusion: 20, metal: 150 } },
      phases: [
        { name: 'Gelo Profundo', story: 'A −220 °C, a matéria se comporta de formas estranhas. E úteis.',
          missions: [
            B('criogenico', 1, { data: 80 }),
            P('cryo', 10, { data: 80 }),
            DL('rare', 100, { data: 80 }),
            B('esc_gelo', 5, { data: 80 }),
            L('criogenico', 2, { data: 80 }),
            EN(300, { data: 80 }),
            P('ice', 5000, { data: 80 }),
            B('eletrolisador', 2, { data: 85 }),
          ] },
        { name: 'Laboratórios Criogênicos', story: 'Supercondutores perfeitos. E, em Netuno, um sinal que não deveria existir.',
          missions: [
            B('criogenico', 3, { data: 85 }),
            P('cryo', 120, { data: 85 }),
            DY(5, { data: 90 }),
            L('criogenico', 4, { data: 85 }),
            DL('rare', 250, { data: 85 }),
            RS(10, { data: 85 }),
            P('cryo', 250, { data: 85 }),
            EX(12, { data: 95 }),
          ] },
      ] },

    netuno: { name: 'Netuno', sub: 'A borda e a anomalia', au: 30, vis: 345, period: 7800, a0: 5.6, solar: 0.02, color: '#4f7cff', color2: '#1b2f8a',
      role: 'Pesquisa profunda e a anomalia da singularidade.',
      specs: ['oraculo', 'nix', 'ion'],
      launch: { cost: { cryo: 30, fuel: 400, alloy: 100 } },
      build: { esc_gelo: 0, eletrolisador: 0, obs_profundo: 0, lab_anomalia: 0, reator: 0, armazem: 0 },
      start: { b: { esc_gelo: 1, obs_profundo: 1, reator: 2 }, st: { alloy: 220, comp: 90, cryo: 10, fusion: 30, metal: 200, hull: 2 } },
      phases: [
        { name: 'Sinal Fantasma', story: 'Um pulso regular, vindo de lugar nenhum. Oráculo diz que ele conta para trás.',
          missions: [
            B('obs_profundo', 2, { data: 90 }),
            DA(200, { data: 90 }),
            B('lab_anomalia', 1, { data: 90 }),
            P('exotic', 5, { data: 90 }),
            DL('cryo', 60, { data: 90 }),
            PAY({ exotic: 5, cryo: 20 }, 'Decodificar o sinal', 'A matéria exótica ressoa com o sinal. Oráculo precisa de amostras.', { data: 100 }),
            EN(400, { data: 90 }),
            L('obs_profundo', 2, { data: 100 }),
          ] },
        { name: 'A Anomalia', story: 'O sinal é um projeto: uma singularidade artificial. Alguém já fez isso antes.',
          missions: [
            P('exotic', 40, { data: 100 }),
            DY(6, { data: 120 }),
            B('lab_anomalia', 3, { data: 100 }),
            PAY({ exotic: 30, hull: 20 }, 'Estabilizar a anomalia', 'Uma gaiola de módulos estruturais segura a anomalia no lugar.', { data: 120 }),
            DL('fusion', 100, { data: 100 }),
            L('lab_anomalia', 3, { data: 100 }),
            P('exotic', 100, { data: 120 }),
            CORE({ data: 200 }),
          ] },
      ] },
  };
  D.regionOrder = ['lua', 'marte', 'cinturao', 'mercurio', 'venus', 'jupiter', 'saturno', 'urano', 'netuno'];
  // Escada de geradores: cada um pode ser trocado, uma unidade por vez, pelo próximo disponível na região
  // (Painel Solar → Coletor Solar → Reator de Fusão; sem coletor, o painel vai direto ao reator).
  D.genChain = ['painel', 'coletor_solar', 'reator'];
  // Polo de cada recurso: o planeta cuja função é produzi-lo. Avisos de "sobrando em" e sugestões de rota
  // só apontam para o polo (estoque guardado em outro planeta, como recompensa ou sobra de entrega, não conta).
  D.resHub = { ore: 'lua', metal: 'lua', ice: 'lua', alloy: 'marte', comp: 'marte', rare: 'cinturao', cell: 'mercurio', sat: 'mercurio',
    gas: 'venus', fuel: 'venus', fusion: 'jupiter', hull: 'saturno', cryo: 'urano', exotic: 'netuno' };
  D.earth = { au: 1.0, vis: 128, period: 600, a0: 0.4 };

  // Baú de fase (gpi = índice global da fase concluída)
  D.chest = (gpi) => ({ data: 20 + 15 * gpi, cards: 3 + Math.floor(gpi * 0.6) });

  // ---------------- TRANSPORTE ----------------
  D.route = {
    cost: { alloy: 15, fuel: 20 }, g: 1.6,               // custo do cargueiro (pago na origem)
    up: [['alloy', 25, 1], ['metal', 40, 1], ['comp', 8, 2]], ug: 2.0, maxLvl: 15,
    baseCap: 20, capPerLvl: 1.5,                             // capacidade = 20 × 1,5^(nível-1)
    timeBase: 15, timePerAU: 12,                             // segundos por trecho
    fuelBase: 3, fuelPerAU: 2,                               // combustível por viagem (ida e volta) com 20 de carga
    windowQ: 0.8, windowBonus: 0.35,                         // janela: proximidade ≥ 80% → −35% tempo e combustível
  };

  // ---------------- ENXAME DE DYSON ----------------
  D.dysonRequired = 6;
  // Etapas do enxame (entregues em Mercúrio). As obrigatórias (1–6) pedem só um pouco de metal e ligas do
  // próprio Mercúrio; as opcionais (7–10, fragmentos extras) são o destino de longo prazo dos básicos que
  // sobram no fim do jogo: metal, ligas, combustível de Vênus e componentes de Marte em grande escala.
  // Volumes grandes nas obrigatórias atrasavam muito o 2º universo (auditoria de recursos de 30/10/2026).
  D.dyson = [
    { sat: 5, comp: 20, metal: 1000, alloy: 300 },
    { sat: 10, cell: 40, comp: 30, metal: 1600, alloy: 500 },
    { sat: 20, comp: 60, fusion: 10, metal: 2600, alloy: 800 },
    { sat: 30, hull: 10, comp: 80, metal: 4100, alloy: 1300 },
    { sat: 45, hull: 25, cryo: 10, metal: 6600, alloy: 2100 },
    { sat: 60, hull: 40, cryo: 30, metal: 10500, alloy: 3400 },
    { sat: 90, hull: 60, cryo: 50, exotic: 5, metal: 100000, alloy: 30000, fuel: 25000, comp: 3000 },
    { sat: 130, hull: 90, exotic: 15, metal: 180000, alloy: 55000, fuel: 40000, comp: 6000 },
    { sat: 180, hull: 130, exotic: 30, metal: 330000, alloy: 100000, fuel: 60000, comp: 12000 },
    { sat: 250, hull: 200, exotic: 60, metal: 600000, alloy: 180000, fuel: 90000, comp: 25000 },
  ];
  D.dysonEnergyPerStage = 0.15; // +15% de energia em todas as regiões por etapa
  D.dysonRegion = 'mercurio';
  // Núcleo: só material exótico. Ligas e componentes aqui atrasavam o Colapso em até 35 min, porque a
  // logística até Netuno é estreita; o destino dos básicos fica nas etapas do Dyson.
  D.core = { region: 'netuno', minPhase: 1, cost: { exotic: 60, hull: 30, cryo: 60, fusion: 80 } };

  // ---------------- COLAPSO ----------------
  D.collapse = {
    prodK: 3, prodRef: 1e6, prodExp: 0.45,   // frag. produção = floor(K × (valor/ref)^exp)
    perRegion: 1, perStage: 1, perExtraStage: 2, core: 3,
    fragYield: 0.03,
    depthTarget: 0.5, depthMax: 4,          // metas de produção/entrega ×(1 + 0,5 × colapsos), até ×4                          // cada fragmento total = +3% de rendimento global
  };

  // ---------------- EXPEDIÇÕES ----------------
  D.expeditions = {
    insp_lua:   { name: 'Inspecionar instalações lunares', region: 'lua', spec: 'iris', dur: 120, cost: { fuel: 15 }, g: { cards: { iris: 2 }, data: 10 }, bonus: [[0.4, { cards: { iris: 2 } }], [0.25, { cards: { vulcano: 1 } }]] },
    forjas_lua: { name: 'Vasculhar forjas abandonadas', region: 'lua', spec: 'vulcano', dur: 240, cost: { fuel: 25, alloy: 10 }, g: { cards: { vulcano: 3 }, data: 15 }, bonus: [[0.4, { cards: { vulcano: 2 } }], [0.3, { data: 20 }]] },
    crateras:   { name: 'Mapear crateras de gelo', region: 'lua', spec: 'nix', dur: 300, cost: { fuel: 30 }, g: { cards: { nix: 3 }, data: 15 }, bonus: [[0.4, { cards: { nix: 2 } }], [0.3, { data: 25 }]] },
    sinais:     { name: 'Sinais do lado oculto', region: 'lua', spec: 'oraculo', dur: 480, cost: { fuel: 40, alloy: 20 }, g: { cards: { oraculo: 2 }, data: 40 }, bonus: [[0.4, { cards: { oraculo: 2 } }], [0.3, { data: 40 }]] },
    estaleiros: { name: 'Explorar estaleiros abandonados', region: 'marte', spec: 'vega', dur: 360, cost: { fuel: 40, comp: 5 }, g: { cards: { vega: 3 }, data: 20 }, bonus: [[0.4, { cards: { vega: 2 } }], [0.3, { data: 30 }]] },
    asteroide:  { name: 'Asteroide metálico errante', region: 'cinturao', spec: 'iris', dur: 480, cost: { fuel: 50 }, g: { cards: { iris: 2, vulcano: 2 }, data: 30 }, bonus: [[0.5, { cards: { iris: 2 } }], [0.5, { cards: { vulcano: 2 } }]] },
    arquivos:   { name: 'Recuperar arquivos solares', region: 'mercurio', spec: 'helio', dur: 600, cost: { fuel: 60, cell: 5 }, g: { cards: { helio: 3 }, data: 40 }, bonus: [[0.4, { cards: { helio: 2 } }], [0.3, { data: 50 }]] },
    nuvens:     { name: 'Sondar as nuvens de Vênus', region: 'venus', spec: 'aura', dur: 600, cost: { fuel: 80 }, g: { cards: { aura: 3 }, data: 40 }, bonus: [[0.4, { cards: { aura: 2 } }], [0.3, { data: 50 }]] },
    mancha:     { name: 'Mergulhar na Grande Mancha', region: 'jupiter', spec: 'ion', dur: 900, cost: { fuel: 120, fusion: 5 }, g: { cards: { ion: 3 }, data: 60 }, bonus: [[0.4, { cards: { ion: 2 } }], [0.3, { data: 80 }]] },
    aneis:      { name: 'Catalogar os anéis', region: 'saturno', spec: 'nix', dur: 900, cost: { fuel: 150 }, g: { cards: { nix: 4, vega: 2 }, data: 80 }, bonus: [[0.4, { cards: { vega: 2 } }], [0.3, { data: 80 }]] },
    arquivo_prof:{ name: 'Arquivo profundo', region: 'urano', spec: 'oraculo', dur: 1200, cost: { fuel: 200, cryo: 5 }, g: { cards: { oraculo: 4 }, data: 150 }, bonus: [[0.4, { cards: { oraculo: 2 } }], [0.3, { data: 150 }]] },
    eco_enxame: { name: 'Eco do enxame', region: 'mercurio', spec: 'lumen', dur: 1800, cost: { fuel: 200, sat: 2 }, g: { cards: { lumen: 2 }, data: 100 }, bonus: [[0.3, { cards: { lumen: 1 } }]] },
    vazio:      { name: 'Ressonância do vazio', region: 'netuno', spec: 'eco', dur: 1800, cost: { fuel: 300, exotic: 2 }, g: { cards: { eco: 2 }, data: 150 }, bonus: [[0.3, { cards: { eco: 1 } }]] },
    ruinas:     { name: 'Ruínas Precursoras', region: 'lua', spec: null, recruit: 'reliquia', universe: 'ancestral', dur: 900, cost: { fuel: 60 }, g: { cards: { reliquia: 1 }, data: 120, frags: 1 }, bonus: [[0.5, { data: 120 }]] },
    ruinas2:    { name: 'Câmaras do Guardião', region: 'marte', spec: 'reliquia', dur: 1200, cost: { fuel: 100 }, g: { cards: { reliquia: 2 }, data: 80 }, bonus: [[0.3, { frags: 1 }]] },
  };

  // ---------------- PESQUISA ----------------
  // eff: k = tipo, v = valor por nível. cur 'frag' = paga com Fragmentos de Singularidade.
  D.branches = {
    min: { name: 'Mineração', color: '#b9a48a' }, ind: { name: 'Indústria', color: '#e0a35a' }, en: { name: 'Energia', color: '#ffd76a' },
    log: { name: 'Logística', color: '#5ef2a0' }, exp: { name: 'Exploração', color: '#3fe0ff' }, sg: { name: 'Singularidade', color: '#b07cff' },
  };
  D.research = {
    min1: { br: 'min', name: 'Brocas de Diamante', max: 5, cost: 10, cg: 2.2, eff: { k: 'yieldCat', cat: 'extract', v: 0.25 }, desc: '+25% de rendimento de extração por nível.' },
    min2: { br: 'min', name: 'Sondagem Sísmica', max: 5, cost: 40, cg: 2.2, req: ['min1'], eff: { k: 'speed', cat: 'extract', v: 0.2 }, desc: '+20% de velocidade de extração por nível.' },
    min3: { br: 'min', name: 'Criomineração', max: 5, cost: 60, cg: 2.2, req: ['min1'], eff: { k: 'yieldCat', cat: 'ice', v: 0.25 }, desc: '+25% de rendimento das instalações de gelo por nível.' },
    min4: { br: 'min', name: 'Mineração de Precisão', max: 3, cost: 400, cg: 2.5, req: ['min2'], eff: { k: 'yieldRes', res: 'rare', v: 0.3 }, desc: '+30% de metais raros por nível.' },
    min5: { br: 'min', name: 'Drones Autônomos', max: 3, cost: 1500, cg: 2.5, req: ['min4'], eff: { k: 'speed', cat: 'extract', v: 0.5 }, desc: '+50% de velocidade de extração por nível.' },
    ind1: { br: 'ind', name: 'Fornos de Indução', max: 5, cost: 15, cg: 2.2, eff: { k: 'speed', cat: 'industry', v: 0.2 }, desc: '+20% de velocidade industrial por nível.' },
    ind2: { br: 'ind', name: 'Ligas Avançadas', max: 5, cost: 50, cg: 2.2, req: ['ind1'], eff: { k: 'yieldRes', res: 'alloy', v: 0.25 }, desc: '+25% de ligas por ciclo por nível.' },
    ind3: { br: 'ind', name: 'Linhas de Montagem', max: 5, cost: 120, cg: 2.2, req: ['ind2'], eff: { k: 'yieldRes', res: 'comp', v: 0.25 }, desc: '+25% de componentes por ciclo por nível.' },
    ind4: { br: 'ind', name: 'Engenharia Modular', max: 5, cost: 200, cg: 2.3, req: ['ind1'], eff: { k: 'costRed', v: 0.08 }, desc: '−8% no custo de instalações e melhorias por nível.' },
    ind5: { br: 'ind', name: 'Estaleiros Orbitais', max: 3, cost: 2000, cg: 2.5, req: ['ind3'], eff: { k: 'yieldRes', res: 'hull', v: 0.3 }, desc: '+30% de módulos estruturais por nível.' },
    en1: { br: 'en', name: 'Painéis Bifaciais', max: 5, cost: 12, cg: 2.2, eff: { k: 'gen', v: 0.15 }, desc: '+15% de geração de energia por nível.' },
    en2: { br: 'en', name: 'Supercapacitores', max: 5, cost: 60, cg: 2.2, req: ['en1'], eff: { k: 'use', v: 0.08 }, desc: '−8% de consumo de energia por nível.' },
    en3: { br: 'en', name: 'Concentradores Solares', max: 5, cost: 300, cg: 2.3, req: ['en1'], eff: { k: 'speed', cat: 'solar', v: 0.25 }, desc: '+25% de velocidade das instalações solares por nível.' },
    en4: { br: 'en', name: 'Confinamento Magnético', max: 5, cost: 1200, cg: 2.3, req: ['en2'], eff: { k: 'speed', cat: 'fusion', v: 0.25 }, desc: '+25% de velocidade das instalações de fusão por nível.' },
    en5: { br: 'en', name: 'Reatores Compactos', max: 3, cost: 2500, cg: 2.5, req: ['en4'], eff: { k: 'genReactor', v: 0.3 }, desc: '+30% de energia dos reatores por nível.' },
    log1: { br: 'log', name: 'Contêineres Expansíveis', max: 5, cost: 15, cg: 2.2, eff: { k: 'storage', v: 0.25 }, desc: '+25% de armazenamento por nível.' },
    log2: { br: 'log', name: 'Porões Ampliados', max: 5, cost: 40, cg: 2.2, eff: { k: 'cargo', v: 0.25 }, desc: '+25% de capacidade de carga por nível.' },
    log3: { br: 'log', name: 'Trajetórias de Hohmann', max: 5, cost: 80, cg: 2.2, req: ['log2'], eff: { k: 'travel', v: 0.1 }, desc: '−10% de tempo de viagem por nível.' },
    log4: { br: 'log', name: 'Propulsão Eficiente', max: 5, cost: 150, cg: 2.2, req: ['log3'], eff: { k: 'fuel', v: 0.1 }, desc: '−10% de combustível por viagem por nível.' },
    log5: { br: 'log', name: 'Janelas Calculadas', max: 3, cost: 500, cg: 2.5, req: ['log3'], eff: { k: 'window', v: 0.1 }, desc: '+10% de bônus nas janelas de transporte por nível.' },
    exp1: { br: 'exp', name: 'Sondas Robustas', max: 5, cost: 30, cg: 2.2, eff: { k: 'expReward', v: 0.2 }, desc: '+20% de recompensas de expedição por nível.' },
    exp2: { br: 'exp', name: 'Sonda Adicional', max: 2, cost: 150, cg: 5, req: ['exp1'], eff: { k: 'expSlots', v: 1 }, desc: '+1 sonda para expedições simultâneas.' },
    exp3: { br: 'exp', name: 'Navegação Autônoma', max: 5, cost: 100, cg: 2.2, req: ['exp1'], eff: { k: 'expTime', v: 0.1 }, desc: '−10% de duração das expedições por nível.' },
    exp4: { br: 'exp', name: 'Telemetria Profunda', max: 5, cost: 200, cg: 2.3, req: ['exp1'], eff: { k: 'dataGain', v: 0.1 }, desc: '+10% de dados de pesquisa de todas as fontes por nível.' },
    exp5: { br: 'exp', name: 'Retransmissor Offline', max: 4, cost: 300, cg: 2.3, req: ['exp3'], eff: { k: 'offlineH', v: 2 }, desc: '+2h de limite de progresso offline por nível.' },
    sg1: { br: 'sg', cur: 'frag', name: 'Memória Quântica', max: 3, cost: 1, cg: 2, eff: { k: 'startKit', v: 1 }, desc: 'Cada novo universo começa com mais recursos na Lua (por nível).' },
    sg2: { br: 'sg', cur: 'frag', name: 'Atalhos de Missão', max: 2, cost: 2, cg: 2, eff: { k: 'missionEase', v: 0.2 }, desc: '−20% nas metas de produção das missões da Lua e de Marte por nível.' },
    sg3: { br: 'sg', cur: 'frag', name: 'Eco Industrial', max: 5, cost: 2, cg: 1.8, eff: { k: 'globalSpeed', v: 0.25 }, desc: '+25% de velocidade em todas as instalações por nível.' },
    sg4: { br: 'sg', cur: 'frag', name: 'Âncora Dimensional', max: 2, cost: 3, cg: 2, eff: { k: 'offlineH', v: 4 }, desc: '+4h de limite de progresso offline por nível.' },
    sg5: { br: 'sg', cur: 'frag', name: 'Ressonância de Fragmentos', max: 5, cost: 3, cg: 2, eff: { k: 'fragGain', v: 0.2 }, desc: '+20% de Fragmentos recebidos no Colapso por nível.' },
    sg6: { br: 'sg', cur: 'frag', name: 'Pré-fabricados', max: 3, cost: 2, cg: 2, req: ['sg1'], eff: { k: 'prefab', v: 1 }, desc: 'Novos universos começam com +2 extratores, +1 refinaria e +2 painéis na Lua por nível.' },
    sg7: { br: 'sg', cur: 'frag', name: 'Mapa do Vazio', max: 1, cost: 5, cg: 1, eff: { k: 'offers', v: 1 }, desc: 'Mostra 4 destinos possíveis no Colapso em vez de 3.' },
    anom1: { br: 'log', name: 'Cartografia da Anomalia', opt: true, max: 10, cost: 30000, cg: 1.45, eff: { k: 'storage', v: 0.04 }, desc: 'Projeto opcional de fim de jogo: +4% de armazenamento por nível. Não é necessário para avançar e não acelera a ciência.' },
  };
  // ---------------- DESCOBERTAS ----------------
  // Conhecimento permanente obtido em marcos das missões (sobrevive ao Colapso). Dados continuam pagando a
  // pesquisa; as tecnologias avançadas abaixo também exigem conhecer a descoberta correspondente.
  // from = missão que concede (regiao.fase.indice; IDs estáveis dos saves).
  D.discoveries = {
    componentes:   { name: 'Engenharia de componentes', from: 'marte.0.4', desc: 'Linhas de produção de componentes em escala.' },
    raros:         { name: 'Metalurgia de materiais raros', from: 'cinturao.0.2', desc: 'Separação e refino dos metais raros do Cinturão.' },
    solar_orbital: { name: 'Engenharia solar orbital', from: 'mercurio.1.1', desc: 'Montagem de coletores em órbita próxima ao Sol.' },
    fusao:         { name: 'Domínio da fusão', from: 'jupiter.0.4', desc: 'Separação de hélio-3 e confinamento estável.' },
    estruturas:    { name: 'Engenharia de grandes estruturas', from: 'saturno.0.2', desc: 'Módulos estruturais para cascos e enxames.' },
    criogenia:     { name: 'Ciência criogênica', from: 'urano.0.1', desc: 'Supercondutores a temperaturas extremas.' },
    anomalia:      { name: 'Ciência da anomalia', from: 'netuno.0.5', desc: 'O sinal de Netuno decodificado.' },
  };
  D.discOrder = ['componentes', 'raros', 'solar_orbital', 'fusao', 'estruturas', 'criogenia', 'anomalia'];
  // pesquisa → descoberta exigida a partir de um nível (1 = desde o primeiro). As primeiras pesquisas de cada
  // ramo continuam livres; só os nós avançados (ou os níveis finais) dependem de descobertas.
  D.researchDisc = {
    ind3: { d: 'componentes', from: 1 }, min4: { d: 'raros', from: 1 }, min5: { d: 'raros', from: 1 },
    en3: { d: 'solar_orbital', from: 4 }, en4: { d: 'fusao', from: 1 }, en5: { d: 'fusao', from: 1 },
    ind5: { d: 'estruturas', from: 1 }, en2: { d: 'criogenia', from: 4 }, anom1: { d: 'anomalia', from: 1 },
  };
  for (const id in D.researchDisc) D.research[id].disc = D.researchDisc[id];
  // ---------------- PRÊMIOS FUNCIONAIS POR FASE ----------------
  // Fases sem recrutamento, descoberta ou desbloqueio ganham cartas direcionadas num objetivo-chave, para um
  // especialista já recrutado em fases anteriores e útil no passo seguinte. Orçamento: 30 cartas na campanha
  // (≈17% das 181 cartas base dos baús). Dados continuam como complemento; os IDs das missões não mudam.
  D.phaseCards = {
    'marte.1.1': { vulcano: 4 },  // Forjas Vermelhas: produzir 250 ligas → indústria
    'marte.2.7': { vega: 4 },     // Estaleiros de Marte: 1,2K ligas → rotas para o Cinturão
    'cinturao.1.7': { iris: 4 },  // Rede Logística: 300 metais raros → extração
    'venus.1.2': { aura: 4 },     // Cidades Flutuantes: 1,5K combustível → gases de Júpiter
    'jupiter.1.5': { ion: 4 },    // Forja de Fusão: 500 de fusão → reatores
    'saturno.1.7': { nix: 4 },    // Grandes Estaleiros: 80 módulos → gelo e criogenia de Urano
    'urano.1.6': { oraculo: 3 },  // Laboratórios Criogênicos: 250 supercondutores → laboratórios de Netuno
    'netuno.1.3': { ion: 3 },     // Estabilizar a anomalia → combustível de fusão do Núcleo
  };
  for (const key in D.phaseCards) {
    const [rid, p, i] = key.split('.'); const md = D.regions[rid].phases[+p].missions[+i];
    md.rw = Object.assign({}, md.rw, { cards: D.phaseCards[key], cardsOwned: true });
  }
  // ---------------- MARCOS DE ESCOLHA ----------------
  // Três marcos deixam o jogador escolher um benefício para o universo atual (some no Colapso: sem inflação
  // permanente; uma escolha por marco em cada universo). eff usa os mesmos tipos dos modificadores.
  D.choices = {
    forjas:  { from: 'marte.1.7', title: 'Rumo da colônia de Marte' },
    nuvens:  { from: 'venus.0.7', title: 'Prioridade das cidades de Vênus' },
    aneis:   { from: 'saturno.0.7', title: 'Plano dos anéis de Saturno' },
  };
  D.choiceOptions = [
    { id: 'ind', name: 'Industrial', desc: '+20% de velocidade nas instalações industriais (refino, forjas, fábricas, estaleiros) neste universo.', eff: { k: 'speed', cat: 'industry', v: 0.2 } },
    { id: 'sci', name: 'Científico', desc: '+15% de dados de pesquisa de todas as fontes neste universo.', eff: { k: 'dataGain', v: 0.15 } },
    { id: 'log', name: 'Logístico', desc: '+30% de carga e −15% de tempo de viagem dos cargueiros neste universo.', eff: { k: 'logi', cargo: 0.3, travel: 0.15 } },
  ];
  for (const id in D.choices) {
    const [rid, p, i] = D.choices[id].from.split('.'); const md = D.regions[rid].phases[+p].missions[+i];
    md.rw = Object.assign({}, md.rw, { choice: id });
  }
  for (const id in D.discoveries) { // a recompensa da missão-marco passa a conceder a descoberta
    const [rid, p, i] = D.discoveries[id].from.split('.'); const md = D.regions[rid].phases[+p].missions[+i];
    md.rw = Object.assign({}, md.rw, { disc: id });
  }
  // Custo dos níveis finais: os dois últimos níveis (nós de 5) ou o último (nós de até 3) custam ×mult.
  // Os nós básicos de cada ramo e todos os níveis iniciais mantêm o preço original (tecnologias essenciais).
  D.researchLate = { mult: 3, basic: ['min1', 'ind1', 'en1', 'log1', 'exp1', 'exp2'] };
  D.startKit = { metal: 150, ore: 100, ice: 60, alloy: 20 }; // por nível de Memória Quântica

  // ---------------- UNIVERSOS ----------------
  D.universes = {
    padrao: { name: 'Universo Padrão', short: 'Padrão', hue: 0, sun: '#ffcf5a',
      desc: 'Condições equilibradas. O Sistema Solar como o conhecemos.',
      traits: ['Sem modificadores'], mods: {},
      dirs: [ { t: 'tprod', r: 'metal', n: 30000, rw: { data: 200 } }, { t: 'exped', n: 10, rw: { data: 200 } }, { t: 'dyson', n: 7, rw: { frags: 1 } } ] },
    abundante: { name: 'Universo Abundante', short: 'Abundante', hue: 25, sun: '#ffb347',
      desc: 'Planetas mais densos em metais. A indústria floresce.',
      traits: ['+60% minério e +50% metais raros por ciclo', '+25% de velocidade industrial', '−20% de geração solar'],
      mods: { yieldRes: { ore: 1.6, rare: 1.5 }, speed: { industry: 1.25 }, solar: 0.8 },
      dirs: [ { t: 'tprod', r: 'ore', n: 60000, rw: { data: 200 } }, { t: 'tprod', r: 'rare', n: 2000, rw: { frags: 1 } }, { t: 'dyson', n: 8, rw: { frags: 2 } } ] },
    energetico: { name: 'Universo Energético', short: 'Energético', hue: -15, sun: '#fff07a',
      desc: 'Uma estrela mais quente. Energia sobra; megaconstruções custam menos.',
      traits: ['+80% de geração solar', '−30% no custo do enxame de Dyson', '−20% de combustível de fusão por ciclo'],
      mods: { solar: 1.8, dysonCost: 0.7, yieldRes: { fusion: 0.8 } },
      dirs: [ { t: 'tenergy', n: 1500, rw: { data: 200 } }, { t: 'tprod', r: 'sat', n: 300, rw: { frags: 1 } }, { t: 'dyson', n: 8, rw: { frags: 2 } } ] },
    congelado: { name: 'Universo Congelado', short: 'Congelado', hue: 170, sun: '#bfe8ff',
      desc: 'Um Sol mais pálido e gelo por toda parte. A indústria exige mais energia.',
      traits: ['+100% de gelo por ciclo', '+30% de combustível por ciclo', '+40% de consumo de energia na indústria', '−20% de geração solar'],
      mods: { yieldRes: { ice: 2, fuel: 1.3 }, useCat: { industry: 1.4 }, solar: 0.8 },
      dirs: [ { t: 'tprod', r: 'ice', n: 60000, rw: { data: 200 } }, { t: 'tprod', r: 'cryo', n: 600, rw: { frags: 1 } }, { t: 'tprod', r: 'fuel', n: 20000, rw: { frags: 1 } } ] },
    ancestral: { name: 'Universo Ancestral', short: 'Ancestral', hue: 290, sun: '#ffa8d8',
      desc: 'Ruínas de uma civilização anterior ao Colapso. Expedições revelam projetos especiais.',
      traits: ['+75% de recompensas de expedição', '−30% de duração das expedições', 'Expedição exclusiva: Ruínas Precursoras', '−15% de minério por ciclo'],
      mods: { expReward: 1.75, expTime: 0.7, yieldRes: { ore: 0.85 } },
      dirs: [ { t: 'exped', n: 15, rw: { data: 300 } }, { t: 'hasSpec', s: 'reliquia', n: 1, rw: { frags: 1 } }, { t: 'dyson', n: 7, rw: { frags: 2 } } ] },
  };
  D.universeOrder = ['padrao', 'abundante', 'energetico', 'congelado', 'ancestral'];

  // ---------------- CONQUISTAS ----------------
  D.achievements = [
    { id: 'auto1', name: 'Mãos livres', desc: 'Automatize a primeira instalação.' },
    { id: 'route1', name: 'Primeira rota', desc: 'Estabeleça uma rota de transporte.' },
    { id: 'exp1', name: 'Sonda lançada', desc: 'Conclua uma expedição.' },
    { id: 'chest1', name: 'Suprimentos!', desc: 'Abra um Baú de Suprimentos.' },
    { id: 'promo3', name: 'Veterano', desc: 'Promova um especialista ao nível 3.' },
    { id: 'promo5', name: 'Lenda da tripulação', desc: 'Promova um especialista ao nível 5.' },
    { id: 'mars', name: 'Vermelho no horizonte', desc: 'Chegue a Marte.' },
    { id: 'outer', name: 'Sistema exterior', desc: 'Chegue a Júpiter.' },
    { id: 'edge', name: 'A borda', desc: 'Chegue a Netuno.' },
    { id: 'dyson1', name: 'Primeira vela', desc: 'Conclua a primeira etapa do enxame de Dyson.' },
    { id: 'dysonR', name: 'Enxame de Dyson', desc: 'Conclua o enxame de Dyson (6 etapas).' },
    { id: 'dyson10', name: 'Sol cercado', desc: 'Conclua as 10 etapas do enxame.' },
    { id: 'collapse1', name: 'Além do horizonte', desc: 'Realize o primeiro Colapso.' },
    { id: 'collapse3', name: 'Viajante do vazio', desc: 'Realize 3 Colapsos.' },
    { id: 'alluni', name: 'Multiverso', desc: 'Visite os 5 tipos de universo.' },
  ];

  H.DATA = D;
})(typeof window !== 'undefined' ? (window.H = window.H || {}) : (globalThis.H = globalThis.H || {}));
