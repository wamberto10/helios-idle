# Verificação de balanceamento e recompensas

Data: 29/10/2026. Versão examinada: checkout local no commit `9e80c56a923f01b3cc127ca069a35ccd9f2d5b11`.

**Resultado: o jogo foi balanceado parcialmente. O limite de fragmentos foi aplicado; a inflação científica e a desvalorização das recompensas das missões continuam.** Nesta verificação foram criados scripts, resultados e o prompt de correções. Nenhum arquivo do jogo nem salvamento pessoal foi alterado. Não foi verificada uma publicação diferente no GitHub Pages.

O prompt para a próxima implementação está em [PROMPT-CORRECOES-BALANCEAMENTO.md](PROMPT-CORRECOES-BALANCEAMENTO.md).

## O que já mudou

O motor limita o ganho a um fragmento por tipo de expedição por universo. Ruínas e Câmaras podem dar até dois somados; nas Câmaras ainda é necessário sortear o bônus. As repetições conservam cartas e dados. O registro sobrevive ao save e reinicia no próximo universo. Há testes e indicação na interface.

Energia com expoente 0,3, Forja consumindo três metais e aviso de material em outra região também estão presentes, mas já existiam na auditoria anterior. A descrição do commit menciona balanceamento; isso não significa que todas as propostas do relatório tenham sido implementadas.

Comparação com os hashes registrados na auditoria anterior:

| Arquivo | Resultado |
|---|---|
| `js/data.js` | Idêntico: `3f09b47ee410f9fe4f440c7325ca19e00fd373cdbdb4e203b682f691686d009a` |
| `js/engine.js` | Alterado: `d3f196fa36d71a0670d71002013bb26b78f4b42b9b88de2d7ed5328d56c69986` |

Assim, as curvas de especialistas, custos de pesquisa e tabelas de missões continuam com os números anteriores. No motor, a ciência ainda recebe toda a velocidade e o rendimento globais. A pesquisa ainda exige apenas dinheiro e um nível dos nós anteriores.

## Nova simulação do código atual

Foram executadas cinco condições iniciais de universo, com estratégia normal e estratégia de farm. Cada uma chegou à disponibilidade de dois Colapsos. Dois ramos independentes de cada cenário continuaram quatro horas sem reiniciar, um antes do primeiro Colapso e outro depois da segunda campanha.

- **20/20 campanhas chegaram ao Colapso**, totalizando **102,21 horas de jogo simulado**, incluindo as extensões. A execução levou aproximadamente 91 segundos reais.
- As ações são tomadas a cada dois segundos de jogo pelo bot. A estratégia de farm compra até dez observatórios Nv.5 na Lua e dez em Marte e pesquisa assim que pode, pagando os custos reais.
- Toda a contabilidade medida de dados fechou com erro arredondado zero.
- O conjunto existente de regressões passou: **121/121 verificações**. Isso verifica funcionamento; não comprova equilíbrio econômico.
- As extensões de quatro horas continuam recebendo ações do bot. São permanência ativa acelerada, **não ausência offline**. Os ensaios controlados de produção sem interação são descritos separadamente.
- Os destinos do segundo universo dependem do sorteio e podem mudar entre estratégias. A comparação entre universos abaixo usa somente a primeira campanha, no mesmo destino inicial.

| Universo inicial | Normal: primeiro Colapso disponível | Farm: primeiro Colapso disponível | Pesquisa comprada no farm nesse momento | Farm: árvore completa sem primeiro Colapso |
|---|---:|---:|---:|---:|
| Padrão | 82,2 min | 60,7 min | 83,8% | 2h11m30s |
| Abundante | 126,9 min | 63,7 min | 84,7% | 2h11m26s |
| Energético | 123,7 min | 64,2 min | 85,6% | 2h10m30s |
| Congelado | 165,4 min | 60,8 min | 81,1% | 2h11m04s |
| Ancestral | 171,1 min | 59,7 min | 85,6% | 2h10m44s |

Percentuais são dos 111 níveis que custam dados, não do orçamento gasto. Os tempos são de ações instantâneas e muito frequentes; não preveem o ritmo de uma pessoa.

No Padrão com farm, a segunda campanha é no Congelado. A árvore já chega completa aos **20m04s depois do reinício**. A disponibilidade do segundo Colapso vem aos 30m42s; o saldo é 106,9 mil dados. Após mais quatro horas nesse universo, chega a **3,03 milhões**. Nos cinco cenários de farm, todas as árvores estão completas até a disponibilidade do segundo Colapso e os saldos quatro horas depois ficam entre **2,55 e 3,22 milhões**.

Separadamente, ensaio controlado com dez observatórios Nv.5, Oráculo 3 e energia fornecida confirma **10,4 dados/s**, ou **299.520 dados em oito horas**. A instalação foi fornecida para medir a fórmula; isso não significa que seja obtida no começo da partida. A árvore inteira custa 199.973 dados. Um teste de acesso com saldo artificial também compra todos os 111 níveis apenas na Lua, confirmando a falta de requisito de descoberta.

## Recompensas das missões

Há 164 missões em 21 fases. **152, ou 92,68%, recompensam diretamente só com dados.** Oito recrutam especialistas, três também entregam materiais e uma libera expedições. Não há cartas direcionadas nas recompensas diretas; elas vêm de baús e expedições, além da carta por recrutamento repetido.

| Região | Missões | Recompensas diretas só em dados | Dados base |
|---|---:|---:|---:|
| Lua | 28 | 20 | 340 |
| Marte | 24 | 23 | 605 |
| Cinturão | 16 | 16 | 540 |
| Mercúrio | 16 | 15 | 660 |
| Vênus | 16 | 15 | 810 |
| Júpiter | 16 | 15 | 960 |
| Saturno | 16 | 16 | 1.180 |
| Urano | 16 | 16 | 1.340 |
| Netuno | 16 | 16 | 1.700 |
| **Total** | **164** | **152** | **8.135** |

Os baús das 21 fases acrescentam 3.570 dados e 181 cartas base, antes dos multiplicadores. As missões continuam necessárias para fases, regiões, recrutamentos e baús. O problema é a perda de valor do prêmio em dados, junto da ausência de vínculo entre descobertas e pesquisas avançadas.

### Valor medido ao resgatar

O novo script registra cada missão e compara os dados recebidos com a produção científica real dos 300 segundos anteriores, usando a janela disponível no início. Missões sem produção científica recente são excluídas desse cálculo. É uma equivalência econômica, não tempo gasto para cumprir o objetivo.

| Padrão: estratégia e campanha | Missões medidas com dados | Mediana da equivalência | Participação das missões em todos os dados ganhos |
|---|---:|---:|---:|
| Normal, primeira campanha | 137 | 506,8 s | 42,0% |
| Farm, primeira campanha | 137 | 10,1 s | 17,7% |
| Farm, segunda campanha | 138 | 1,4 s | 5,3% |

No segundo universo dos cinco cenários de farm, a mediana fica entre **1,13 e 1,52 segundo**. O limite das ruínas corrigiu outro excesso, mas não resolveu essa perda de relevância.

As metas de produção e ciclos são cumulativas no universo. Pesquisa e promoção consultam progresso permanente. Uma missão aparecer já concluída pode ser consequência correta dessas regras. Não foi constatada duplicação de recompensas por esse motivo. Zerar todos esses contadores ao mostrar a missão acrescentaria espera e desconsideraria progresso anterior.

## Problemas de recompensa confirmados

| Prioridade | Achado | Evidência atual | Correção proposta |
|---|---|---|---|
| Alta | Ciência escala demais e pesquisa não exige descobertas | `engine.js:136`, `171`, `232`, `986`; novas campanhas | Curva própria da ciência e descobertas permanentes para pesquisas avançadas |
| Alta | Muitas tarefas longas só dão dados de baixo valor | Tabela das missões e equivalência por resgate | Marcos funcionais e poucas cartas direcionadas, preservando início e orçamento |
| Alta | Diretrizes completas não resgatadas são perdidas no Colapso | `collapsePending`/`doCollapse`, `engine.js:1033`; fixture Padrão perde 400 dados base + 1 fragmento | Incluir diretrizes completas na prévia e liquidação, uma única vez |
| Média | UI de missão/diretriz mostra valor base | `ui.js:30`, `engine.js:771`: anuncia 100, paga 130 com Oráculo 3 | Prévia única que use bônus e arredondamento reais |
| Média | Recrutamento repetido anuncia novo recrutamento | `ui.js:33`, `engine.js:818`: entrega uma carta; resultado não a informa em `got.cards` | Mostrar e retornar a carta efetiva |
| Média | Prévia das expedições omite bônus | `ui.js:876–879` | Usar multiplicadores/ordem de arredondamento do motor, sem revelar resultado aleatório oculto |
| Média | Prêmio material pode ser descartado silenciosamente | `engine.js:775`: `lua.0.0` entrega zero dos dez metais com estoque cheio | Informar cabimento e permitir adiar/coletar sem perda silenciosa |
| Média | Baús continuam dando cartas sem uso | `engine.js:853`: com todos os especialistas Nv.10, baú de fase final entrega 15 cartas inutilizáveis | Priorizar elegíveis para evolução e definir destino limitado do excesso |
| Média | Consumo local compete com a própria melhoria | Consumo em `engine.js:390–404`; a reserva atual só pertence às rotas | Reserva ou pausa explícita para juntar o custo, com validação em Urano/Congelado |

As fixtures estabelecem condições artificiais para testar cada regra; não medem tempo de campanha. A perda de diretrizes pressupõe que o jogador não as tenha resgatado antes do Colapso. O bot costuma resgatá-las, por isso a campanha automatizada por si só não revela esse problema.

Os gastos totais de pesquisa e promoções continuam finitos. Mesmo com taxas melhores, após alcançar todos os tetos haverá excedente. Um projeto opcional pode dar utilidade a esse saldo; deve ter limite e evitar gerar mais ciência/fragmentos. Isso não substitui a correção das taxas.

## Conteúdo do prompt entregue

O prompt separa o que já funciona das correções pendentes. Inclui escala científica, marcos por missão, tabela de recompensas alteradas, prévia e crédito dos prêmios, diretrizes no Colapso, cartas sem uso, estoque cheio, reservas, migração dos saves e critérios de simulação. Os parâmetros dos experimentos antigos não são tratados como valores aprovados.

Os próximos ajustes devem preservar o início da Lua, as tecnologias essenciais e as recompensas já conquistadas. Não é recomendado multiplicar todos os custos, alongar todos os ciclos ou aumentar os dados das missões pela taxa dos observatórios.

## Reprodução e fontes

```powershell
node tools/regress.js
node tools/verificar-recompensas-missoes.js
node tools/verificar-balanceamento.js
```

- [Campanhas atuais, hashes e resumos](artifacts/verificacao-campanhas.json)
- [Resgates e equivalências por missão](artifacts/verificacao-missoes-campanhas.json)
- [Orçamentos e ensaios controlados de missões](artifacts/verificacao-missoes-atual.json)
- [Inspeção das fórmulas e alterações aplicadas](artifacts/verificacao-balanceamento-agente.md)
- [Análise da distribuição de prêmios](artifacts/verificacao-missoes-agente.md)
- [Casos de UI, armazenamento, baús e Colapso](artifacts/verificacao-recompensas-agente.md)

Os arquivos históricos `AUDITORIA-BALANCEAMENTO.md` e `artifacts/auditoria-*.json` foram preservados. Sua descrição de farm ilimitado de fragmentos representa o estado anterior à correção; não se aplica ao motor verificado hoje.
