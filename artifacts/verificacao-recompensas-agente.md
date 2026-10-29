# Verificação de recompensas — 29/10/2026

Inspeção do commit `9e80c56` e fixtures de motor em VM, sem ler saves pessoais nem alterar o jogo. Os estados de teste estabelecem condições artificiais para verificar regras; não medem tempo de aquisição.

## Divergências concretas entre apresentação e crédito

- `js/ui.js:30` apresenta `rw.data` base, enquanto `js/engine.js:771` paga `round(rw.data × dataGain)`. Fixture: Oráculo Nv.3 faz uma recompensa exibida de 100 pagar 130. Missões e diretrizes usam esse mesmo renderizador. Exibir o valor efetivo e identificar o bônus; o motor deve ser a fonte única da prévia.
- `js/ui.js:33` diz “Recruta” mesmo quando o especialista já existe. `js/engine.js:818` nesse caso soma uma carta; `E.grant` retorna `got.spec`, mas deixa `got.cards` vazio. Fixture: Íris existente recebe uma carta, não um segundo especialista. Corrigir texto e estrutura de resultado para informar a recompensa realmente entregue.
- `js/ui.js:876` apresenta dados garantidos de expedição com `expReward`, omitindo `dataGain`; `js/ui.js:879` apresenta os bônus opcionais sem os dois multiplicadores. `scaleRw` (`js/engine.js:901`) e `E.grant` aplicam os fatores em duas etapas com arredondamento. A prévia precisa respeitar essa mesma ordem e o limite atual de fragmentos.

## Recursos que podem ser perdidos

- `js/engine.js:775` limita imediatamente prêmios materiais ao espaço livre. Fixture: estoque lunar de metal cheio (150), missão `lua.0.0` concluída: resgate paga 5 dados, 0 dos 10 metais anunciados e grava missão resgatada. Não existe registro do excedente pendente. É uma regra de descarte, mas a interface não a comunica. Preferir caixa de suprimentos recuperável ou bloqueio/aviso claro antes do resgate, sem duplicação em novo clique/importação.
- `E.collapsePending` (`js/engine.js:1033`) considera missões principais e expedições, não diretrizes. `E.doCollapse` (`js/engine.js:1042`) substitui `run`, apagando diretrizes concluídas não resgatadas. Fixture Padrão com 3 diretrizes prontas: colapsar sem resgatá-las perde 400 dados e 1 fragmento, comparado ao mesmo estado com resgate prévio. O resumo `js/ui.js:1157` não informa essa perda. Recomendar incluir diretrizes prontas na liquidação permanente e na prévia; nunca pagar incompletas nem duas vezes.

## Pontos de desenho econômico

- Recrutamentos repetidos já dão +1 carta (`js/engine.js:818`), inclusive no nível máximo, em que ela não pode ser consumida. Não é duplicação de especialista.
- Baús sorteiam conteúdo em `E.makeChest` (`js/engine.js:853`), usando apenas especialistas possuídos. O pool não exclui nível máximo. A abertura usa o `dataGain` vigente (`js/engine.js:871`). Isso permite guardar baús para um bônus posterior, mas é uma regra de momento de crédito, não corrupção de save.
- Fixture com os 11 especialistas Nv.10: baú gpi20 mantém as 15 cartas do sorteio, todas sem uso para promoção. Não existe conversão de duplicatas. Se alterar, preferir prioridade a especialistas ainda evoluíveis e destino limitado para excesso; não converter tudo em dados ou fragmentos, pois isso reforça a inflação estudada.
- Qualquer novo prêmio de carta direcionada deve considerar que `E.addCards` (`js/engine.js:820`) recruta automaticamente especialista não possuído com a primeira carta. Não conceder cartas de um especialista antes do marco que deve recrutá-lo sem decidir explicitamente essa interação.

## Atenção para novas patentes permanentes

Se o prompt adicionar descobertas/patentes como recompensas, incluir esses tipos em `E.doCollapse` e na migração/validação. Hoje a liquidação das missões copia explicitamente apenas `data`, `spec`, `cards`, `frags` (`js/engine.js:1051`); um campo novo pode ficar de fora. A coleção de baús já está em `perm` e sobrevive ao Colapso.
