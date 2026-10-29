# Prompt de correções — HELIOS IDLE

> **Aplicado em 29/10/2026.** A implementação, os testes e a comparação antes/depois estão em [CORRECOES-BALANCEAMENTO.md](CORRECOES-BALANCEAMENTO.md).

Preparado em 29/10/2026 após verificar o commit local `9e80c56` e repetir as simulações. Este arquivo é uma instrução para uma futura implementação. **As correções descritas aqui ainda não foram aplicadas.**

Copie a partir de “Tarefa” para o agente que fará a implementação.

---

## Tarefa

Implemente as correções de balanceamento e recompensas no jogo da pasta `C:\Users\Wamberto\Desktop\HELIOS IDLE`. Trabalhe no projeto existente, em HTML/CSS/JavaScript, preservando a identidade visual, o painel original com panorama e cartões de instalações, o perfil local do comandante e os salvamentos. Mantenha `SHOW_BASE_PANEL = false`.

O objetivo é dar uma função clara às missões, controlar a produção científica e manter a campanha fluida. Faça as alterações, simule a progressão e ajuste os parâmetros até cumprir os critérios abaixo. Entregue código funcional e uma comparação medida de antes/depois.

Leia primeiro `VERIFICACAO-BALANCEAMENTO.md`, os artefatos atuais `artifacts/verificacao-*.json` e `AUDITORIA-BALANCEAMENTO.md`. O relatório antigo contém experimentos descartados e um problema de fragmentos que já foi corrigido. Diferencie diagnóstico histórico de pendência atual.

## 1. Estado confirmado e proteções

- Já existe limite de **um fragmento por expedição em cada universo** para Ruínas e Câmaras: até dois somados. Preserve o limite, a chance das Câmaras, as cartas/dados das repetições, o registro no save e a renovação no Colapso. Não reimplemente nem remova essa correção.
- Energia proporcional à velocidade elevada a 0,3, Forja consumindo três metais e aviso de material disponível em outra região já existem. Não os trate como correções novas.
- A inflação científica continua: Oráculo chega a velocidade ×96; dados recebem velocidade global e rendimento global dos fragmentos. A pesquisa por dados soma 25 nós, 111 níveis e somente 199.973 dados.
- Não existe requisito de missão, descoberta ou região na pesquisa: basta um nível dos nós anteriores e dinheiro.
- Há 164 missões em 21 fases; 152 só concedem dados diretamente. Os totais base são 8.135 dados em missões e 3.570 dados + 181 cartas nos baús.
- No farm legal do Padrão, a árvore termina em 2h11m30s sem Colapso. Após o primeiro Colapso, termina aos 20m04s do universo seguinte. Nesse segundo universo, a recompensa mediana de missão com dados equivale a aproximadamente 1,4 segundo da produção científica recente.
- Nenhum ajuste pode apagar ou reduzir saldo já ganho, pesquisas, cartas, especialistas, fragmentos, perfil ou saves. Regule ganhos e compras futuros. Não publique no GitHub nem faça deploy como parte desta tarefa.

## 2. Prioridade alta: separar a escala científica

Crie parâmetros próprios para produção científica, centralizados em `js/data.js` e usados pelo motor. A regra deve cobrir Observatório e Observatório Profundo. Identifique a saída de dados explicitamente: o Laboratório de Anomalia também pertence à categoria `research`, mas produz matéria exótica e precisa conservar sua cadeia industrial.

Requisitos:

- Oráculo continua automatizando e melhorando observatórios. Comprima sua curva científica nos níveis altos; preserve o começo e justifique a curva final com simulações.
- Retire dos dados a multiplicação integral pelo rendimento industrial dos fragmentos. Se houver bônus científico de prestígio, use crescimento controlado e explícito.
- Reduza a combinação da velocidade científica com os bônus globais. Os mesmos bônus não devem acelerar todos os fatores da ciência de uma vez.
- Preserve os cinco ciclos manuais do recrutamento inicial de Oráculo. Não alongue o ciclo base de 30s para 120s como solução isolada.
- Aplique `dataGain` uma única vez por produção ou prêmio. Ele já é aplicado uma vez no código atual; não introduza uma segunda aplicação.
- Mantenha coerência entre ciclo manual, produção automática, energia, projeções na interface e simulação offline.
- Teste quantidades e níveis diferentes. Aumentar o número de observatórios precisa continuar sendo uma escolha útil, sem voltar a encerrar a progressão permanente em minutos.

Não copie integralmente os pacotes `combinado` ou `gradual` de `tools/propostas-balanceamento.js`: os testes anteriores expuseram esperas em Urano e no Cinturão. Os parâmetros desses pacotes são hipóteses, não valores aprovados.

## 3. Prioridade alta: descobertas das missões liberam pesquisa avançada

Acrescente um conjunto simples de descobertas permanentes, com IDs estáveis, obtidas em objetivos-chave existentes. Dados continuam sendo o custo da pesquisa; o avanço também exige conhecer a tecnologia correspondente. Não crie uma moeda diferente para cada planeta.

Use a tabela como ponto inicial do mapeamento e valide as dependências antes de finalizar:

| Marco existente | Descoberta sugerida | Pesquisa avançada candidata |
|---|---|---|
| `marte.0.4`: produzir 15 componentes | Engenharia de componentes | `ind3`, Linhas de Montagem |
| `cinturao.0.2`: produzir 20 metais raros | Metalurgia de materiais raros | `min4` e posteriormente `min5` |
| `mercurio.1.1`: produzir 5 satélites | Engenharia solar orbital | níveis finais de `en3` |
| `jupiter.0.4`: produzir 30 combustíveis de fusão | Domínio da fusão | `en4` e `en5` |
| `saturno.0.2`: produzir 5 módulos estruturais | Engenharia de grandes estruturas | `ind5` |
| `urano.0.1`: produzir 10 supercondutores | Ciência criogênica | níveis finais de tecnologias coerentes com materiais avançados |
| `netuno.0.5`: decodificar o sinal | Ciência da anomalia | projeto opcional de fim de jogo |

Evite criar um nó novo apenas para preencher a tabela. Escolha os níveis afetados conforme o conteúdo já existente e documente o mapeamento efetivamente implementado.

- Não bloqueie instalações ou a pesquisa mínima necessárias para cumprir o próprio marco. Primeiras pesquisas de mineração, indústria, energia e armazenamento ficam disponíveis antes da missão lunar de pesquisar uma vez.
- Não condicione a primeira rota a uma entrega que já exige essa rota; não condicione geração básica à conclusão de um objetivo de energia.
- O bloqueio deve ser validado no motor, com motivo claro na interface. Esconder o botão não é suficiente.
- Descobertas sobrevivem ao Colapso. Uma missão repetida não concede novamente um desbloqueio permanente já possuído.
- Acrescente o novo tipo de recompensa à prévia, resgate, serialização, importação, validação e liquidação do Colapso. Hoje `E.doCollapse` copia explicitamente apenas `data/spec/cards/frags` das missões pendentes; um campo novo não pode ficar esquecido.

## 4. Prioridade alta: recompensas com utilidade por fase

Preserve os recrutamentos e os recursos de apoio do começo da Lua. Revise principalmente Cinturão, Saturno, Urano e Netuno, onde todas as recompensas diretas hoje são dados.

- Cada fase depois do tutorial deve destacar ao menos um prêmio funcional: descoberta, projeto, cartas direcionadas ou suprimentos úteis para o próximo passo. Considere também o baú e os desbloqueios já existentes ao avaliar a fase; não adicione prêmio redundante só para cumprir uma contagem.
- Mantenha dados como complemento previsível. Não multiplique todos os prêmios pela taxa atual dos observatórios, pelo saldo do jogador ou por tempo ausente: isso premia a própria inflação.
- Use cartas direcionadas em poucos objetivos importantes, priorizando especialistas já recrutados e com função naquele setor. Hoje `E.addCards` pode recrutar alguém com a primeira carta: não use isso para antecipar involuntariamente recrutamentos narrativos.
- Defina um orçamento total antes de distribuir cartas. Como hipótese inicial de teste, o acréscimo pode ficar entre 18 e 45 cartas na campanha, aproximadamente 10–25% das 181 cartas base dos baús. Esses valores precisam de validação; evite concentrar o orçamento em Oráculo e recriar a inflação científica.
- Objetivos que gastam matéria exótica, montam estruturas ou resolvem a anomalia devem comunicar o avanço funcional concedido. Uma tarefa longa não deve terminar apenas em um valor insignificante de dados.
- Preserve o limite de três missões ativas e os IDs atuais. Os saves usam `regiao.fase.indice`; não reordene listas sem migração explícita.
- Preserve o progresso cumulativo. Explique “produzido neste universo” ou “total pesquisado”, conforme o contador. Não zere todos os objetivos quando ficam visíveis para criar espera artificial.
- Nos universos seguintes, trate marcos permanentes como já conhecidos; recompensas repetidas devem ter descrição adequada, sem anunciar um desbloqueio novo que já existe.

Entregue uma tabela das recompensas alteradas com ID, objetivo, valor anterior, valor novo, motivo e efeito esperado sobre a próxima etapa.

## 5. Prioridade alta: corrigir crédito e apresentação dos prêmios

### Prévia única no motor

Crie ou centralize uma função de prévia sem efeitos colaterais, usada pela interface e compatível com o resgate real. Ela não pode gastar recursos, consumir RNG nem marcar recompensas como recebidas.

- Missões/diretrizes: mostrar o valor efetivo com `Math.round(base × dataGain)`. Atualmente uma missão anuncia 100 e paga 130 com Oráculo 3.
- Recrutamento: mostrar “Recrutar Íris” quando ausente e “+1 carta de Íris” quando já recrutada. O resultado da ação deve informar a carta realmente creditada em `got.cards`.
- Expedições: respeitar `expReward`, `dataGain` e a mesma ordem de arredondamento do motor. O valor garantido hoje omite `dataGain`; os bônus opcionais omitem ambos. Apresentar chances como chances, sem revelar o resultado oculto sorteado.
- Fragmentos: mostrar o limite restante por expedição/universo. Uma prévia não pode consumir a descoberta. Não mudar a chance das Câmaras por atualizar a tela.
- Atualizar a prévia quando especialistas, pesquisa, universo ou flags mudarem. A tela não pode manter um prêmio desatualizado por causa do cache de renderização.

### Diretrizes no Colapso

Inclua diretrizes concluídas e não resgatadas em `E.collapsePending`, na prévia do Colapso e na liquidação permanente antes de substituir `run`.

- Resgate exatamente uma vez. Não pague diretrizes incompletas nem aquelas já resgatadas.
- Caso reproduzível atual: no Padrão, deixar as três diretrizes prontas sem resgatar perde 400 dados base e um fragmento em comparação ao resgate manual antes do Colapso.
- Defina uma ordem consistente de liquidação. Não permita que a recompensa de uma diretriz crie outra pendência, cuja resolução dependa da ordem acidental dos loops.
- Preserve o tratamento correto de missões, expedições e baús que já existe. A prévia deve distinguir ganhos permanentes de estoques/cargas locais que reiniciam.

### Recompensa material com estoque cheio

Corrija o descarte silencioso: a missão `lua.0.0` anuncia dez metais, mas hoje entrega zero se o estoque estiver cheio e fica marcada como resgatada.

Use a menor solução coerente com o jogo: prévia explícita do que cabe com uma ação segura para adiar a coleta, ou suprimento pendente recuperável. Se usar pendência, persista o saldo, permita coleta parcial e impeça duplicação por clique repetido, recarregamento, importação ou troca de aba. Não bloqueie silenciosamente toda a progressão de fases por falta de espaço e não transforme a pendência em estoque de capacidade infinita. Explique o destino de material local pendente no Colapso.

## 6. Prioridade média: cartas sem uso e excesso de dados

- Para baús novos, priorize especialistas possuídos que ainda podem evoluir, preservando o peso regional e a raridade. Não recrute especialistas bloqueados via sorteio sem uma regra explícita de desbloqueio.
- Preserve o conteúdo dos baús já gerados; não permita trocar o resultado fechando/reabrindo, importando ou atualizando a tela.
- Defina um destino limitado e útil quando todos os elegíveis estiverem no máximo. Não converta automaticamente todas as duplicatas em dados ou fragmentos, pois isso amplia as moedas já inflacionadas. Preserve cartas antigas.
- Reconheça o limite de conteúdo: pesquisa e promoções têm gastos finitos. Atingir todos os tetos continuará gerando excedente mesmo depois de reduzir taxas.
- Se implementar um destino recorrente para dados, use projetos opcionais, com custo crescente, efeito limitado e benefício que não aumente a própria ciência nem conceda fragmentos repetíveis. Não faça essa compra ser requisito para avançar. Separe a validação desse sistema da correção de taxas, para não esconder produção inflacionada atrás de um gasto artificial.
- Não altere o momento de cálculo dos baús por acidente: hoje cartas são sorteadas na geração e o bônus de dados é aplicado na abertura. Se decidir mudar essa regra, descreva-a e migre baús antigos sem perda.

## 7. Prioridade média: preservar insumos de melhorias

A redução de ciência não pode deixar a campanha esperando indefinidamente por um insumo que a própria máquina consome. O ensaio anterior de Urano mostrou raros importados sendo consumidos pelo Criogênico enquanto sua melhoria precisava dos mesmos raros.

Implemente uma forma explícita de reservar material para uma melhoria/projeto, ou uma ação para pausar consumidores até juntar o custo. Reaproveite o sistema de projetos se ele permitir a solução com menos complexidade.

- A reserva precisa ser compreensível e cancelável; material reservado não pode ser consumido, exportado ou transportado indevidamente.
- Uma fila de melhoria não pode melhorar sem pagar nem gastar o mesmo estoque duas vezes.
- Teste energia/ligas no Cinturão do Congelado e raros/supercondutores em Urano.
- Não é necessário adicionar consumo operacional de fusão aos reatores nesta correção. Isso exige uma análise própria para evitar falta de energia impedindo produzir o combustível da própria energia.

## 8. Migração e compatibilidade

- Novos campos devem ter valores padrão seguros e validação. Rejeite tipos inválidos e IDs desconhecidos sem causar exceções ou aceitar ganhos arbitrários.
- Deduzir descobertas de missões/fases já concluídas precisa ser idempotente: carregar um save várias vezes não entrega novamente dados ou cartas.
- Um save com Colapso anterior já passou pela campanha completa; use esse histórico comprovado para reconhecer marcos existentes. Para um save sem Colapso, use missões/fases realmente concluídas e a pesquisa já comprada. Não libere tudo só porque há saldo alto.
- Nunca retire tecnologias já compradas nem seus efeitos por falta de um novo campo. Garanta compatibilidade com os níveis atuais e documente as descobertas reconhecidas na migração.
- Preserve perfil local, pasta de saves opcional, importação/exportação, tempo offline e regra de uma aba gravadora.
- Não use nem substitua o save pessoal do usuário para testar.

## 9. Validação obrigatória

Use o motor real e ações legais nas campanhas. Fixtures com energia, dinheiro ou suprimentos fornecidos servem para isolar fórmulas, e devem ser identificadas como controladas. Não apresente essas fixtures como tempo para adquirir a instalação.

Execute os testes existentes adequados à mudança:

```powershell
node tools/regress.js
node tools/profile-test.js
node tools/folder-save-test.js
node tools/verificar-recompensas-missoes.js
node tools/verificar-balanceamento.js
```

Adapte a instrumentação dos scripts quando uma refatoração mudar o motor. Não altere o bot para obter recursos gratuitos, ignorar requisitos ou mascarar gargalos. Ele pode aprender a usar uma reserva/pausa que também esteja disponível ao jogador.

- Matriz: cinco universos × estratégia normal/farm × duas campanhas = 20 campanhas até disponibilidade de Colapso. Acrescente extensões sem Colapso e cenários offline reais de oito horas.
- Compare o mesmo universo, estratégia e estágio. Os destinos posteriores podem mudar com o RNG; fixe destinos/sementes quando precisar isolar o efeito de um parâmetro.
- Registre tempo até Oráculo e primeiro/segundo Colapso, pesquisa em 25/50/75/100%, proporção pesquisada, saldo, origens/gastos de dados, promoções e bloqueios por energia/insumos. Conte descobertas separadamente do gasto de pesquisa.
- Meça o valor das missões ao recebê-las: cartas/desbloqueios e equivalência dos dados com produção científica real recente. Não basta afirmar que aumentou a recompensa.
- Feche a contabilidade: inicial + entradas − gastos = saldo, com tolerância numérica documentada. Exija recursos finitos e não negativos.
- Verifique preview versus resgate com e sem Oráculo/Telemetria, recrutamento novo/repetido, baú com especialistas máximos, armazenamento cheio e coleta parcial.
- Verifique Colapso com diretriz completa, incompleta e já resgatada, além de descobertas novas pendentes. Salvar/carregar ou clicar duas vezes não pode duplicar prêmios.
- Verifique descobertas antes/depois do marco, herança após Colapso, save antigo com pesquisa comprada e save antigo com histórico de Colapso.
- Verifique que o limite já aplicado das ruínas continua funcionando. Testes de expectativa de fragmentos dos relatórios antigos precisam considerar o limite atual; não use a taxa repetível antiga como verdade vigente.
- Faça uma checagem visual da interface das recompensas e bloqueios de pesquisa, em tela larga e estreita, usando estado de teste separado.

## 10. Critérios de conclusão

- As 20 campanhas continuam chegando ao Colapso sem gargalos irresolvidos. Compare durações com o baseline atual; uma demora grande precisa de diagnóstico e correção. Não declare balanceamento aprovado apenas porque o farm ficou mais lento.
- Guardar dados sozinho não permite comprar pesquisas de descobertas ainda não realizadas. A primeira pesquisa e o recrutamento inicial continuam acessíveis.
- A curva científica e os custos finais devem sustentar progressão permanente por vários Colapsos, em vez de repetir o atual término em cerca de vinte minutos do segundo universo. Calibre seletivamente os níveis finais; preserve tecnologias essenciais. Apresente a meta de ritmo escolhida e o resultado medido.
- Missões-chave dão avanço perceptível que os observatórios não fabricam. O orçamento de cartas não dispara as promoções ou a ciência.
- A ausência de oito horas concede progresso consistente com o motor, sem comprar tecnologias nem realizar escolhas de missão automaticamente. Caso os recursos permitam comprar todos os níveis restantes ao voltar, meça e justifique se isso está de acordo com o ritmo definido.
- A interface anuncia o que o motor entrega; não perde prêmios permanentes no Colapso nem recursos materiais silenciosamente.
- Saves existentes conservam o que já conquistaram.

Entregue os arquivos alterados, os testes executados, uma tabela antes/depois das campanhas e das recompensas e um relatório curto dos parâmetros finais e limitações restantes. Atualize a documentação para distinguir resultados atuais dos experimentos históricos. Não afirme que uma proposta está aplicada até que o código tenha sido alterado e validado.
