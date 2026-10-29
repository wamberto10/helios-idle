# Correções de balanceamento e recompensas — HELIOS IDLE

Data: 29/10/2026. Base: commit `9e80c56` (a versão publicada). Implementação do [PROMPT-CORRECOES-BALANCEAMENTO.md](PROMPT-CORRECOES-BALANCEAMENTO.md). Todos os números abaixo foram medidos no código atual com o motor real; nenhum save pessoal foi lido ou alterado. Nada foi publicado no GitHub.

## Resumo

- **A ciência deixou de disparar.**
  - No farm do Padrão, a árvore de pesquisa completa só depois do 5º universo; antes, terminava às 2h11 do primeiro, sem nenhum Colapso.
  - O saldo 4 horas depois do 2º Colapso caiu de 2,6–3,2 milhões para 30–42 mil dados.
- **Pesquisa avançada exige descobertas.**
  - Sete marcos das missões concedem conhecimento permanente.
  - Juntar dados sozinho não compra essas tecnologias; o motor recusa a compra e a tela diz qual missão falta.
- **As missões dão avanço que os observatórios não fabricam.**
  - Quinze recompensas ganharam descoberta ou cartas direcionadas.
  - A mediana do valor de uma missão no 2º universo subiu de 1–1,5 s para cerca de 6 s de produção científica (farm) e de ~50 s para ~200 s (estratégia normal).
- **A tela mostra o que o motor paga.**
  - Dados com bônus, recrutamento × carta repetida e expedições com os mesmos arredondamentos.
  - Diretrizes não resgatadas não se perdem mais no Colapso.
  - Material de recompensa não some com estoque cheio.
- **Reserva para melhoria:** consumidores da região deixam de comer o material de uma melhoria em andamento.
- **Campanhas:**
  - As 20 campanhas da matriz chegam ao Colapso; a contabilidade de dados fecha com erro 0.
  - Na mediana de 5 inícios diferentes, o 1º Colapso fica igual ou mais rápido que antes.
  - O 2º Colapso ficou de 5 a 34 min mais longo, conforme o universo (motivo na seção de limitações).

## O que mudou

### 1. Escala científica própria (`D.science` em `js/data.js`)

Valem para tudo que produz dados (Observatório e Observatório Profundo). O Laboratório de Anomalia produz matéria exótica e continua na curva industrial.

| Parâmetro | Antes | Agora |
|---|---|---|
| Velocidade do Oráculo por nível (1 → 10) | ×2, 4, 8, 12, 16, 24, 32, 48, 64, 96 | ×2, 4, 5, 6, 7, 8, 9, 10, 11, 12 |
| Rendimento por nível do observatório | +50% por nível | +30% por nível |
| Velocidade global (Eco, Eco Industrial) | multiplicação integral | raiz quadrada |
| Fragmentos | +3% por fragmento, sem teto | +0,5% por fragmento, até +50% |
| Observatório Profundo | 12 dados por ciclo | 6 dados por ciclo |
| `dataGain` (Oráculo +10%/nível, Telemetria) | uma vez | uma vez (sem mudança) |

Os primeiros níveis do Oráculo são iguais aos de antes: os cinco ciclos manuais de recrutamento e o começo da ciência não mudaram. O ciclo de 30 s do observatório foi mantido.

Ciclo manual, produção automática, energia (o consumo acompanha a velocidade científica), prévia de produção na tela e simulação offline usam as mesmas funções (`E.speedOf`, `E.yieldOf`).

### 2. Descobertas e pesquisa avançada

| Missão-marco | Descoberta | Pesquisa que passa a exigir |
|---|---|---|
| `marte.0.4` Produzir 15 componentes | Engenharia de componentes | Linhas de Montagem (`ind3`) |
| `cinturao.0.2` Produzir 20 metais raros | Metalurgia de materiais raros | Mineração de Precisão (`min4`), Drones Autônomos (`min5`) |
| `mercurio.1.1` Produzir 5 satélites | Engenharia solar orbital | Concentradores Solares (`en3`), níveis 4–5 |
| `jupiter.0.4` Produzir 30 de fusão | Domínio da fusão | Confinamento Magnético (`en4`), Reatores Compactos (`en5`) |
| `saturno.0.2` Produzir 5 módulos | Engenharia de grandes estruturas | Estaleiros Orbitais (`ind5`) |
| `urano.0.1` Produzir 10 supercondutores | Ciência criogênica | Supercapacitores (`en2`), níveis 4–5 |
| `netuno.0.5` Decodificar o sinal | Ciência da anomalia | Cartografia da Anomalia (`anom1`, projeto opcional) |

**Como funciona:**
- **Onde fica:** a descoberta é guardada em `perm.disc`. Sobrevive ao Colapso e não se repete: nos universos seguintes a missão mostra "Descoberta já conhecida".
- **Validação:** o bloqueio é checado no motor (`E.resState` / `E.buyResearch`), com motivo claro na tela.
- **Pesquisas livres:** as primeiras de cada ramo e todas as necessárias para cumprir os próprios marcos.
- **Níveis finais:** os dos nós não básicos custam ×3 (`D.researchLate`). Os nós básicos e os níveis iniciais mantêm o preço.
- **Custo da árvore exigida:** foi de 199.973 para 493.802 dados. Os níveis iniciais continuam somando 53.046.
- **Cartografia da Anomalia:** projeto opcional (10 níveis, 30 mil × 1,45 por nível, +4% de armazenamento por nível). Dá destino ao excedente de fim de jogo sem acelerar a ciência nem dar fragmentos, e fica fora da árvore contada nas medições.

### 3. Recompensas por fase

Oito fases depois do tutorial não tinham prêmio funcional (recrutamento, descoberta ou desbloqueio). Cada uma ganhou cartas num objetivo-chave, para um especialista recrutado em fase anterior e útil no passo seguinte. São 30 cartas na campanha, cerca de 17% das 181 cartas base dos baús. As cartas de missão não recrutam ninguém: se o especialista ainda não estiver na tripulação, elas não são entregues.

| ID | Objetivo | Antes | Agora | Motivo / efeito esperado |
|---|---|---|---|---|
| `marte.0.4` | Produzir 15 componentes | 20 dados | 20 dados + descoberta Engenharia de componentes | Libera Linhas de Montagem |
| `marte.1.1` | Produzir 250 ligas | 25 dados | 25 dados + 4 cartas de Vulcano | Indústria de Marte |
| `marte.2.7` | Produzir 1,2 mil ligas | 40 dados | 40 dados + 4 cartas de Vega | Rotas para o Cinturão |
| `cinturao.0.2` | Produzir 20 metais raros | 30 dados | 30 dados + descoberta Metalurgia de raros | Libera Mineração de Precisão |
| `cinturao.1.7` | Produzir 300 metais raros | 45 dados | 45 dados + 4 cartas de Íris | Extração para Mercúrio |
| `mercurio.1.1` | Produzir 5 satélites | 45 dados | 45 dados + descoberta Engenharia solar orbital | Níveis finais de Concentradores |
| `venus.1.2` | Produzir 1,5 mil de combustível | 55 dados | 55 dados + 4 cartas de Aura | Gases de Júpiter |
| `jupiter.0.4` | Produzir 30 de fusão | 60 dados | 60 dados + descoberta Domínio da fusão | Libera Confinamento e Reatores Compactos |
| `jupiter.1.5` | Produzir 500 de fusão | 65 dados | 65 dados + 4 cartas de Íon | Reatores de Saturno |
| `saturno.0.2` | Produzir 5 módulos | 70 dados | 70 dados + descoberta Grandes estruturas | Libera Estaleiros Orbitais |
| `saturno.1.7` | Produzir 80 módulos | 85 dados | 85 dados + 4 cartas de Nix | Gelo e criogenia de Urano |
| `urano.0.1` | Produzir 10 supercondutores | 80 dados | 80 dados + descoberta Ciência criogênica | Níveis finais de Supercapacitores |
| `urano.1.6` | Produzir 250 supercondutores | 85 dados | 85 dados + 3 cartas de Oráculo | Laboratórios de Netuno (único prêmio de Oráculo) |
| `netuno.0.5` | Decodificar o sinal | 100 dados | 100 dados + descoberta Ciência da anomalia | Projeto opcional de fim de jogo |
| `netuno.1.3` | Estabilizar a anomalia | 120 dados | 120 dados + 3 cartas de Íon | Combustível de fusão do Núcleo |

O que ficou como estava:
- Recrutamentos, recursos de apoio do começo da Lua e IDs das missões.
- Limite de três missões ativas.
- Progresso cumulativo das metas.
- Limite de um fragmento por expedição por universo.

### 4. Prévia e crédito

- **`E.rewardPreview` e `E.expPreview`:**
  - Funções sem efeitos colaterais: não gastam, não sorteiam e não marcam nada.
  - Usam o mesmo arredondamento do resgate e são consultadas pela tela a cada quadro, então não ficam desatualizadas.
  - Exemplo: uma missão de 100 dados com Oráculo 3 anuncia 130 e paga 130.
- **Recrutamento:** mostra "Recruta X" ou "+1 carta de X". O resgate devolve a carta em `got.cards`.
- **Expedições:** mostram o garantido e cada bônus com sua chance, já com `expReward` e `dataGain`, sem revelar o sorteio, além do limite de fragmento restante.
- **Colapso:**
  - Missões, diretrizes e expedições concluídas são fixadas numa lista antes de liquidar, nesta ordem: missões → diretrizes → expedições. Cada item é pago uma única vez.
  - A prévia separa o que é permanente (dados, cartas, fragmentos, descobertas) do que é local e reinicia (cargas, suprimentos pendentes).
  - O caso medido na verificação, em que três diretrizes não resgatadas perdiam 400 dados base e 1 fragmento, agora rende o mesmo que resgatar antes.
- **Estoque cheio:**
  - O que não cabe fica em `regiao.pend` ("Suprimentos de recompensa aguardando espaço") e entra sozinho quando há espaço, inclusive em parte.
  - É salvo junto com a partida, não duplica com clique repetido nem ao recarregar, não conta como produção e reinicia no Colapso, informado no resumo.
- **Baús:**
  - Cartas só para especialistas que ainda precisam delas para chegar ao nível 10, com os mesmos pesos regionais e de raridade.
  - Se ninguém precisa, cada carta vira um pacote limitado de suprimentos (40 metais, 12 ligas e 3 componentes) para a região do baú.
  - Baús já gerados não mudam; o sorteio continua acontecendo na geração.

### 5. Reserva para melhoria

- **Como reservar:** no cartão da instalação, o botão "Reservar material para melhorar" (uma reserva por região) transforma o custo da próxima melhoria em piso do estoque.
- **Quem respeita o piso:** consumidores automáticos e manuais da região, rotas que saem dela e entregas a projetos.
- **Quando completa:** a melhoria acontece uma vez, pagando, e a reserva termina. Pode ser cancelada a qualquer momento.
- **No bot:** foi testada em Urano (raros e supercondutores), e o bot passou a usá-la nas missões de nível.

### 6. Salvamento

O formato passou da versão 2 para a 3 (`D.SAVE_VERSION = 3`). A migração v2 → v3 cria `perm.disc` só com o que o save comprova:

- qualquer Colapso anterior (campanha completa), o que dá todas as descobertas;
- a missão-marco resgatada ou a fase dela concluída;
- uma pesquisa avançada já comprada.

Saldo alto sozinho não libera nada. Nenhuma pesquisa, carta, especialista, fragmento ou perfil é removido. Carregar várias vezes dá o mesmo resultado.

Campos novos com padrão seguro e validação:
- `perm.disc`
- `regiao.pend`
- `regiao.hold`
- `bau.sup`
- o nó `anom1`

IDs desconhecidos são descartados e tipos inválidos recusados, sem exceção.

## Arquivos alterados

- `js/data.js`: escala científica, descobertas, cartas por fase, custo dos níveis finais, Observatório Profundo, projeto opcional, versão do save.
- `js/engine.js`: velocidade e rendimento científicos, descobertas e bloqueio, prévias, `grant`, suprimentos pendentes, diretrizes no Colapso, baús, reserva, migração v2 → v3, validação.
- `js/ui.js`: chips de recompensa ao vivo, painel de descobertas e motivo dos bloqueios, expedições, prévia do Colapso, suprimentos pendentes, controle de reserva, textos de ajuda.
- `js/main.js`: resumo do Colapso (diretrizes, descobertas, suprimentos).
- `css/style.css`: estilos de aviso e da reserva.
- `tools/regress.js`: 70 verificações novas (191 no total).
- `tools/bot.js`: usa a reserva, desfaz reservas antigas, prioriza na rota o material que falta, destrava destino cheio em entregas e abastece rotas sem combustível. São ações disponíveis ao jogador; o bot não recebe nada de graça.
- `tools/simular-campanhas.js`: o projeto opcional fica fora da contagem da árvore.
- `tools/verificar-offline.js` (novo): ausência real de 8 horas.
- `README.md`: atualizado. Notas de histórico em `VERIFICACAO-BALANCEAMENTO.md`, `AUDITORIA-BALANCEAMENTO.md`, `BALANCO.md` e no prompt.

## Testes executados

| Teste | Resultado |
|---|---|
| `node tools/regress.js` | 191/191 |
| `node tools/profile-test.js` | 76 OK |
| `node tools/folder-save-test.js` | 26 OK |
| `node tools/verificar-recompensas-missoes.js` | OK (artefato atualizado) |
| `node tools/bot.js <universo> 20` (5 universos, 2 Colapsos cada) | 5/5 (todos os testes passaram; 1º Colapso entre 1h16 e 2h52 e 2º entre 53 min e 1h14 nesta execução única) |
| `node tools/verificar-balanceamento.js` (20 campanhas + extensões de 4h) | 20/20 chegam ao Colapso; contabilidade com erro 0 |
| `node tools/verificar-offline.js padrao` (8 pontos × 8h de ausência) | sem compras nem resgates automáticos em todos |
| `tools/teste-interface.html` no navegador | 106/106 |
| Checagem visual (1280 px e 375 px, partida de teste apagada) | recompensas, descobertas, bloqueios, reserva e suprimentos pendentes; sem rolagem horizontal |

As regressões novas cobrem:
- produção científica teórica = real e ciclo manual = automático;
- `dataGain` uma vez e fragmentos com teto;
- bloqueio por descoberta no motor, marco único e herança no Colapso;
- migração (com Colapso, por fase, por pesquisa comprada, idempotente e com saldo alto);
- prévia = crédito com e sem Oráculo/Telemetria, recrutamento novo e repetido, expedição;
- estoque cheio com entrega parcial, sem duplicação;
- diretrizes completas, incompletas e já resgatadas;
- baú com especialistas no máximo;
- reserva em Urano.

## Campanhas: antes × depois

Cada célula: antes → depois. Pesquisa = % dos níveis da árvore exigida comprados quando o Colapso fica disponível. +4h = quatro horas a mais no mesmo universo, com o bot ativo (não é ausência). Os destinos do 2º universo são sorteados e podem diferir entre versões.

| Universo inicial | Estratégia | 1º Colapso (min) | Pesquisa no 1º | 2º universo (min) | Pesquisa no 2º | +4h no 1º: pesquisa / saldo | +4h no 2º: pesquisa / saldo | Missão em s de ciência (1º; 2º) |
|---|---|---|---|---|---|---|---|---|
| Padrão | Normal | 82 → 169 | 62% → 63% | Congelado 45 → Ancestral 55 | 77% → 73% | 99% / 8,4 mil → 79% / 7,7 mil | 100% / 377,8 mil → 91% / 12,2 mil | 506,8; 54,8 → 562,5; 195,5 |
| Padrão | Farm | 61 → 67 | 84% → 71% | Congelado 31 → Abundante 35 | 100% → 84% | 100% / 177,6 mil → 95% / 19,2 mil | 100% / 3.032,9 mil → 98% / 39,5 mil | 10,1; 1,4 → 13,6; 6,4 |
| Abundante | Normal | 127 → 172 | 77% → 64% | Energético 38 → Ancestral 54 | 86% → 72% | 99% / 17,9 mil → 78% / 6,9 mil | 100% / 52,3 mil → 91% / 13,5 mil | 507,5; 53,2 → 531,8; 192,3 |
| Abundante | Farm | 64 → 66 | 85% → 71% | Ancestral 29 → Padrão 35 | 100% → 84% | 100% / 233,7 mil → 95% / 20,6 mil | 100% / 3.217,4 mil → 99% / 31,8 mil | 10,4; 1,5 → 14,0; 6,3 |
| Energético | Normal | 124 → 76 | 74% → 56% | Abundante 35 → Ancestral 54 | 82% → 68% | 99% / 29,5 mil → 78% / 6,6 mil | 100% / 698,1 mil → 89% / 7,0 mil | 546,1; 55,4 → 559,7; 200,0 |
| Energético | Farm | 64 → 66 | 86% → 69% | Abundante 30 → Congelado 36 | 100% → 83% | 100% / 205,2 mil → 95% / 16,1 mil | 100% / 2.701,9 mil → 98% / 39,5 mil | 10,4; 1,3 → 25,4; 6,3 |
| Congelado | Normal | 165 → 95 | 77% → 57% | Energético 52 → Energético 72 | 90% → 68% | 95% / 13,0 mil → 78% / 0,6 mil | 100% / 94,1 mil → 89% / 4,8 mil | 471,1; 48,3 → 551,9; 177,7 |
| Congelado | Farm | 61 → 66 | 81% → 69% | Ancestral 30 → Energético 36 | 100% → 84% | 100% / 238,3 mil → 95% / 15,3 mil | 100% / 2.583,8 mil → 98% / 41,6 mil | 11,2; 1,4 → 14,9; 6,0 |
| Ancestral | Normal | 171 → 104 | 82% → 60% | Congelado 33 → Abundante 74 | 90% → 70% | 99% / 5,3 mil → 83% / 8,9 mil | 100% / 40,6 mil → 88% / 13,7 mil | 450,0; 49,2 → 488,6; 199,5 |
| Ancestral | Farm | 60 → 64 | 86% → 72% | Abundante 31 → Abundante 32 | 100% → 84% | 100% / 145,7 mil → 96% / 8,5 mil | 100% / 2.553,2 mil → 99% / 32,9 mil | 8,5; 1,1 → 15,2; 6,0 |

20 de 20 campanhas chegaram ao Colapso nas duas versões. Erro de contabilidade dos dados (inicial + entradas − gastos − saldo): 0 em todas.

### Mediana de 5 inícios ligeiramente diferentes

Uma única execução do bot pode variar mais de uma hora quando muda qualquer detalhe, como a ordem de uma compra (a logística das rotas é sensível). Para comparar, cada universo foi jogado com 0, 3, 7, 11 e 17 segundos parados no início, na versão anterior e na atual.

| Universo | 1º Colapso: execuções antes (min) | mediana antes | execuções depois | mediana depois | 2º Colapso: mediana antes → depois | Travadas (antes → depois) |
|---|---|---|---|---|---|---|
| Padrão | 82, 118, 126, 126, 126 | 126 | 169, 161, 111, 103, 76 | 111 | 40 → 55 | 1 → 0 |
| Abundante | 127, 126, 126, 125, 126 | 126 | 172, 109, 104, 82, 82 | 104 | 37 → 71 | 0 → 0 |
| Energético | 124, 127, 77, 118, 77 | 118 | 76, 81, 103, 111, 127 | 103 | 39 → 57 | 1 → 0 |
| Congelado | 165, 114, 140, 598, 127 | 140 | 95, 116, 116, 88, 103 | 103 | 52 → 57 | 1 → 0 |
| Ancestral | 171, 101, 102, 118, 100 | 102 | 104, 103, 103, 103, 105 | 103 | 46 → 74 | 0 → 0 |

Uma campanha “travada” é a que não chegou ao Colapso em 12 horas de jogo.

### Ritmo em vários universos (Padrão, campanhas seguidas)

Percentual dos níveis da árvore exigida comprados quando o Colapso fica disponível.

| Estratégia | 1º | 2º | 3º | 4º | 5º | +4h depois do 5º |
|---|---|---|---|---|---|---|
| Normal | 63% | 73% | 78% | 84% | 87% | 93% |
| Farm (20 observatórios Nv.5) | 71% | 84% | 91% | 96% | 97% | 100% (aos 3h22) |

Antes, o farm completava a árvore às 2h11 do primeiro universo, e a estratégia normal chegava a 100% no 2º universo.

**Meta de ritmo escolhida:**
- Jogo ativo normal: cerca de 60–65% da árvore no 1º Colapso e progresso perceptível em cada universo até o 5º ou mais.
- Farm deliberado: árvore completa a partir do 4º–5º universo.
- Tudo isso sem trancar recrutamentos, primeiras pesquisas ou a campanha.

## Ausência de 8 horas (offline real)

`E.applyOffline` com 8 horas de ausência numa cópia do save, em pontos da campanha do Padrão. Em todos os casos, nenhuma pesquisa foi comprada e nenhuma missão foi resgatada durante a ausência.

| Estratégia | Momento | Dados ganhos | Árvore exigida antes | Compraria ao voltar |
|---|---|---|---|---|
| Normal | 30 min | 2.323 | 35% | 9 de 72 níveis (3 aguardam descoberta) |
| Normal | 60 min | 5.069 | 40% | 14 de 67 |
| Normal | Colapso disponível | 133.872 | 64% | 30 de 40 |
| Normal | 20 min do 2º universo | 16.247 | 68% | 7 de 36 |
| Farm | 30 min | 223.027 | 45% | 47 de 61 (4 aguardam descoberta) |
| Farm | 60 min | 474.758 | 69% | 34 de 34 |
| Farm | Colapso disponível | 475.558 | 71% | 32 de 32 |
| Farm | 20 min do 2º universo | 696.689 | 78% | 24 de 24 |

- **Normal:** 8 horas fora no fim do 1º universo compram três quartos do que falta. Os níveis mais caros continuam para os universos seguintes.
- **Farm:** com 20 observatórios no nível 5, o farm produz cerca de 16 dados/s. Nesse caso, 8 horas fora depois de ter todas as descobertas compram o resto da árvore. É o retorno de um investimento grande e deliberado; ainda assim, nada avançado é comprado antes das descobertas. Ver limitações.

## Parâmetros finais

- `D.science = { oracleSpeed: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12], globalSpeedExp: 0.5, fragBonus: 0.005, fragBonusMax: 0.5, levelYield: 1 + 0,3 × (nível − 1) }`
- Observatório Profundo: 6 dados por ciclo (consumo de 1 supercondutor mantido).
- `D.researchLate = { mult: 3, basic: [min1, ind1, en1, log1, exp1, exp2] }`
- `D.discoveries` / `D.researchDisc`: tabela acima.
- `D.phaseCards`: 30 cartas em 8 missões.
- Baú sem cartas úteis: 40 metais, 12 ligas e 3 componentes por carta.
- Projeto opcional `anom1`: 10 níveis, 30.000 × 1,45ⁿ dados, +4% de armazenamento por nível.

## Limitações restantes

- **2º universo mais longo:** a mediana do Colapso passou de 37–52 min para 55–74 min. O tempo extra está em Netuno: o Laboratório de Anomalia usa a velocidade do Oráculo, e o Oráculo sobe de nível mais devagar porque as promoções custam dados, agora mais escassos. É efeito esperado de desacelerar a ciência, não uma trava.
- **Farm com ausência longa:** um farm grande (20 observatórios) combinado com 8 horas offline no fim do 1º universo ainda completa a árvore exigida. Reduzir mais exigiria encarecer as promoções ou limitar observatórios, o que afetaria também o jogador normal. Fica como ponto de calibragem futura.
- **Gastos finitos:** pesquisa e promoções têm fim. Depois dos tetos, os dados acumulam. O projeto opcional absorve uma parte (cerca de 2,7 milhões no total), mas não é um sumidouro infinito, por escolha (efeito limitado).
- **Variância do bot:** as durações de execuções isoladas variam muito. Por isso a comparação usa mediana de 5 inícios. O bot recebeu melhorias de logística que um jogador também faria; nenhuma lhe dá recursos.
- **Reatores sem custo operacional:** como pedia o prompt, os reatores continuam sem consumo de combustível de fusão; isso precisa de análise própria.

## Reproduzir

```powershell
node tools/regress.js
node tools/profile-test.js
node tools/folder-save-test.js
node tools/verificar-recompensas-missoes.js
node tools/verificar-balanceamento.js
node tools/verificar-offline.js padrao
```

Artefatos:
- Estado anterior: `artifacts/antes-correcoes/`.
- Atuais:
  - `artifacts/verificacao-campanhas.json`
  - `artifacts/verificacao-missoes-campanhas.json`
  - `artifacts/verificacao-missoes-atual.json`
  - `artifacts/verificacao-offline.json`
