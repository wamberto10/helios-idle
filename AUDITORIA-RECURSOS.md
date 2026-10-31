# Auditoria de ganho dos recursos — HELIOS IDLE

Data: 30/10/2026. Base: código atual, já com gases só em Vênus e a troca de geradores até o Reator de Fusão. Nenhum valor do jogo foi alterado nesta auditoria. Ela substitui as medições de [BALANCO.md](BALANCO.md) (27/10).

## Aplicado em 30/10/2026: ligas e componentes nos planetas externos

**Diagnóstico:** as missões que mais seguravam o fim da partida (laboratórios de Netuno, 8–12 min cada; processador criogênico de Urano) esperavam ligas e componentes. Esses recursos sobram nos planetas internos (89% das ligas descartadas), mas chegam devagar aos externos.

**O que mudou:**
- **Jogo:** Saturno e Urano começam com 320 ligas e 120 componentes (antes 160 e 60); Netuno com 440 e 180 (antes 220 e 90).
- **Bot:** sem dinheiro para abrir outra rota, troca no cargueiro existente um recurso que o destino já tem de sobra (armazém 90% cheio) pelo que falta. Antes, uma campanha de farm travou 526 min com Netuno sem componentes e as ligas lotadas.

**Testado e descartado:**
- Ligas e componentes compactos (×2 no cargueiro e no armazém): instável, 5 de 15 partidas acima de 140 min.
- Sem combustível na origem, o destino paga a viagem: tira o atraso do Energético em Mercúrio (Marte sem combustível), mas a média não melhora (83 min).
- Bot usando 3 recursos por cargueiro: o porão dividido atrasa as entregas (média 84, um 2º Colapso de 129 min).

**Resultado** (15 partidas: 5 universos × 3 inícios):

| Versão | 1º Colapso: média | Pior caso |
|---|---|---|
| Antes | 81 min | 94 min |
| Só a correção do bot | 80 min | 88 min |
| Bot e estoque inicial maior | 76 min | 82 min |

Verificação de campanhas: 1º Colapso de 55 a 78 min, 2º de 32 a 42 min, nenhuma travada.

**Ainda sem solução:** 89% das ligas e 90% dos satélites Dyson são descartados; Júpiter e Saturno terminam gerando 8 a 18 vezes a energia que usam; a missão "Construir 5 reatores" de Saturno dá energia sem uso; a melhoria do laboratório para o Nv 3 (240 ligas) passa do armazém básico de Netuno (225).

## Aplicado em 30/10/2026: Reator de Fusão queima combustível de fusão

**O que mudou:**
- Cada reator queima 1 de combustível de fusão a cada 20 s (3 por minuto), em qualquer nível. Sem combustível, gera na proporção do que conseguiu queimar.
- O cartão mostra o consumo e avisa quando falta ("sem combustível de fusão: gerando X%"). O aviso de gargalo aponta a rota a partir de Júpiter, e a janela de troca de gerador avisa que o reator queima combustível. A enciclopédia lista o reator entre os que usam fusão.
- **Saves antigos (v4 → v5):** cada planeta com reator recebe 10 min de combustível para os reatores que tem, sem tirar nada do estoque. O diário explica a mudança.
- **Bot:** com menos de 2 min de combustível num planeta com reator, garante a rota de fusão.

**Testado e descartado:** remover o "Exportar excedente". As 15 partidas travaram, a primeira já aos 30 min no Cinturão ("Produzir 2,50K minérios"): o armazém enche e a produção para. O jogo tem 42 missões "Produzir X" que dependem de o excedente ter destino.

**Resultado** (média dos 5 universos):

| Medida | Antes | Depois |
|---|---|---|
| Combustível de fusão produzido | 2.500–3.100 | 3.700–5.400 |
| Fusão consumida (insumo e reatores) | 300–720 | 1.400–2.900 |
| Fusão exportada sem uso | 0–10% | 0% |
| Laboratório de Anomalia esperando fusão | 12–18% | 0% |
| 1º Colapso (15 partidas) | média 81, pior 88 min | média 81, pior 94 min |
| 2º Colapso (verificação de campanhas) | 35–44 min | 32–47 min |

A energia no fim continua sobrando em todos os planetas: de 1,4× (Cinturão) a 18× (Júpiter). O caso mais lento (94 min) é no Energético, que já era o universo mais lento.

## Aplicado em 30/10/2026: fusão para o Laboratório de Anomalia

**Diagnóstico:** a falta de combustível de fusão em Netuno vinha quase toda do bot que faz as medições, não do jogo. A Refinaria de Fusão de Júpiter fica parada 38–55% do tempo com o estoque cheio: produção sobra.
- **Fusão jogada fora em Saturno.** Para cumprir as missões de viagens, o bot ligava "Exportar excedente" em Saturno e nunca desligava. A rota Júpiter → Saturno, usada para o lançamento de Urano, continuava levando fusão que era exportada: cerca de 70% de toda a fusão do jogo no Padrão e no Ancestral.
- **Rota para o laboratório só quando uma missão pedia.** O bot não reagia ao aviso "esperando combustível de fusão" no cartão do laboratório.

**O que mudou:**
- **Bot:** acabadas as missões de rota e de viagens de uma região, desmonta a rota que só leva um recurso caro (fusão, raros, supercondutores) que ela não usa e desliga a exportação. Também cria a rota quando uma instalação espera um desses recursos e nenhuma rota o traz.
- **Jogo:** Netuno começa com 100 de combustível de fusão (antes 30). Isso cobre os minutos entre construir o laboratório e a chegada do primeiro cargueiro de Júpiter.

**Testado e descartado:** a ampliação do cargueiro ser paga pelo destino quando a origem não tem os recursos. O tempo de laboratório parado não mudou (~29% com ou sem), e em uma partida Netuno gastou os componentes nas rotas que chegam e travou numa missão até 268 min.

**Resultado:**

| Medida | Antes | Depois |
|---|---|---|
| Laboratório de Anomalia parado por falta (fusão + supercondutores) | 41–48% (27–73% por universo) | 20% em média (12–34%) |
| Laboratório esperando só fusão | 23–73% | 12–18% |
| Fusão exportada sem uso | até 74% | 0–10% |
| 1º Colapso (15 partidas) | média 81, pior 88 min | média 81, pior 88 min |
| 2º Colapso (verificação de campanhas) | 31–44 min | 35–44 min |

Meta do laboratório (menos de 25% parado) alcançada na média. No Padrão ele ainda espera supercondutores 22% do tempo.

## Aplicado em 30/10/2026: logística das cadeias finais, combustível e armazém

**O que mudou:**
- **Recursos compactos:** metais raros ×2, supercondutores ×3 e combustível de fusão ×2 (`D.route.capMult`). Cargueiros e armazéns guardam essa quantidade de unidades no mesmo espaço. Só a carga extra nos cargueiros não bastava: o cargueiro embarca o que cabe no armazém do destino, e o armazém base de Netuno guarda poucos supercondutores.
- **Armazém a partir do Nv 5:** cada nível dá +10% de carga aos cargueiros que saem da região. O cartão e o botão de melhoria mostram isso.
- **Combustível das viagens:** cresce com `(carga ÷ 20)^0,6` (antes 0,5). O cargueiro de nível 1 gasta o mesmo; os grandes gastam mais. O plano propunha 0,75, mas com ele uma em cada 15 partidas travava em 136–146 min.
- **Missão nova em Saturno:** "Receber 500 ligas por rotas" substitui "Produzir 2 mil de combustível", que já sobrava. As outras missões de entrega do plano já existiam: supercondutores em Netuno, metais raros em Urano e em Mercúrio, gases em Júpiter.

**O que não foi aplicado:**
- **Refinaria Química de Júpiter:** continua no jogo. Ela produz pouco, mas é a única fonte de combustível de Júpiter, que paga as rotas de fusão para Saturno, Urano, Netuno e Mercúrio. Sem ela, essas rotas paravam e o Energético foi de 1h24 para 1h43.
- **Mais ligas iniciais em Saturno:** o armazenamento base de ligas lá é 100, e o valor inicial (160) já passa disso.

**Resultado** (média dos 5 universos):

| Medida | Antes | Depois |
|---|---|---|
| Criogênico (Urano) parado esperando metais raros | 38–43% | 7% |
| Observatório Profundo (Netuno) parado esperando supercondutores | 50–59% | 9% |
| Laboratório de Anomalia (Netuno) parado por falta | 58–66% | 41–48% (agora falta combustível de fusão, não supercondutores) |
| Fundição Fotovoltaica (Mercúrio) parada esperando metais raros | 24% | 5% |
| Metais raros exportados | 93% | 18% |
| Supercondutores exportados | 87–89% | 0% |
| Combustível de fusão exportado | 73–78% | 15% |
| Combustível exportado | 80% | ~71% |

**Ritmo:** 5 universos × 3 inícios (0, 7 e 13 s parados), com média de 81 min e pior caso de 88, iguais à versão anterior. O 2º universo segue em 36–43 min.

**Meta não alcançada** (resolvida depois; ver "fusão para o Laboratório de Anomalia" acima): o Laboratório de Anomalia continua abaixo do esperado (meta: menos de 25% parado). O limite agora é a rota Júpiter → Netuno, a mais longa do jogo, cuja ampliação é paga em Júpiter, que não produz metal nem ligas. Deixar a fusão ×4 só levou a 41%.

## Aplicado em 30/10/2026: destino aos básicos (recomendação 1)

**O que mudou:** as etapas do Enxame de Dyson, entregues em Mercúrio, passaram a pedir recursos básicos.

| Etapas | Pedem a mais | Origem |
|---|---|---|
| 1–6 (obrigatórias para o Colapso) | 1.000 a 10.500 de metal e 300 a 3.400 de ligas | Mercúrio, sem rotas |
| 7–10 (opcionais, fragmentos extras) | 100 mil a 600 mil de metal, 30 mil a 180 mil de ligas, 25 mil a 90 mil de combustível e 3 mil a 25 mil de componentes | Mercúrio e rotas |

As etapas opcionais são o destino de longo prazo da sobra, com entrega automática pela Lúmen.

**O que foi testado e descartado:**
- **Volumes grandes nas etapas obrigatórias e ligas no Núcleo:** atrasavam o Colapso. O Núcleo chegou a 240–330 min, porque a logística até Netuno é estreita. O 2º universo Ancestral foi de 41 para até 236 min.
- **Muitos componentes no Dyson:** tiravam de Marte os componentes de que o sistema exterior precisa.
- **2,5× mais ligas:** dois universos passaram de 200 min.

**Resultado** (média dos 5 universos, 1º Colapso):

| Recurso | Exportado antes | Exportado depois |
|---|---|---|
| Metal | 38% | 27% |
| Combustível | 86% | 80% |
| Ligas | 89% | 89% |
| Componentes | 89% | 88% |

**Ritmo:**
- **1º Colapso:** 74–88 min (antes 74–86).
- **2º universo:** igual à versão anterior (Ancestral 38–47 min; antes 41).

**O que continua:**
- **Ligas, componentes e metais raros seguem sobrando:** eles sobram em planetas longe de onde poderiam ser usados, e qualquer destino grande para eles esbarra na logística (recomendação 2).
- **As tabelas abaixo descrevem o jogo antes desta mudança.**

## Como foi medido

- **Ferramenta:** `node tools/balanco-recursos.js [universo...]`. O resultado completo fica em `artifacts/balanco-recursos.json`.
- **Simulação:** o bot de teste joga do zero até o 1º Colapso nos cinco universos. O motor roda instrumentado só na memória; os arquivos do jogo e os saves não são tocados.
- **O que é contado, por recurso:**
  - produzido;
  - consumido como insumo;
  - gasto em ações (construções, melhorias, rotas, expedições);
  - entregue a projetos (lançamentos, Enxame de Dyson, Núcleo);
  - combustível dos cargueiros;
  - ganho em recompensas e estoques iniciais;
  - exportado;
  - o que sobrou.
- **Conferência:** a conta fecha. Em todos os recursos e universos, `início + produzido + ganho − insumos − ações − projetos − combustível de rota − exportado − fim` dá **0,00%**.
- **Amostras:** a cada 10 s de jogo, estoque cheio ou vazio por região e o motivo de parada de cada instalação. Fotos do balanço acumulado aos 20 e aos 40 min.
- **Ressalva:** o bot joga sem pausas e não é um jogador perfeito, principalmente em logística. As proporções importam mais que os tempos absolutos.

| Universo | Padrão | Abundante | Energético | Congelado | Ancestral |
|---|---|---|---|---|---|
| 1º Colapso | 86 min | 81 min | 80 min | 80 min | 74 min |

## Resumo

1. **O começo é equilibrado.** Nos primeiros 20 min, as ações consomem boa parte do que entra: 76% do combustível, 45% dos componentes e 24% do metal. Cada compra pesa.
2. **Depois de ~20 min os recursos básicos sobram, como em 27/10.** Depois dos 40 min, as ações usam menos de 5% de quase todos os básicos, e o resto é exportado:

   | Recurso | Exportado |
   |---|---|
   | Metais raros | 93% |
   | Ligas | 89% |
   | Componentes | 89% |
   | Combustível | 86% |
   | Gelo | 70% |

3. **A exportação não rende dados.** `D.exportRate = 0`: o excedente só conta para o valor de produção do Colapso, a parcela de fragmentos chamada "produção". O texto do jogo não promete dados ("EXP = exportar excedente à Terra"). Um comentário no código ainda prometia; foi corrigido.
4. **Os gargalos reais são de logística nas cadeias finais.** Sobra num planeta e falta no vizinho:
   - **Supercondutores:** o Processador Criogênico de Urano para por estoque cheio 77% do tempo. Enquanto isso, os laboratórios de Netuno esperam supercondutores 68% do tempo.
   - **Metais raros:** o Cinturão fica com o estoque cheio 92% do tempo. A Fundição Fotovoltaica de Mercúrio espera metais raros 46% do tempo.
   - **Ligas:** sobram em todos os planetas internos, mas o Grande Estaleiro de Saturno espera ligas 39% do tempo.
5. **Os recursos finais é que ditam o ritmo.**
   - **Matéria exótica:** 60% vai para projetos (Núcleo) e o resto fica guardado.
   - **Módulos estruturais:** só 29% são usados até o Colapso; o resto fica para as etapas opcionais do Dyson.
   - **Células solares:** 97% viram satélites. É a cadeia mais bem dimensionada do jogo.
6. **Vênus agora tem papel.** Ela produz 100% dos gases e 63% do combustível do sistema. Dos gases, 68% viram insumo, a maior parte na fusão de Júpiter.

## Destino de cada recurso

Média dos cinco universos, em % do que entrou (produzido + ganho). "Ações" = construções, melhorias, rotas, projetos e combustível de cargueiro.

| Recurso | Vira insumo | Ações | Exportado | Sobra no Colapso | Diagnóstico |
|---|---|---|---|---|---|
| Minério | 87% | 0% | 13% | 0% | Bem aproveitado: quase todo vira metal. |
| Metal | 60% | 2% | 38% | 0% | Equilibrado no começo; sobra depois de ~20 min. |
| Ligas | 10% | 1% | 89% | 0% | Sobra muito. Em Mercúrio a Forja fica parada por estoque cheio 95% do tempo. |
| Componentes | 6% | 4% | 89% | 2% | Só Marte produz; sobra lá e chega pouco aos outros. |
| Gelo | 29% | 0% | 70% | 1% | Saturno produz 72%; as escavadoras de Netuno ficam paradas por estoque cheio 95% do tempo. |
| Gases | 68% | 0% | 31% | 1% | Bom: Vênus abastece a fusão de Júpiter. |
| Combustível | 0% | 12% | 86% | 2% | Nenhuma máquina consome; só rotas, lançamentos e expedições. É o sumidouro mais fraco. |
| Metais Raros | 6% | 0% | 93% | 1% | Sobra no Cinturão e falta em Mercúrio e Urano (logística). |
| Células Solares | 97% | 2% | 0% | 1% | Cadeia apertada e bem dimensionada. |
| Comb. de Fusão | 10% | 10% | 44% (0–75) | 36% | A Refinaria de Fusão fica parada por estoque cheio 71% do tempo. |
| Módulos Estruturais | 0% | 29% | 0% | 71% | Escasso e guardado para o Dyson e o Núcleo. |
| Supercondutores | 11% | 6% | 69% (0–88) | 13% | Sobra em Urano e falta em Netuno (logística). |
| Matéria Exótica | 0% | 60% | 0% | 40% | Portão final (Núcleo e Dyson). |
| Satélites Dyson | 0% | 5% | 92% | 4% | Superprodução: as etapas obrigatórias pedem pouco. |

## Ao longo da partida (Universo Padrão)

% do que entrou em cada período, gasto em ações / exportado.

| Recurso | 0–20 min | 20–40 min | 40 min ao Colapso |
|---|---|---|---|
| Metal | 24% / 22% | 4% / 41% | 1% / 37% |
| Ligas | 14% / 71% | 3% / 89% | 1% / 93% |
| Componentes | 45% / 0% | 8% / 74% | 4% / 85% |
| Combustível | 76% / 0% | 22% / 64% | 9% / 90% |
| Metais Raros | 1% / 88% | 0% / 95% | 0% / 94% |
| Comb. de Fusão | — | 27% / 0% | 17% / 0% |

## Instalações e energia

- **Paradas esperando insumo:**

  | Instalação | Esperando | Tempo parada |
  |---|---|---|
  | Laboratório de Anomalia (Netuno) | supercondutores | 68% |
  | Fundição Fotovoltaica (Mercúrio) | metais raros | 46% |
  | Grande Estaleiro (Saturno) | ligas | 39% |
  | Fábrica de Satélites (Mercúrio) | células | 35% |

- **Paradas por estoque cheio:** Escavadora de Gelo de Netuno 95%, Forja de Mercúrio 95%, Processador Criogênico 77%, Refinaria de Fusão 71%, Grande Estaleiro 52%.
- **Energia no fim (geração ÷ consumo, Padrão):** Júpiter 27×, Saturno 9×, Urano 6,9×, Vênus 4,1×, Lua e Mercúrio 3,1×, Marte 2,6×, Netuno 2,5×, Cinturão 1,2×. As missões de reator deixam Júpiter com muito mais energia do que usa.

## Recomendações (não aplicadas)

1. **Dar destino aos básicos no meio e no fim do jogo.** É o mesmo achado de 27/10, e continua sendo o maior desequilíbrio. Opções:
   - etapas opcionais do Dyson (7–10) e o Núcleo pedirem ligas, componentes e combustível em quantidade;
   - o Reator de Fusão consumir combustível;
   - religar uma taxa pequena de exportação para dados. Cuidado: a taxa foi zerada para conter o excesso de dados em partidas de farm.
2. **Aliviar a logística das cadeias finais.** Urano → Netuno (supercondutores), Cinturão → Mercúrio (metais raros) e ligas → Saturno. Opções:
   - mais carga por cargueiro para recursos de alto valor;
   - missões que ensinem essas rotas, como "Receber 60 supercondutores por rotas" em Netuno.
3. **Rever instalações sem função no planeta.** Do mesmo jeito que a Plataforma saiu de Júpiter:
   - a **Forja de Mercúrio** produz ligas que ninguém usa lá (parada 95% do tempo);
   - a **Refinaria Química de Júpiter** perdeu o sentido: o combustível já sobra e os gases agora são importados.
4. **Satélites Dyson:** a Fábrica de Satélites produz bem mais que as etapas 1–6 pedem. Isso é aceitável enquanto as etapas 7–10 servirem de destino.

## Como repetir

```
node tools/balanco-recursos.js            # cinco universos (~10 s)
node tools/balanco-recursos.js padrao     # um universo
```
