# HELIOS IDLE — auditoria de ciência, missões e economia permanente

Data: 28/10/2026. Estado: diagnóstico e propostas; **nenhum valor do jogo foi alterado**. Os scripts desta auditoria usam cópias do motor em memória e não leem salvamentos pessoais.

## Conclusão

O excesso relatado foi reproduzido por uma estratégia que compra instalações, melhorias, tecnologias e promoções com recursos obtidos durante a campanha. Não depende de ferramentas de desenvolvimento nem de um erro de duplicação de dados.

A produção automática cresce por quantidade, nível, velocidade de Oráculo, Telemetria, velocidade global e rendimento dos fragmentos. Os gastos em pesquisa são finitos, permanentes e baratos diante de algumas horas dessa produção. Além disso, as tecnologias avançadas não exigem descobertas dos planetas a que se referem. As missões ainda controlam a abertura de regiões, mas sua recompensa monetária perde valor.

**A recomendação principal é separar a escala da ciência da escala industrial e vincular pesquisa avançada a descobertas das missões. Aumentar todos os custos ou alongar todos os ciclos, isoladamente, não resolve o conjunto.**

## Como foi simulado

- Motor atual de `js/engine.js` e dados de `js/data.js`, carregados em VM. O bot original toma ações a cada dois segundos de jogo.
- Seis cenários de campanha: os cinco universos com o bot normal e o Padrão com uma estratégia de farm. Cada cenário chega à disponibilidade de dois Colapsos: **12 campanhas**, todas concluídas.
- Em cada cenário, dois ramos independentes continuam quatro horas sem reiniciar: um antes do primeiro Colapso, outro após a segunda campanha. Total dessa medição: **64,06 horas de jogo**.
- A estratégia de farm busca até 10 observatórios de nível 5 na Lua e 10 em Marte, depois de recrutar Oráculo. Usa os custos e ações normais. Também compra pesquisas assim que pode. Portanto a comparação mede o pacote de decisões, não apenas o efeito isolado de construir observatórios.
- Ensaios separados medem 64 combinações de quantidade, nível e Oráculo, mais produção de oito horas e compras de pesquisa. Nesses ensaios, energia e suprimentos são garantidos artificialmente: **não representam o tempo para montar aquela base**.
- Entradas de dados foram separadas em missões, baús, expedições, diretrizes, observatórios comuns e profundos. Saídas: tecnologias e promoções. A reconciliação de dados fecha em todos os cenários, com erro arredondado de 0.
- Testes de propostas são experimentos em memória, não alterações aprovadas. Dois pacotes foram avaliados também nos cinco universos para procurar regressões.

## 1. A árvore fica pequena diante do farm

As cinco árvores que usam dados possuem **25 tecnologias, 111 níveis e custo total de 199.973 dados**. A árvore de Singularidade é separada: sete tecnologias, 21 níveis e 180 fragmentos.

| Ramo por dados | Custo de todos os níveis |
|---|---:|
| Mineração | 23.162 |
| Indústria | 37.046 |
| Energia | 100.525 |
| Logística | 16.884 |
| Exploração | 22.356 |
| **Total** | **199.973** |

Os 2,63 milhões da imagem equivalem a aproximadamente **13,15 árvores completas**, além das tecnologias já compradas. Saldo de zero fragmentos na carteira não comprova ausência de Colapsos: o rendimento considera `fragsTotal`, inclusive fragmentos já gastos. A auditoria não presume o histórico do salvamento da imagem.

### Campanhas com ações normais

Percentuais abaixo são a proporção dos **111 níveis de pesquisa por dados**, não a proporção do orçamento gasto.

| Estratégia no primeiro universo Padrão | Primeiro Colapso disponível | Pesquisa nesse momento | Participação das missões nos dados ganhos | Participação dos observatórios comuns e profundos |
|---|---:|---:|---:|---:|
| Bot normal, orientado às missões | 1h22m14s | 62,2% | 42,1% | 31,9% |
| Farm legal + compra imediata de pesquisa | 1h00m40s | 83,8% | 17,7% | 71,5% |

- Sem fazer o primeiro Colapso, o farm termina **111/111 níveis aos 2h11m30s desde o início**, com Oráculo nível 3 e nenhum fragmento total.
- No ramo que faz o Colapso assim que disponível e segue para o Congelado, a pesquisa termina **20m04s depois do reinício**. O segundo Colapso fica disponível aos 30m42s desse universo.
- Nesse segundo universo, o farm termina a campanha com 106,9 mil dados sobrando; quatro horas depois tem **3,03 milhões**.
- O bot normal também chega a 95,5–99,1% dos níveis após ficar quatro horas além do primeiro Colapso disponível. Ele costuma demorar a última compra porque reserva duas vezes o custo da próxima tecnologia e promove especialistas automaticamente. Isso é uma decisão do bot, não uma exigência do jogo.

### Demais universos, sem farm deliberado

| Universo inicial | Primeiro Colapso disponível | Níveis de pesquisa por dados comprados |
|---|---:|---:|
| Padrão | 82,2 min | 62,2% |
| Abundante | 126,9 min | 76,6% |
| Energético | 123,7 min | 73,9% |
| Congelado | 165,4 min | 77,5% |
| Ancestral | 171,1 min | 82,0% |

Os tempos representam um jogador muito ativo, executando decisões instantâneas. São úteis para comparar estratégias; não são previsão do tempo de uma pessoa. O segundo destino é o primeiro oferecido pelo motor e pode diferir entre cenários.

## 2. O que faz os dados dispararem

Não foi encontrada duplicação de `dataGain`: o motor aplica esse bônus uma vez por produção manual ou automática. A inflação vem da composição das regras existentes.

Para um observatório comum, sem gargalo de energia:

`dados/s = quantidade × [1 + 0,5 × (nível − 1)] × velocidade de Oráculo × velocidade global × rendimento global × bônus de dados ÷ 30`

- Oráculo nível 1 dá velocidade ×2; no nível 10 chega a ×96, além de multiplicar os dados de todas as fontes por ×2.
- A melhoria da máquina chega a rendimento ×13 no nível 25.
- Telemetria V dá ×1,5 dados.
- Cada fragmento já recebido dá +3% de rendimento, inclusive para dados. A velocidade global também acelera os observatórios.
- O observatório comum não consome materiais durante a operação. O profundo consome supercondutores, mas sua produção base é 12 vezes maior.

### Produção isolada real durante oito horas

Energia suficiente, sem compras durante o período. Esses ensaios fixam a instalação inicial para medir sua escala; o custo de atingi-la é uma medição separada.

| Base controlada em uma região | Dados/s | Dados em 8h |
|---|---:|---:|
| 1 observatório Nv.1, Oráculo 1, sem pesquisa/prestígio | 0,0733 | 2.112 |
| 5 observatórios Nv.5, Oráculo 3, sem pesquisa/prestígio | 5,2 | 149.760 |
| 10 observatórios Nv.5, Oráculo 3, sem pesquisa/prestígio | 10,4 | 299.520 |
| Os mesmos 10, com Telemetria V | 15,6 | 449.280 |
| 10 observatórios Nv.10, Oráculo 5 e Telemetria V | 66 | 1.900.800 |

Dez observatórios Nv.5 custam, antes de redutores, 8.003 metais, 2.719 ligas e 140 componentes para construir e melhorar; geração e armazenamento são custos adicionais. A campanha de farm confirma que uma estratégia normal consegue montar esse conjunto, sem assumir que ele exista no início.

## 3. Por que as missões parecem irrelevantes

Há **164 missões em 21 fases**. **152 recompensam diretamente apenas dados**. Todas juntas entregam 8.135 dados base; os baús das fases acrescentam 3.570 dados base e 181 cartas antes dos multiplicadores e regras de distribuição.

Uma missão com recompensa base de 100 dados, com Oráculo 3, entrega 130 dados. Dez observatórios Nv.5 com esse Oráculo produzem os mesmos 130 em **12,5 segundos**. Telemetria multiplica tanto a missão quanto a produção: não corrige essa relação.

As missões continuam necessárias para abrir fases, instalações, expedições e regiões; também garantem recrutamentos e baús. A perda de valor está sobretudo na recompensa em dados e na falta de novos motivos para pesquisar depois de atingir os tetos.

Outro limite estrutural: pesquisa por dados custa 199.973, e promover os onze especialistas de nível 1 a 10 custa mais 1.781.450 dados, além das cartas. Os **1.981.423 dados de gastos permanentes totais são finitos**, enquanto a produção continua indefinidamente. Atingidos os tetos, a moeda acumula sem destino.

## 4. Problemas semelhantes encontrados

### Fragmentos repetíveis no Ancestral — prioridade alta

Ruínas Precursoras dá um fragmento garantido por conclusão; Câmaras do Guardião tem chance de fragmento. São repetíveis sem outro Colapso. Esses ganhos também aumentam o rendimento global permanente via `fragsTotal`.

Em ensaio isolado com combustível suficiente, duas sondas continuamente resgatadas e relançadas, após um Colapso anterior:

- Relíquia 1: 57 fragmentos em oito horas ativas; o rendimento global vai de ×2,2 para ×3,91.
- Relíquia 10 e pesquisas máximas: 218 fragmentos em oito horas ativas; vai de ×2,2 para ×8,74.

Os níveis e suprimentos são condições do ensaio, não níveis conquistados em oito horas. **Isso exige interação**: na ausência, as duas expedições lançadas só completam uma vez. O bônus de recompensa não multiplica a quantidade de fragmentos; a repetição é que causa o ganho.

Proposta: fragmentos de descoberta apenas na primeira conclusão por universo; repetições mantêm cartas e dados. Preservar os fragmentos já ganhos.

### Reserva de insumos para melhorias — prioridade alta

Um teste de redução de ciência/custos expôs uma espera em Urano: o processador criogênico consome os metais raros importados, mantendo o estoque em zero, enquanto a missão exige melhorar a própria instalação até Nv.4. Há energia sobrando; a falta é de material reservado para a compra.

Isso não é uma impossibilidade para o jogador: pausar a instalação permite juntar o material. É um gargalo que o bot atual não resolve e que a interface poderia explicar melhor. A sugestão é **reservar material para uma melhoria/projeto**, ou oferecer uma ação explícita para pausar consumidores até atingir a reserva, sem aumentar artificialmente a produção.

Outro teste expôs no Congelado um gargalo de energia e ligas no Cinturão. Essa dependência impede aprovar um nerf amplo apenas por funcionar na estratégia que farma dados.

### Energia de fusão sem custo operacional — prioridade média

O reator usa combustível de fusão na construção e depois gera energia sem consumi-lo. O único consumidor cíclico de fusão é o Laboratório de Anomalia. Isso reduz a utilidade dessa cadeia após a instalação dos geradores.

Proposta posterior: manutenção leve de fusão ou projetos que consumam o excedente, com reserva e geração de emergência. Evitar uma cadeia em que a falta de combustível impeça produzir o próprio combustível.

### Exportação e armazenamento — prioridade média

EXP mantém a produção com estoque cheio e aumenta o valor produzido usado no Colapso, mas **não gera dados hoje**, porque `exportRate = 0`. Não é a causa direta da tela de pesquisa concluída.

Armazenamento perde parte da pressão quando a exportação está ligada. Reservas para melhorias, descarga e projetos dão utilidade a ele. Não recomendo reativar conversão de excedente em dados antes de corrigir a ciência. O combustível das rotas já escala com a raiz da capacidade; a descrição antiga de custo fixo por viagem está desatualizada.

## 5. O que foi testado como ajuste

### Alongar o observatório de 30s para 120s

Divide sua produção por quatro, mas também aumenta o recrutamento inicial de Oráculo: cinco ciclos passam de 150s para 600s, antes de outros efeitos. No ensaio herdado com 100 fragmentos totais, ainda é possível terminar a pesquisa restante em cerca de 34 minutos. Isso atrasa o começo sem resolver a escala permanente.

**Não recomendado como solução isolada.**

### Redução de ciência + aumento amplo de custos

Um experimento só para dados comprime a velocidade científica de Oráculo para ×2…×12, reduz a participação da velocidade global, separa dados do rendimento de fragmentos e torna os últimos nós mais caros. O Laboratório de Anomalia foi preservado, porque também pertence à categoria de pesquisa, mas produz matéria exótica.

Em uma versão agressiva de custos (orçamento de 981.580 dados), o farm fica em 82,9% dos níveis quatro horas após o primeiro Colapso disponível, contra 100% no jogo atual. Porém, com o bot normal, duas das cinco campanhas não chegam ao Colapso no limite de seis horas: Padrão e Ancestral. O diagnóstico de Padrão mostra a reserva de raros em Urano descrita acima.

Parâmetros desse experimento: velocidade científica por nível de Oráculo `2; 2,5; 3; 4; 5; 6; 7,5; 9; 10,5; 12`; rendimento de dados por nível da instalação `1 + 0,2 × (nível − 1)`; velocidade global aplicada por raiz quadrada; rendimento de fragmentos removido apenas dos dados. Custos dos nós nas cinco posições de cada ramo multiplicados por `1; 1; 2; 4; 8`. O multiplicador `dataGain` e os custos de promoção de especialistas permaneceram originais.

Uma versão mais gradual, que preserva o custo inicial de cada nó e aumenta a progressão de preços dos níveis seguintes, tem orçamento de 355.647. Quatro dos cinco universos concluem; o Congelado expõe o gargalo do Cinturão. No Padrão, o tempo do bot sobe de 82,2 para 162,4 minutos.

Na versão gradual, a curva científica é `2; 3; 4; 5; 6; 7; 8; 9; 10; 12`, o rendimento de nível da instalação permanece original e os custos iniciais de cada nó são preservados. A razão de crescimento dos preços passa a pelo menos 2,8 nos nós com mais de três níveis e a pelo menos 3 nos demais. Os dois ensaios deixam todos os parâmetros do jogo real intactos.

**Os números desses pacotes não estão aprovados para aplicação.** Eles comprovam a necessidade de proteger tecnologias essenciais, promoções iniciais e logística. Uma alternativa que só parece boa no farm pode deixar a estratégia normal muito mais lenta.

Os destinos do segundo universo diferem entre alguns pacotes, portanto a comparação principal usa o mesmo primeiro universo Padrão. Valores após o segundo ciclo são diagnósticos, não um experimento que isola só uma variável.

## 6. Ajustes recomendados, em ordem

1. **Dar escala própria à ciência.** Oráculo continua automatizando e melhorando a produção, mas observatórios não recebem a curva industrial inteira ×96 nem todo o rendimento herdado de fragmentos. Preservar os primeiros níveis e os cinco ciclos que recrutam Oráculo. Aplicar a regra aos dois tipos de observatório; preservar a produção de matéria exótica.
2. **Fazer descobertas abrirem tecnologia avançada.** Primeiros componentes em Marte, raros no Cinturão, fusão em Júpiter e supercondutores em Urano podem conceder projetos/patentes. Dados continuam pagando pesquisas, mas dinheiro sozinho não pula todo o desenvolvimento. Guardar descobertas permanentes para que o Colapso não retire desbloqueios já conquistados. Manter as primeiras pesquisas da Lua acessíveis antes da missão que exige pesquisar.
3. **Mudar recompensas de objetivos-chave.** Conclusões de fase e missões importantes devem dar projetos, cartas direcionadas ou funções novas, além de dados. O jogador ganha algo que os observatórios não fabricam. Evitar converter todas as recompensas em mais dados ou escalá-las automaticamente pela maior taxa de farm.
4. **Revisar custos por tecnologia, preservando as essenciais.** Melhorias finais podem custar mais; mineração, energia e logística necessárias para desbloquear os próximos planetas precisam manter uma faixa acessível. Não aplicar os multiplicadores experimentais globalmente.
5. **Oferecer uso contínuo e controlado para dados excedentes.** Depois de concluir a árvore fixa, projetos opcionais por universo ou pesquisa recorrente com custo crescente e retorno decrescente. Evitar que o prêmio recorrente aumente a própria produção de dados e reabra a inflação. Projetos não devem ser obrigatórios para continuar a campanha.
6. **Fechar o farm de fragmentos e melhorar reservas.** Limitar a recompensa de descoberta das ruínas por universo, preservando outros prêmios; permitir separar insumos para melhorias. Em seguida, reavaliar combustível de fusão e armazenamento.

### Critérios para aprovar a implementação futura

- Campanhas normais e de farm nos cinco universos continuam chegando ao Colapso.
- Uma ausência de oito horas melhora a base, mas não compra tecnologias de regiões ainda não descobertas.
- Concluir uma fase concede um desbloqueio ou avanço perceptível, além do equivalente a segundos de observatório.
- Ciência não cresce com todos os mesmos multiplicadores da indústria; promoções iniciais e pesquisa básica seguem acessíveis.
- Não apagar dados, pesquisas, especialistas ou fragmentos de salvamentos existentes. Novas regras devem regular os ganhos e compras futuros.

## Reproduzir e consultar dados

```powershell
node tools/simular-campanhas.js
node tools/auditoria-pesquisa.js
node tools/auditoria-missoes.js
node tools/propostas-balanceamento.js combinado baseline all --campaign-only
node tools/propostas-balanceamento.js gradual baseline all --campaign-only
```

- [Campanhas atuais e contabilidade](artifacts/campanhas-balanceamento.json)
- [Estados intermediários das campanhas simuladas](artifacts/campanhas-estados.json)
- [Ensaios de observatórios e pesquisa](artifacts/auditoria-pesquisa.json)
- [Missões, fragmentos, reatores e exportação](artifacts/auditoria-missoes.json)
- [Detalhamento de missões](artifacts/auditoria-missoes.md)
- [Experimento agressivo no Padrão, com diagnóstico de espera](artifacts/proposta-combinado-baseline-campanha.json)
- [Experimento gradual no Congelado, com diagnóstico de espera](artifacts/proposta-gradual-baseline-congelado-campanha.json)

O relatório anterior, `BALANCO.md`, avaliou principalmente a campanha ativa até o primeiro Colapso. Sua conclusão de que dados eram equilibrados **não se mantém** ao testar farm deliberado, ausência longa e esgotamento dos gastos permanentes.
