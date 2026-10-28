# Balanço de recursos — HELIOS IDLE

Data: 27/10/2026. Base: código atual (`js/data.js` e `js/engine.js`). Nenhum valor do jogo foi alterado.

## Alterações aplicadas depois do balanço (recomendações 1, 3 e 4)

As tabelas mais abaixo descrevem o jogo **antes** destas mudanças. Esta seção traz a nova medição, feita com o mesmo método.

1. **A energia acompanha a velocidade.** O consumo agora é `e × máquinas × velocidade^0,3` (`D.energySpeedExp` em `js/data.js`).
   - O expoente proposto era 0,5. Com ele, e também com 0,4, a campanha travou em vários universos. Uma região sem energia não juntava material para novos geradores e entrava numa espiral.
   - Com 0,3 o consumo dobra com um especialista de nível 5 e quase quadruplica no nível 10, e todos os universos chegam ao Colapso.
   - O aviso de gargalo por falta de energia agora sugere pausar as instalações de transformação quando não há material para geradores.
2. **Forja:** consome 3 metais por liga (antes 4). Assim nenhuma conversão perde valor.
3. **Aviso de rota:**
   - Quando uma instalação está sem um insumo que sobra em outra região, o motivo mostra onde (“Sem metais raros — sobrando em Cinturão de Asteroides”). Conta como sobra um estoque acima de metade da capacidade ou com exportação ligada.
   - O painel de gargalo indica a rota a criar, ou o cargueiro a melhorar se a rota já existir.
   - O botão **Planejar rota** (ou **Ver rotas**) abre a aba de rotas com origem, destino e recurso já escolhidos.
4. **Bot de teste:** passou a jogar como uma pessoa diante da nova energia.
   - Compara melhorar geradores com construir novos.
   - Sem material para geradores, pausa por até 60 s as instalações de transformação, sem nunca pausar as que produzem o material dos geradores.

### Antes × depois

| Medida | Antes | Depois |
|---|---|---|
| Primeiro Colapso (Padrão / Abundante / Energético / Congelado / Ancestral) | 1h50 / 1h50 / 2h06 / 3h02 / 2h02 | 1h22 / 2h07 / 2h04 / 2h46 / 2h51 |
| Segundo Colapso | 33–43 min | 33–52 min |
| Geração ÷ consumo no fim (por região) | 5× a 36× | 2,7× a 20× |
| Energia aos 20 min no Padrão (geração/consumo) | não medida | Lua 102/92, Marte 115/94, Cinturão 77/74 MW |
| Metal: vira insumo / exportado | 37% / 61% | 56% / 41% |
| Ligas: vira insumo / exportado | 69% / 25% | 60% / 35% |

- **Padrão mais rápido:** o novo bot melhora painéis, o que antes não fazia.
- **Ancestral mais lento:** provavelmente porque as expedições, que lá rendem mais, custam combustível e ligas que agora competem com os geradores no início.
- **O que continua igual:** os demais recursos básicos (minério, gelo, gases, combustível, componentes e metais raros) seguem sobrando no meio do jogo. A recomendação 2 (novos sumidouros) não foi aplicada.

**Testes:**
- 110 verificações de regressão;
- as campanhas do bot nos cinco universos, até o segundo Colapso;
- 72 verificações de interface no navegador;
- o aviso de rota verificado na tela de Urano, numa partida de teste apagada em seguida.

## Como foi medido

- **Simulação:** a campanha do bot (`tools/bot.js`) foi jogada do zero até o primeiro Colapso nos cinco universos. A medição usou uma cópia instrumentada do motor, na memória; os arquivos do jogo não foram alterados.
- **O que foi contado, por recurso:**
  - produção creditada e insumos consumidos pelas máquinas;
  - combustível das rotas e excedente exportado;
  - gastos e ganhos de cada ação (construções, melhorias, projetos, missões, expedições, cargueiros, baús);
  - estoque inicial e final.
- **Conferência:** a conta fecha. Em todos os recursos e universos, `início + produzido + ganhos − insumos − gastos − exportado − final` dá 0.
- **Amostras a cada 10 s de jogo:** estoque cheio ou vazio por região, motivo de parada de cada instalação e energia.
- **Ressalva:** o bot joga sem pausas e não é otimizado. Os números absolutos valem para um jogador muito ativo; as proporções são o que importa.

| Universo | Colapso | Valor produzido | Valor exportado | Dados ganhos / gastos |
|---|---|---|---|---|
| Padrão | 1h50 | 24,9 mi | 17,9 mi (72%) | 27,6 mil / 26,1 mil |
| Abundante | 1h50 | 32,9 mi | 24,1 mi (73%) | 27,7 mil / 26,0 mil |
| Energético | 2h06 | 34,7 mi | 25,7 mi (74%) | 41,2 mil / 38,6 mil |
| Congelado | 3h02 | 66,7 mi | 50,4 mi (76%) | 58,7 mil / 56,1 mil |
| Ancestral | 2h02 | 35,3 mi | 25,6 mi (73%) | 47,3 mil / 44,6 mil |

## Resumo

1. **Os primeiros 20 minutos são equilibrados.** Construções e melhorias consomem de 25% a 55% do metal produzido. Cada compra é uma escolha.
2. **Depois de ~30 minutos (5 regiões abertas), os recursos básicos sobram.**
   - As ações consomem menos de 5% do que é produzido.
   - Quase todos os estoques passam de 80% a 100% do tempo cheios.
   - Cerca de 3/4 de toda a produção é exportada.
   - O excedente não é inútil, porque conta para o valor do Colapso. Mas o custo das instalações deixa de pesar nas decisões.
3. **Os gargalos reais são de logística, não de produção.**
   - Metais raros: 96% sobram no Cinturão, enquanto o Processador Criogênico de Urano fica 69% do tempo sem eles.
   - Supercondutores: 56% sobram em Urano, enquanto Netuno espera por eles.
   - Ligas para o Estaleiro de Saturno e componentes saindo de Marte seguem o mesmo padrão.
4. **Os recursos finais é que ditam o ritmo.** Módulos Estruturais e Matéria Exótica nunca sobram: são gastos ou guardados para projetos. Células Solares são consumidas quase por inteiro (97%) pela Fábrica de Satélites.
5. **A energia deixa de ser uma restrição.**
   - No fim, a geração fica entre 5× e 36× o consumo, conforme a região.
   - O motivo: o consumo é `energia × quantidade de máquinas`. Ele não aumenta com o nível nem com a velocidade dos especialistas (até ×96), que multiplicam a produção.
6. **Dados de pesquisa são a moeda mais bem equilibrada.** O que entra (missões, observatórios, baús, expedições) é quase todo gasto em pesquisa e promoções. Sobra só 5%.

## Balanço por recurso

Média dos cinco universos. Percentuais sobre o total produzido.

| Recurso | Vira insumo | Gasto em ações | Exportado | Diagnóstico |
|---|---|---|---|---|
| Minério | 48% | 0% | 52% (39–62) | Sobra. O Cinturão sozinho produz 60% de todo o minério. |
| Metal | 37% | 1,6% | 61% | Sobra a partir de ~30 min. É o recurso das decisões do início. |
| Ligas | 69% | 4,9% | 25% (0–79) | Equilibrado. É o principal insumo de Marte e de Saturno; falta ao Estaleiro. No Congelado sobra muito (79%). |
| Componentes | 9% | 1,2% | 89% | Só Marte produz. Sobra em Marte e falta onde é usado. É gargalo de rota. |
| Gelo | 26% | 0% | 74% | Sobra. Na Lua e em Netuno as escavadoras ficam paradas por estoque cheio em ~95% do tempo. |
| Gases | 44% | 0,1% | 55% | Razoável. |
| Combustível | 0% | 9,1% | 90% | Nenhuma máquina consome. Só rotas, lançamentos e expedições, e as rotas usam ~6%. É o sumidouro mais fraco. |
| Metais Raros | 4% | 0% | 96% | Sobra no Cinturão e falta em Mercúrio e Urano. É gargalo de rota. |
| Células Solares | 97% | 1% | 0% | Cadeia apertada e bem dimensionada. |
| Comb. de Fusão | 2% | 1,8% | 91% | Sobra em Júpiter. Só o Laboratório de Anomalia (Netuno) consome. |
| Módulos Estruturais | 0% | 33% | 0% | Escasso. O resto fica guardado para o Dyson e o Núcleo. |
| Supercondutores | 28% | 6% | 56% (0–78) | Sobra em Urano e falta em Netuno (Observatório Profundo sem insumo 55% do tempo). |
| Matéria Exótica | 0% | 61% | 0% | É o portão final: Núcleo (60) + pagamentos (35), mais a meta de produção de 145. |
| Satélites Dyson | 0% | 3% | 95% | Superprodução do bot. As etapas 1–6 pedem 170; as etapas 7–10, opcionais, pedem mais 650. |

## Cadeias de produção

Valores por segundo, por máquina, no nível 1, sem bônus. "Agrega" compara o valor de Colapso do produto com o valor dos insumos.

| Máquina | Produz | Consome | Energia | Agrega |
|---|---|---|---|---|
| Extrator | 1,00 minério | — | 1 | — |
| Minerador de Asteroides | 2,00 minério | — | 3 | — |
| Garimpeira | 0,17 raro | — | 4 | — |
| Escavadora de Gelo | 0,75 gelo | — | 1 | — |
| Plataforma Atmosférica | 0,80 gás | — | 2 | — |
| Refinaria | 0,50 metal | 1,00 minério | 2 | 1,5× |
| Eletrolisador | 0,40 combustível | 0,80 gelo | 3 | 2,0× |
| Refinaria Química | 0,50 combustível | 0,83 gás | 3 | 1,2× |
| **Forja** | 0,17 liga | 0,67 metal | 3 | **0,83×** |
| Fábrica de Componentes | 0,125 comp. | 0,25 liga + 0,25 metal | 4 | 1,15× |
| Fundição Fotovoltaica | 0,125 célula | 0,375 metal + 0,125 raro | 6 | 2,1× |
| Refinaria de Fusão | 0,10 fusão | 0,60 gás | 10 | 6,7× |
| Processador Criogênico | 0,083 supercond. | 0,50 gelo + 0,083 raro | 10 | 5,8× |
| Fábrica de Satélites | 0,05 satélite | 0,15 célula + 0,10 comp. | 15 | 1,7× |
| Grande Estaleiro | 0,067 módulo | 0,27 liga + 0,13 comp. | 12 | 2,0× |
| Laboratório de Anomalia | 0,04 exótica | 0,08 supercond. + 0,08 fusão | 30 | 2,2× |

- **Proporções úteis:**
  - 1 Extrator alimenta exatamente 1 Refinaria.
  - 1 Forja precisa de 1,33 Refinaria.
  - 1 Fábrica de Componentes precisa de 1,5 Forja e meia Refinaria extra.
- **Forja:** é a única conversão que reduz valor (4 metais valem 12; 1 liga vale 10).
- **Refinaria Química:** agrega pouco (1,2×) diante do Eletrolisador (2,0×), e o produto dela, o combustível, já sobra.

## Linha do tempo (Universo Padrão)

Produzido / exportado / gasto em ações em cada janela de 10 minutos.

| Minuto | Regiões | Metal | Ligas | Componentes | Combustível |
|---|---|---|---|---|---|
| 0–10 | 2 | 4,0k / 0 / 2,2k | 437 / 0 / 140 | 28 / 0 / 0 | 529 / 0 / 104 |
| 10–20 | 2 | 8,8k / 0 / 2,8k | 2,0k / 0 / 249 | 990 / 670 / 40 | 287 / 0 / 141 |
| 20–30 | 5 | 29k / 4k / 7,3k | 7,0k / 0 / 2,0k | 3,6k / 2,8k / 374 | 2,6k / 0 / 539 |
| 30–40 | 6 | 68k / 41k / 2,6k | 9,3k / 0 / 1,5k | 7,6k / 6,6k / 314 | 18k / 14k / 687 |
| 40–60 | 7 | ~81k / 48k / 0–1,3k | ~13k / 0 / 0–1,3k | ~14k / 13k / 0–225 | 33–41k / 29–38k / 165–653 |
| 60–80 | 7–8 | ~81–87k / 48k / 0–1k | ~14–16k / 0 / 30–1,4k | ~15–16k / 13–14k / 0–295 | ~40–48k / 38–44k / 165–959 |
| 80–110 | 8–9 | 103–118k / 65–72k / 26–1,4k | 15–20k / 0 / 0,5–1,7k | 16–25k / 14–23k / 0,1–0,4k | 55–69k / 51–65k / 0,2–0,8k |

Entre 50 e 80 minutos, quase nada é gasto. O avanço depende das metas de produção das missões e do tempo dos projetos, não dos recursos.

## Energia

- O consumo é `e × máquinas`, com reduções de pesquisa e universo. Não cresce com nível, velocidade nem especialistas. A geração cresce com nível, pesquisa e Dyson.
- Falta de energia aparece em menos de 1% do tempo depois que cada região se estabelece.
- As metas de energia das missões somam 1.470. Elas fazem o jogador construir geração, mas essa geração não é usada.

## Dados de pesquisa (Universo Padrão)

| Entrada | Quantidade | Saída | Quantidade |
|---|---|---|---|
| Missões | 10,7 mil | Pesquisa | 19,6 mil |
| Produção (observatórios) | 9,3 mil | Promoções de especialistas | 6,5 mil |
| Baús de fase | 4,2 mil | | |
| Expedições | 2,9 mil | | |
| Diretrizes do universo | 0,5 mil | | |

O ritmo de pesquisa e de promoções segue a entrada de dados. Esta é a parte da economia que funciona como esperado.

## Diferenças entre universos

- **Congelado:** dobra o gelo e aumenta o consumo da indústria. Leva 3h até o Colapso e produz o dobro de valor (66,7 mi), porque o tempo maior acumula produção. Lá as ligas sobram (79% exportadas) e os supercondutores ficam apertados (73% viram insumo).
- **Energético e Ancestral:** rendem mais dados (41–47 mil), pelas expedições e pelo Dyson mais barato.
- **Abundante:** praticamente igual ao Padrão no tempo; só produz mais minério e metal.

## Recomendações (não aplicadas)

Em ordem de impacto:

1. **Energia acompanhar a velocidade.** Por exemplo, consumo = `e × máquinas × velocidade^0,5`. Assim os especialistas e a pesquisa de velocidade voltam a exigir geração, e as metas de energia passam a ter sentido. É preciso reequilibrar a geração do painel e do reator logo depois.
2. **Sumidouros para o meio do jogo.** Opções, da mais leve à mais forte:
   - **a)** Combustível por viagem proporcional à carga real (hoje é fixo por viagem). Hoje as rotas usam 6% do combustível.
   - **b)** Melhorias acima do nível 5 pedindo recursos da região seguinte (ex.: módulos, supercondutores).
   - **c)** Taxa de exportação pequena (`D.exportRate`, hoje 0). Com 0,0001 o excedente renderia ~1,8 mil dados no Padrão (+6%), sem desequilibrar a pesquisa.
3. **Forja:** passar o consumo de 4 para 3 metais, ou o valor da liga de 10 para 13. Assim nenhuma conversão perde valor.
4. **Mostrar os gargalos de rota.** Um aviso do tipo "Metais raros sobrando no Cinturão; Urano está sem metais raros" quando um consumidor está parado e outra região exporta o mesmo recurso. Hoje o jogador precisa descobrir isso sozinho.
5. **Combustível de fusão:** só um consumidor, em Netuno, e 91% sobra. Dá para fazer o Reator de Fusão consumir um pouco, como 0,05/s, o que também ajuda no item 1.
6. **Armazém:** com a exportação ligada, a capacidade quase não importa depois dos 30 minutos. Ele poderia dar outro bônus nos níveis altos, como velocidade de descarga ou reserva para rotas.

## Como repetir a medição

O script fica fora do projeto; ele carrega `js/data.js`, uma cópia do `js/engine.js` com contadores e o bot em modo biblioteca (`BOT_LIB=1`). O mesmo método pode virar `tools/balanco.js` se for útil manter.
