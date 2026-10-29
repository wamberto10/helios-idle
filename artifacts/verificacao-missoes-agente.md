# Verificação atual das recompensas das missões

Gerada em 29/10/2026. Fonte: código local atual, lido sem alterar o jogo ou saves. Reprodução: `node tools/verificar-recompensas-missoes.js`. Dados completos: `verificacao-missoes-atual.json`; o JSON inclui hashes das fontes usadas.

## Resultados confirmados

- 164 missões em 21 fases. 152 missões (92,68%) dão somente dados como recompensa direta. Oito recrutam especialistas; três também entregam recursos; uma libera expedições. Não há cartas direcionadas nem fragmentos nas recompensas diretas dessas missões.
- Total da campanha: 8.135 dados base nas missões; 3.570 dados base e 181 cartas nos baús de fase, antes dos multiplicadores. Os baús usam a ordem global de fases concluídas.
- Cinturão, Saturno, Urano e Netuno têm 16 missões cada, todas com recompensa direta somente em dados. As fases ainda são obrigatórias para o avanço de regiões e baús: o problema é a utilidade econômica da recompensa, não uma ausência de função na progressão.
- Em um cenário controlado de 5 observatórios nível 5 e Oráculo 3, a produção real do motor é 5,2 dados/s. Uma missão de 100 dados base paga 130 e equivale a 25 segundos dessa produção. Com 10 observatórios nível 5 e Telemetria V, são 15,6 dados/s; a mesma missão paga 195 e equivale a 12,5 segundos. Isso demonstra a perda de relevância sem inventar um tempo para adquirir as instalações.
- Em uma base avançada controlada de 8 observatórios nível 8, Oráculo 5, Telemetria V, 100 fragmentos totais, Eco Industrial II e Eco 1, a missão de 100 dados base equivale a 0,755 segundo da produção. Esses níveis foram fornecidos à fixture, não conquistados numa campanha cronometrada.
- O progresso de produção/ciclos/entregas é cumulativo no universo. A missão pode aparecer com sua meta satisfeita. Pesquisa e promoção consultam estado permanente: pesquisar 1 já aparece satisfeita no universo seguinte se o jogador preservou a pesquisa. Isso é a regra atual, não uma duplicação de recompensa.
- Metas comuns aumentam com os Colapsos até ×4 em seis Colapsos. Recrutamentos por ciclos ficam isentos desse aumento. O rendimento por fragmentos continua sem teto; aumentar metas sozinho não corrige a inflação.
- O código atual já limita o fragmento de descoberta a um por expedição em cada universo (`engine.js`, `expFragKey`/`collectExp`). Não repetir a antiga afirmação de farm ilimitado de fragmentos por ruínas como problema ainda aberto.

## Proposta para o prompt de correção

1. Preservar o orçamento inicial da Lua. Pouso entrega 20 dados base, suficientes para a primeira pesquisa barata; Posto de Extração ajuda a pesquisa seguinte. A missão pesquisar 1 não pode depender de concluir a própria fase para liberar a primeira pesquisa. Não multiplicar globalmente custos ou metas.
2. Corrigir primeiro a inflação de ciência. Aumentar a recompensa de todas as missões pela produção atual dos observatórios premiaria a mesma fonte inflacionada e criaria outro ciclo de realimentação.
3. Dar uma recompensa funcional a marcos já existentes. Usar descoberta tecnológica permanente em algumas missões, com ícone e descrição claros, mais dados como complemento. Escolher poucos marcos concretos; não criar uma moeda diferente para cada planeta.
4. Sugestões de marcos sem dependência circular, a validar nas simulações: `marte.0.4` (15 componentes) para engenharia de componentes; `cinturao.0.2` (20 raros) para tecnologias avançadas de mineração; `mercurio.1.1` (5 satélites) para tecnologias solares posteriores; `jupiter.0.4` (30 fusão) para confinamento/reatores avançados; `urano.0.1` (10 criogênicos) para ciência criogênica; `netuno.0.5` (decodificar o sinal) para projetos de fim de jogo. As máquinas e a pesquisa mínima necessárias para cumprir cada marco devem continuar acessíveis antes dele.
5. Complementar alguns objetivos de maior esforço com poucas cartas direcionadas de especialista já recrutado naquele ponto. Priorizar fases cujo único prêmio atual é dado. Definir o orçamento total de cartas antes de escolher valores; como hipótese inicial, limitar o acréscimo da campanha a 10–25% das 181 cartas de baús atuais e medir promoções, ciência e velocidade de produção. Não atribuir como valores aprovados.
6. Preservar descobertas e pesquisa comprada no Colapso; o objetivo de recrutar novamente pode continuar concedendo uma carta. Um save existente que já passou pelo marco deve ganhar a descoberta correspondente por migração idempotente, sem cobrar ou resgatar a recompensa novamente. Confirmar isso ao projetar o novo campo permanente.
7. Explicar cumulatividade nos objetivos. Evitar transformar toda missão em contador que zera quando fica visível: isso adicionaria espera artificial e invalidaria a produção do jogador. Objetivos tardios podem apresentar uma descoberta ou decisão nova em vez de repetir um patamar já atingido.
8. Verificar toda alteração em campanhas normais e focadas em observatórios nos cinco universos, no primeiro e segundo Colapsos, com extensão de horas sem Colapso. Exigir ausência de trancas em energia, combustível, estoques e tecnologias necessárias à própria missão.

## Referências do código atual

- `js/data.js:203` — início das missões da Lua; `js/data.js:252` — Marte; `js/data.js:294` — Cinturão; `js/data.js:418` — Saturno; `js/data.js:449` — Urano; `js/data.js:480` — Netuno.
- `js/data.js:507` — dados/cartas dos baús; `js/data.js:542` — multiplicador de profundidade.
- `js/engine.js:728` — profundidade e metas; `js/engine.js:735` — fontes de progresso; `js/engine.js:766` — três missões ativas; `js/engine.js:767` — recompensas; `js/engine.js:782` — resgate; `js/engine.js:792` — baú e avanço de fase.
- `js/engine.js:813` — recrutamento repetido dá uma carta; `js/engine.js:853` — sorteio de baús; `js/engine.js:914` — fragmento único por expedição/universo.

Este documento analisa conteúdo e relevância das missões. A análise detalhada de exibição/valor creditado/baús/Colapso está a cargo do outro revisor, para evitar duplicação.
