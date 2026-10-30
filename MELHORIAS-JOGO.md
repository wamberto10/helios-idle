# Melhorias — confiabilidade, celular, progressão e aplicativo

Data: 29/10/2026. Base: commit `058521d` (versão publicada). Nada foi publicado no GitHub nesta etapa.

## Resumo

| Área | O que mudou |
|---|---|
| 1. Salvamento e offline | Ao fechar, ocultar ou transferir a aba, o tempo pendente é contabilizado antes de salvar (antes era descartado). Importar ou restaurar backup credita o tempo desde o horário do arquivo, dentro do limite offline. A revisão do save é conferida mesmo quando a posse entre abas não pode ser gravada. |
| 2. Metas das missões | Título, descrição, barra e conclusão usam a mesma meta efetiva (Colapsos e Atalhos de Missão). As descrições de recrutamento deixaram de ter números fixos. |
| 3. Resgates | Botão “Resgatar concluídas (N)” com resumo único. Prévia recolhível das próximas missões da fase. O gargalo oferece a ação que resolve. |
| 4. Celular | Ordem por prioridade em uma coluna, cabeçalho compacto, seções recolhíveis, alvos de toque de ~44 px, áreas seguras, teclado virtual, rolagem preservada, movimento reduzido do sistema respeitado. |
| 5. Balanceamento | A vantagem do “farm científico” foi reproduzida e diagnosticada: **não vem da ciência**. Nenhum valor econômico foi alterado por esse motivo (ver seção). |
| 6. Recompensas | Cartas para especialista já completo viram suprimentos limitados (mesma regra dos baús), com prévia antes da expedição. Três marcos de escolha industrial/científica/logística valem só no universo atual. |
| 7. Universos | Propostas concretas abaixo, aguardando aprovação (não implementadas). |
| 8. Aplicativo | Integração Capacitor preparada (segundo plano, botão Voltar, espelho nativo do save, pasta distribuída sem dependência de internet) e documentada em [APP-ANDROID.md](APP-ANDROID.md). |

## 1. Salvamento e produção offline

**Problemas confirmados no código:**
- **Fechar ou transferir a aba:** `pagehide` e a transferência entre abas faziam `lastTick = agora` sem simular o tempo pendente. Uma aba suspensa por 1 hora e depois fechada perdia essa hora.
- **Importar ou restaurar backup:** também zerava o tempo, ignorando o horário do arquivo.
- **Falha ao gravar a posse:** quando a aba não conseguia gravar a posse (`noLock`), `session.write` **pulava a verificação de revisão**, e uma aba desatualizada podia sobrescrever progresso mais recente.

**Correções:**
- **`settle()` (`js/main.js`):** ao ocultar, fechar ou transferir, intervalos de até 2 minutos são simulados na hora. Intervalos maiores (aba suspensa) ficam no `lastTick` antigo e são creditados uma única vez ao voltar, como offline, com relatório.
- **`H.replaceState(ns, { offline: true })`:** usado em Importar e na restauração da pasta de saves. Aplica `E.applyOffline` desde o `lastTick` do arquivo (limite offline respeitado; horário no futuro não gera tempo negativo) e registra o intervalo como usado.
- **`js/session.js`:** a revisão é conferida sempre, com ou sem posse gravável. Quando a posse volta a funcionar, a aba a reassume.
- **Teste de aba suspensa:** os ganchos de teste ganharam `suspend()` e `resume()`.
- **Compatibilidade:** saves antigos continuam carregando (sem mudança de formato) e a recuperação de dados inválidos não mudou.

**Regressões novas:**
- **Node:** backup de 3h, backup acima do limite, horário futuro, aba suspensa por 1h e fechada, reabrir sem crédito duplo, duas abas sem posse gravável.
- **Navegador:** 1h suspensa e depois fechada, retomada após 30 min suspensa, backup de 2h restaurado, duas abas com falha na gravação da posse.

## 2. Metas das missões

- **Antes:** `E.mTitle` usava a meta base (`md.n`), enquanto a barra e a conclusão usavam `E.mTarget` (Colapsos ×1,5 cada, até ×4; Atalhos de Missão −20% por nível na Lua e em Marte).
- **Agora:** `E.mTitle(md, S, região)` e `E.mDesc` usam a meta efetiva. Isso vale para os títulos (atualizados a cada quadro), as descrições (`{n}`), a prévia das próximas missões, o relatório offline e a referência das descobertas.
- **Teste:** depois de dois Colapsos, “Produzir 60 minérios” mostra 120 e conclui exatamente em 120.

## 3. Repetição dos resgates

- **`E.claimAll(S, região)`:**
  - Resgata, uma por vez e por `E.claim`, as missões ativas já concluídas, inclusive as que entram prontas depois de um resgate.
  - Não paga projetos e não escolhe benefícios pelo jogador.
  - As mensagens viram um resumo (dados, cartas, descobertas, fases e baús); recrutamentos e conquistas continuam com o próprio aviso.
- **Botão:** aparece no painel de missões com duas ou mais prontas.
- **Próximas nesta fase:** lista recolhível com meta efetiva e ✓ para as que já entram cumpridas.
- **Gargalo atual:** passou a oferecer ação direta.
  - "Ver geradores" (energia).
  - "Ligar EXP" ou "Construir armazém" (estoque cheio).
  - "Operar" (manual).
  - "Planejar rota" ou "Ver instalação" (falta de insumo).

## 4. Experiência no celular

Revisado em 360, 375 e 430 px de largura, no navegador com emulação de tamanho.

- **Prioridade:** até 960 px a tela da região vira uma coluna, nesta ordem: missões → gargalo → suprimentos pendentes → projetos → estoque → energia → instalações → especialistas → diário.
- **Recolhíveis:** especialistas e diário ficam recolhidos no celular; o estado aberto/fechado é preservado nas atualizações.
- **Cabeçalho da região:** de ~220 px para ~96 px; as missões começam em 297 px em vez de 421 px.
- **Toque:** botões, abas e navegação com no mínimo 44 px em telas de toque. O botão EXP tem área de toque ampliada além do desenho. Pausa com 44×44 px. Os alvos abaixo de 44 px na tela da região caíram de 21 para nenhum relevante.
- **Sem depender de passar o mouse:** as explicações importantes estão em texto visível (gargalo, chips de recompensa, motivos de bloqueio da pesquisa).
- **Áreas seguras:** `env(safe-area-inset-*)` no topo, nas laterais, na navegação inferior, nos avisos e no botão de pular animação.
- **Teclado virtual:** `interactive-widget=resizes-content`; a navegação inferior some enquanto um campo de texto está em uso.
- **Atualizações:** preservam o foco (já existia), o texto digitado (já existia), a posição de rolagem e as seções recolhíveis.
- **Movimento reduzido:** `H.reduceMotion()` combina o ajuste do jogo com a preferência do sistema. Vale para o CSS (classe `reduce-motion`), a animação do Colapso, o baú, o mapa e as rolagens automáticas.
- **Rolagem horizontal:** nenhuma em todas as telas a 360, 375 e 430 px; sem erros de JavaScript.

## 5. Balanceamento — reprodução e diagnóstico

Tempos de **bot**, com ações instantâneas a cada 2 s de jogo. Servem para comparar estratégias; uma pessoa leva mais tempo, sobretudo pelas pausas e decisões.

**Reprodução no código atual** (Padrão, mediana de 3 inícios, `node tools/comparar-estrategias.js padrao 2`):

| Estratégia | 1º Colapso | 2º universo | Pesquisa (1º / 2º) |
|---|---:|---:|---:|
| Normal | 109 min | 59 min | 58% / 68% |
| Comprar pesquisa assim que puder | 146 min | 59 min | 64% / 75% |
| 20 observatórios (pesquisa no ritmo normal) | 66 min | 36 min | 68% / 81% |
| Farm (observatórios + pesquisa imediata) | 67 min | 35 min | 71% / 84% |
| Indústria (refino, forjas e fábricas até Nv.5) | 119 min | 59 min | 59% / 68% |
| Energia (geração ≥ 1,5× o consumo) | 128 min | 69 min | 62% / 70% |
| Logística (cargueiros até Nv.5) | 133 min | 74 min | 62% / 72% |
| Expansão (refino, forjas, armazéns, sem observatórios) | 191 min | 64 min | 66% / 73% |

**Diagnóstico:**
1. Comprar pesquisa mais cedo não acelera a campanha (146 min).
2. Com 20 observatórios, aos 60 min os especialistas já estão nos níveis que a estratégia normal só alcança no Colapso. Os dados extras pagam promoções (11,7 mil contra 7,6 mil) e pesquisa (30,5 mil contra 12,7 mil).
3. **Teste decisivo:** com observatórios produzindo praticamente nada (0,001 dado por ciclo), a estratégia de observatórios **continua rápida (81 min)**. A estratégia normal variou entre 74 e 174 min só mudando o instante inicial.
4. Para pagar os observatórios, o bot constrói muito mais refino, forjas, painéis e armazéns na Lua e em Marte (11 armazéns na Lua contra 1). Isso o tira do "modo lento", em que a campanha espera ligas para os estaleiros de Saturno.
5. Encarecer os observatórios (crescimento 1,6 a 2,0) torna essa estratégia **pior** que a normal (122–151 min), um degrau brusco. Rendimento decrescente por quantidade (expoente 0,7 ou 0,8) quase não muda os tempos.

**Conclusão:** a diferença de 169 contra 67 min não mostra que a ciência domina; ela reflete a sensibilidade da logística (ligas para Saturno) às decisões de investimento. Por isso **nenhum valor de ciência foi alterado nesta etapa**. Mudá-los atacaria a causa errada e, nos testes, criou degraus.

**Próximo passo sugerido (não aplicado):** suavizar a cadeia de ligas para Saturno, por exemplo uma forja disponível em Saturno ou ligas no estoque inicial da região. Isso deve reduzir a variância entre estratégias. Precisa de aprovação e de nova rodada de simulações.

**Campanhas antes e depois** (`node tools/verificar-balanceamento.js`; antes = artefatos de `058521d` em `artifacts/antes-melhorias/`):
- As 20 de 20 campanhas chegam ao Colapso nas duas versões, com erro de contabilidade 0.
- O farm ficou estável: 1º Colapso em 63–67 min (antes 64–67) e saldo 4h após o 2º Colapso de 31–42 mil.
- Na estratégia normal, execuções isoladas variam muito, como no diagnóstico: Padrão 169 → 109, Abundante 172 → 216, Energético 76 → 128, Congelado 95 → 95, Ancestral 104 → 89 min. A pesquisa no 1º Colapso ficou em 54–68%.
- Mudanças econômicas desta etapa:
  - os três marcos de escolha (o bot escolhe industrial, +20% de velocidade industrial no universo);
  - as cartas sem uso viram suprimentos;
  - o bot ganhou decisões de logística que um jogador também tomaria.
- A ausência de 8h (`tools/verificar-offline.js`) continua sem compras nem resgates automáticos.

## 6. Recompensas

- **Cartas sem uso:** `E.splitCards` entrega só as cartas que o especialista ainda precisa para chegar ao nível 10. O excedente vira suprimentos (40 metais, 12 ligas e 3 componentes por carta, a mesma regra dos baús), entregues na região, com "aguardando espaço" se o estoque estiver cheio.
  - Vale para expedições, cartas de missão e recrutamento repetido.
  - A prévia da expedição mostra o pacote antes de iniciar ("no lugar de N cartas sem uso").
  - O crédito é igual à prévia (testado).
- **Marcos de escolha:** Rumo da colônia de Marte (`marte.1.7`), Prioridade das cidades de Vênus (`venus.0.7`) e Plano dos anéis de Saturno (`saturno.0.7`).
  - **Opções:** Industrial (+20% de velocidade industrial), Científico (+15% de dados) ou Logístico (+30% de carga e −15% de tempo de viagem).
  - **Duração:** só no universo atual; terminam no Colapso, então não há inflação permanente. É uma escolha por marco por universo.
  - **Interface:** "Resgatar concluídas" não escolhe pelo jogador; a escolha aparece num painel ao resgatar. As escolhas feitas aparecem no painel do universo, na tela Singularidade.

## 7. Identidade dos universos — propostas (não implementadas)

| Universo | Proposta | Decisão que cria | Efeito esperado / como verificar |
|---|---|---|---|
| Padrão | Marco de escolha extra: "Contrato com a Terra" (vender excedente de metal por dados, com teto por universo) | Exportar ou investir localmente | Saldo de dados no 1º Colapso; não pode reabrir a inflação científica (teto) |
| Abundante | Veios que se esgotam: cada extrator rende +60%, mas o bônus cai com a quantidade na mesma região | Espalhar extração entre regiões, mais rotas | Comparar estratégias "logística" × "normal" neste universo |
| Energético | Sobra de energia acelera o enxame de Dyson (contribuição automática limitada) | Gerar energia além do necessário × construir produção | Tempo até 6 etapas do Dyson; estratégia "energia" deve ficar competitiva |
| Congelado | Rotas com gelo não gastam combustível; indústria consome mais energia (já existe) | Logística de gelo × energia | Estratégia "logística" competitiva; esperas por energia no Cinturão |
| Ancestral | Ruínas oferecem uma escolha única por universo: projeto antigo (bônus local) ou dados | Expedições cedo × produção | Tempo de Colapso e uso de expedições; o limite de fragmentos é mantido |

Cada proposta pode ser medida com `tools/comparar-estrategias.js <universo> 2`, que grava `artifacts/comparacao-estrategias-<universo>.json`.

## 8. Aplicativo (Capacitor)

Detalhes em [APP-ANDROID.md](APP-ANDROID.md).

- **`js/app-bridge.js`:** não faz nada na web. No aplicativo cuida do segundo plano (salva ao sair e aplica o offline ao voltar), do botão Voltar e do espelho do save no armazenamento nativo (restaura só se for mais novo e válido, guardando o anterior).
- **`tools/preparar-app.js`:** monta `app/www` com 61 arquivos (104 MB), sem Google Fonts. A fonte local é opcional.
- **Configuração:** `app/capacitor.config.json` e `app/package.json`.
- **Teste:** `tools/app-bridge-test.js` simula o Capacitor (13 verificações).

## Arquivos

- **Modificados:**
  - `js/main.js`, `js/session.js`, `js/engine.js`, `js/data.js`, `js/ui.js`
  - `css/style.css`, `index.html`
  - `tools/regress.js`, `tools/teste-interface.html`, `tools/bot.js`, `tools/verificar-balanceamento.js`
  - `.gitignore`, `README.md`
- **Novos:**
  - `js/app-bridge.js`
  - `tools/comparar-estrategias.js`, `tools/preparar-app.js`, `tools/app-bridge-test.js`
  - `app/capacitor.config.json`, `app/package.json`
  - `APP-ANDROID.md`, `MELHORIAS-JOGO.md`
  - `artifacts/antes-melhorias/`, `artifacts/comparacao-estrategias.json`
- **Atualizados:** `artifacts/verificacao-*.json`.

## Testes

| Teste | Resultado |
|---|---|
| `node tools/regress.js` | 231/231 (40 novas: salvamento/offline, metas, resgatar concluídas, cartas sem uso, marcos de escolha) |
| `node tools/profile-test.js` | 76 OK |
| `node tools/folder-save-test.js` | 26 OK |
| `node tools/app-bridge-test.js` | 13/13 |
| `node tools/verificar-recompensas-missoes.js` | OK |
| `node tools/bot.js <universo> 20` (5 universos, 2 Colapsos) | 5/5 |
| `node tools/verificar-balanceamento.js` | 20/20 campanhas chegam ao Colapso; contabilidade com erro 0 |
| `node tools/verificar-offline.js padrao` | 8 pontos × 8h; nenhuma compra ou resgate automático |
| `node tools/comparar-estrategias.js padrao 2` | tabela da seção 5 |
| `tools/teste-interface.html` | 133/133 (11 novas nesta etapa: fechar após 1h, retomada, backup, posse sem gravação, resgatar concluídas, escolha, celular) |
| `app/www` no navegador | carrega sem erros, sem arquivos faltando e sem acesso ao Google Fonts |

## Limitações e o que exige celular real

- **Aplicativo:** APK não gerado e Capacitor não instalado aqui (precisa de Node, Android Studio e aparelho). Falta testar segundo plano real, botão Voltar físico, limpeza de dados do WebView e restauração pelo espelho nativo.
- **Toque, teclado e áreas seguras:** verificados com emulação de tamanho no navegador, não em aparelho (entalhe, barra de gestos, teclado real, rotação).
- **Tamanho:** as imagens somam ~104 MB; converter para WebP reduziria muito o APK.
- **Fonte:** a Exo 2 não foi baixada para uso offline (depende da sua autorização). Sem ela, o app usa a fonte do sistema.
- **Salvamento em pasta:** depende da API de arquivos do navegador e não funciona no WebView do Android; no app, use Exportar/Importar.
- **Balanceamento:** a variância do bot (cadeia de ligas para Saturno) continua alta; a sugestão está na seção 5. Os marcos de escolha usam o bot sempre em "industrial"; as outras opções não foram simuladas em campanha completa.
- **Universos:** propostas aguardando aprovação.
