# Verificação do balanceamento atual — 29/10/2026

Leitura do checkout local no commit `9e80c56a923f01b3cc127ca069a35ccd9f2d5b11`. Nenhum parâmetro ou arquivo do jogo foi alterado nesta verificação. A árvore estava limpa ao começar.

## Conclusão

O balanceamento foi aplicado **parcialmente**. O farm repetível de fragmentos das expedições foi limitado, mas a inflação científica, os custos da pesquisa, a ausência de vínculo entre pesquisa e região e as recompensas das missões continuam como na auditoria anterior.

## Comparação com a auditoria anterior

| Fonte | SHA256 auditado | SHA256 atual | Resultado |
|---|---|---|---|
| js/data.js | `3f09b47ee410f9fe4f440c7325ca19e00fd373cdbdb4e203b682f691686d009a` | igual | Sem alterações nos números, missões, pesquisa e especialistas |
| js/engine.js | `2f6cb27f20c371ec13d461a06107830448efe367adfb755bb19ebfdf9ca7d7d6` | `d3f196fa36d71a0670d71002013bb26b78f4b42b9b88de2d7ed5328d56c69986` | Limite de fragmentos adicionado |

Os hashes anteriores vêm de `artifacts/auditoria-missoes.json:3`. O diff de `cf930bf` para `HEAD` confirma que as únicas adições em `data.js` são os avatares do comandante; em `engine.js`, além do perfil, há o limite de fragmentos das expedições.

## O que foi corrigido

- `js/engine.js:915–928`: registro `run.flags['frag:'+id]`, no máximo **um fragmento por tipo de expedição por universo**. Portanto Ruínas + Câmaras podem dar até **dois** fragmentos somadas no mesmo universo. A chance das Câmaras continua existindo; o limite só é consumido quando um fragmento realmente sai.
- A UI explica o limite em `js/ui.js:877–879` e a coleta em `js/ui.js:1071`.
- `tools/regress.js:290–309` testa a primeira recompensa, a repetição, continuidade de dados/cartas, persistência no save, renovação após novo universo e compatibilidade do save sem flags.

Ensaio controlado desta verificação, com conclusões forçadas e bônus explícito nas Câmaras: Ruínas = 1 depois 0; Câmaras = 1 depois 0; total = 2 fragmentos. Este teste valida a regra de recompensa, não tempo de campanha.

## O que permanece igual

1. **Ciência:** `js/data.js:118–124` mantém 30s nos dois observatórios, saída 1/12; `js/data.js:138` mantém velocidade de especialistas até ×96. `js/engine.js:171–173` mantém Oráculo dando essa velocidade e bônus próprio a todos os dados. `js/engine.js:232–233` ainda multiplica ciência por toda a velocidade e rendimento globais; `js/engine.js:136` inclui `1 + 0,03 × fragsTotal` neste rendimento.
2. **Pesquisa:** `js/engine.js:986–992` só exige um nível dos pré-requisitos e dinheiro. Nenhum requisito de missão, descoberta ou região.
3. **Reservas de insumos:** `js/engine.js:390–404` calcula consumo contra o estoque todo. A reserva existente em `js/engine.js:456` pertence à partida da rota e não impede consumidores locais de gastarem o material de uma melhoria. Há UI para pausar instalações; não há reserva de material para melhoria.
4. **Energia e Forja:** energia usa velocidade elevada a 0,3 (`js/data.js:131`, `js/engine.js:231`), Forja consome 3 metais (`js/data.js:98`). Estes valores **já estavam na auditoria anterior**; o hash idêntico de `data.js` comprova isso. A descrição do último commit não comprova um novo ajuste posterior à auditoria.

## Ensaios de confirmação atuais

Fixtures em VM com o motor real, sem ler ou modificar saves do usuário:

- 10 observatórios Nv.5, Oráculo 3, Lua com energia artificialmente abundante, sem pesquisa e sem prestígio: taxa teórica **10,4 dados/s**; motor em 8h = **299.520 dados**, razão de energia 1. Resultado igual ao relatório anterior. A instalação foi fornecida para medir escala; o ensaio não mede tempo de aquisição.
- Estado inicial só com Lua desbloqueada, saldo artificial de dados para testar gates: compra **111/111 níveis** de pesquisa por **199.973 dados**, sem abrir qualquer outra região. Demonstra que o bloqueio por região continua ausente, não representa campanha normal.
- Recompensa base de missão 100 com Oráculo 3 continua 130 dados; os 10 observatórios descritos acima equivalem a essa recompensa em **12,5 segundos**. Aumentar Telemetria amplia ambos e não corrige a proporção.

Não é necessário propor novamente o limite de fragmentos como tarefa pendente. Deve-se mantê-lo, incluindo testes e migração, e corrigir a escala de ciência/missões com simulações atuais antes de escolher números finais.
