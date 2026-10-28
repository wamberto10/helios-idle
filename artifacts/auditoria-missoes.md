# Auditoria de missões e economia permanente

Nenhuma alteração aplicada ao jogo. Reproduza com `node tools/auditoria-missoes.js`; dados completos em `auditoria-missoes.json`.

Missões: **164**, em **21 fases**; **8.135 dados base**. **152** missões só recompensam dados. Baús de todas as fases: **3.570 dados base** e **181 cartas**, antes dos multiplicadores. As recompensas diretas adicionais incluem oito recrutamentos, um desbloqueio de expedições e três entregas de recursos. Avançar as fases também abre instalações/regiões e concede baús, portanto as missões continuam relevantes além do dinheiro.

## Orçamento por fase

| Região | Fase | Missões | Dados base | Segundos na base moderada | Outras recompensas diretas |
|---|---|---:|---:|---:|---|
| Lua | Pouso | 4 | 20 | 9,62 | res:2, spec:1 |
| Lua | Posto de Extração | 8 | 80 | 37,86 | spec:1, res:1 |
| Lua | Complexo Industrial | 8 | 100 | 46,57 | spec:1 |
| Lua | Base Orbital | 8 | 140 | 65,2 | unlock:1, spec:1 |
| Marte | Cabeça de Ponte | 8 | 140 | 65,2 | spec:1 |
| Marte | Forjas Vermelhas | 8 | 210 | 98,56 | — |
| Marte | Estaleiros de Marte | 8 | 255 | 119,89 | — |
| Cinturão de Asteroides | Fronteira de Rocha | 8 | 245 | 115,38 | — |
| Cinturão de Asteroides | Rede Logística | 8 | 295 | 138,82 | — |
| Mercúrio | Margem do Sol | 8 | 285 | 132,81 | spec:1 |
| Mercúrio | Fundação do Enxame | 8 | 375 | 175,48 | — |
| Vênus | Céus Ácidos | 8 | 355 | 166,47 | spec:1 |
| Vênus | Cidades Flutuantes | 8 | 455 | 213,64 | — |
| Júpiter | Gigante Gasoso | 8 | 425 | 199,82 | spec:1 |
| Júpiter | Forja de Fusão | 8 | 535 | 250 | — |
| Saturno | Anéis de Gelo | 8 | 565 | 264,42 | — |
| Saturno | Grandes Estaleiros | 8 | 615 | 288,46 | — |
| Urano | Gelo Profundo | 8 | 645 | 302,88 | — |
| Urano | Laboratórios Criogênicos | 8 | 695 | 326,32 | — |
| Netuno | Sinal Fantasma | 8 | 740 | 346,15 | — |
| Netuno | A Anomalia | 8 | 960 | 449,82 | — |

## Produção controlada por oito horas

| Cenário | Observatórios | Nível | Oráculo | Dados/h | Dados/8h |
|---|---:|---:|---:|---:|---:|
| recem-automatizado | 1 | 1 | 1 | 264 | 2.112 |
| base-moderada | 4 | 3 | 3 | 11.980,8 | 95.846,4 |
| base-avancada-controlada | 8 | 8 | 5 | 1.073.088 | 8.584.704 |

Cenários plausíveis controlados; não representam níveis atingidos em tempo medido de campanha. Todos usam o motor real por oito horas, com energia suficiente e nenhum gasto de dados. A base moderada usa Telemetria Profunda 2; a avançada usa Telemetria 5, Eco Industrial 2, Eco 1 e 100 fragmentos totais. A tabela completa dos bônus está no JSON.

Gastos permanentes máximos: **199.973** dados em pesquisa + **1.781.450** em onze especialistas = **1.981.423**. Promoções também dependem de cartas. Depois desses tetos, o sumidouro permanente de dados termina.

## Farm de ruínas

- reliquia1-duas-sondas: 48 Ruínas + 36 Câmaras em oito horas ativas; **57 fragmentos**, rendimento global **×2,2 → ×3,91**, nenhum novo Colapso.
- pesquisas-maximas-e-reliquia10: 182 Ruínas + 137 Câmaras em oito horas ativas; **218 fragmentos**, rendimento global **×2,2 → ×8,74**, nenhum novo Colapso.

O multiplicador de recompensa NÃO escala fragmentos: 1 continua 1. O problema é a repetição sem novo Colapso somada ao ganho permanente de fragsTotal. O teste máximo usa duas sondas resgatadas e relançadas de imediato, Relíquia 10, pesquisas e universo Ancestral. Ambos começam após um Colapso anterior e com 40 fragmentos iniciais; não medem o tempo para atingir os níveis máximos. Ausência real de oito horas só completa as duas expedições lançadas; não há relançamento automático.

## Problemas e propostas

- **P1 — fragments-without-collapse:** Ruínas Precursoras é repetível e dá1fragmento garantido semColapso; Câmaras dáchance0,3de1. Ambos aumentam fragsTotal e rendimento global permanente, além de serem moeda gastável. Proposta: Vincular a primeira recompensa de fragmento à descoberta única por universo/Colapso; repetições dão cartas e outro ganho limitado. Se quiser farm infinito, orçamento explícito por sessão/dia com retorno decrescente e sem aumentar fragsTotal de rendimento. Não remover a recompensa inicial de Relíquia.
- **P1 — finite-permanent-sinks:** Dados crescem continuamente e também recebem globalYield de todos os fragmentos; pesquisa e promoção têm tetos finitos permanentes e não reiniciam. O saldo sobra inevitavelmente depois dos tetos. Proposta: Separar ciência de execução por universo e conhecimento permanente; ou adicionar uma pesquisa contínua controlada com retornos decrescentes. Preservar ritmo acelerado de construção e automação, sem simplesmente multiplicar todos os custos.
- **P1 — research-not-tied-to-technology:** Uma única compra no pré-requisito libera pesquisa avançada e não há condição de planeta/fase. Recursos sobrando permitem saltar árvore ainda naLua. Proposta: Usar marcos tecnológicos concretos para abrir ramos: primeiro componente/raros/fusão/criogenia, com pré-requisito de nível apropriado. Nunca travar min1/en1 até uma missão que já exige uma pesquisa; manter pesquisa inicial acessível pelo orçamento daLua.
- **P2 — mission-cash-devaluation:** A maioria das missões só entrega dados; a recompensa equivale a poucos segundos quando a base cresce. Mesmo assim missões continuam necessárias para fase/região/baú; não são removíveis sem redesenhar progressão. Proposta: Transformar objetivos-chave em desbloqueio de tecnologia/projeto, cartas direcionadas e avanço de exploração. Manter dados como ajuda previsível para próximo passo, não escalar recompensa automaticamente pela maior taxa atual que pode realimentar inflação.
- **P2 — free-fusion-reactors:** Reator usa fusão só na compra; depois gera energia sem combustível. Produção de fusão tem apenas um consumidor cíclico (laboratório emNetuno). Proposta: Adicionar consumo operacional leve e reserva/partida de emergência, ou outros sumidouros úteis de fusão. Nunca permitir que falta de fusão paralise o único produtor do próprio combustível ou impeça relançar logística.
- **P2 — storage-export-and-uncapped-value:** EXP evita perda de produção com estoque cheio e continua aumentando o valor paraColapso, mas não rende dados pois exportRate=0. Armazenamento passa a importar mais para compras/reservas do que para produção contínua. Proposta: PreservarEXP como válvula de produção e usar armazenagem em reservas/descarga/projetos; não reativar exportação emdados antes de corrigir inflação de pesquisa. Combustível de rotas já escala com sqrt(capacidade/20), portanto não alegar custo fixo porviagem.

## Limite do balanço anterior

BALANCO.md chamou dados de bem equilibrados usando campanha ativa até o primeiro Colapso (e depois cronometrou o segundo). Não avaliou deixar observatórios por 8 horas, completar gastos permanentes ou farm ativo de fragmentos em ruínas. Essa conclusão não pode ser estendida a esses horizontes.

Também corrigir qualquer referência antiga a combustível fixo de cargueiro: hoje ele escala pela raiz quadrada da capacidade. Esta auditoria não mede automaticamente campanhas de 5/10 Colapsos; as fórmulas e os limites permanentes estão separados do tempo real de campanha.
