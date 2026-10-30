# Auditoria de acessibilidade mobile — HELIOS IDLE

Data: 29/10/2026. Código examinado: commit `082068a`.

## Resultado

O layout tem recursos úteis de acessibilidade, mas apresenta barreiras de leitura, operação por teclado e identificação de recursos/estados. Esta verificação identifica problemas concretos; não constitui certificação WCAG nem teste completo com tecnologias assistivas em aparelho real.

Nenhum arquivo de implementação foi alterado. As ações de teste utilizaram apenas a partida isolada `?slot=a11y_mobile_20261029`. Este relatório é o único arquivo criado no projeto durante a auditoria.

## Método e cobertura

- Inspeção visual no navegador, árvore de acessibilidade, estilos calculados e medidas DOM.
- Sete telas iniciais: Sistema, Região, Tripulação, Pesquisa, Expedições, Singularidade e Ajustes.
- Janelas de 320 × 640, 375 × 812 e 430 × 932 pixels; Ajustes e edição do comandante também em 812 × 375.
- O navegador emulado reserva até 15 px para a barra de rolagem: uma janela de 375 px apresentou 360 px de área de conteúdo. As medidas abaixo distinguem janela e conteúdo. Isso não simula integralmente um dispositivo móvel.
- Estado avançado preparado pelos controles de desenvolvimento da própria partida de teste: regiões liberadas, nomes de recursos e uma rota construída.
- Alteração de opção, navegação por Tab, estado EXP, identificação de campos e diálogo de perfil.
- Revisão estática complementar de HTML, CSS e JavaScript.

Não foram executados TalkBack, VoiceOver, controle por varredura, teclado virtual real, zoom/texto a 200%, substituição de espaçamento de texto nem testes de contraste por pixels sobre todas as imagens. A preferência de movimento reduzido do sistema foi revista no código, sem emulação do sistema operacional nesta auditoria.

## Achados confirmados

### A01 — Custos e insumos são números sem identificação acessível

**Prioridade: alta.** Na árvore de acessibilidade, botões de construção anunciam exemplos como “Construir +1 20 13”. Os ícones que identificam os recursos estão ocultos com `aria-hidden`, e os chips não acrescentam os nomes. O mesmo padrão aparece nas entradas das receitas e em outras quantidades.

- Evidência: `js/ui.js:25` (`resChip`), `js/art.js:136` (`A.rg`) e `js/ui.js:431` (receitas).
- Efeito: quem usa leitor de tela não consegue saber quais recursos serão gastos.
- Correção: fornecer o nome de cada recurso junto à quantidade, visível ou em texto acessível. Exemplo: “Construir refinaria: 20 metais e 13 minérios”, usando os recursos reais de cada receita.
- Critérios relacionados: WCAG 1.1.1 e 1.3.1.

### A02 — Navegação inferior é cortada na janela de 320 px

**Prioridade: alta para telas estreitas.** O botão Singularidade se estende até aproximadamente x=351 px; a barra dispõe de 305 px de conteúdo na janela de 320 px. O corte foi confirmado visualmente. A página pode continuar com `scrollWidth == clientWidth`, portanto o teste existente de ausência de rolagem horizontal não detecta a perda.

- Evidência: `css/style.css:473–474`; barra medida com `scrollWidth=351` e largura de 305 px.
- O problema se repetiu nas sete telas. Em 375 e 430 px não houve corte dos controles principais nas telas iniciais examinadas.
- Correção: permitir que os itens realmente encolham/reorganizem, rever quantidade e rótulos da barra ou introduzir uma navegação “Mais” acessível. Não resolver apenas diminuindo ainda mais a fonte.
- Verificação de aceite: todos os nomes e áreas acionáveis devem caber em 320 px de conteúdo, inclusive com indicação de seleção e foco.
- Critério relacionado: WCAG 1.4.10; o mapa pode ter necessidades bidimensionais, mas a barra comum de navegação não depende delas.

### A03 — Contraste insuficiente em informações secundárias

**Prioridade: alta para baixa visão.** A cor `--dim: #61759b` é utilizada na capacidade do estoque, taxa zero e EXP desligado. São informações reais, não apenas decoração nem controles desabilitados.

- Evidência: `css/style.css:5`, `css/style.css:192`, `css/style.css:196`; estilos calculados confirmaram texto de 10–12 px em `rgb(97,117,155)`.
- Cálculo sRGB com os fundos translúcidos do estoque sobre o fundo base: fundo composto aproximado `rgb(17.274,30.776,61.766)`, contraste **3,5166:1**. Gradientes e estrelas podem variar o fundo; este cálculo não é uma medição de todos os pixels.
- O mínimo aplicável a texto normal é **4,5:1**.
- As pesquisas bloqueadas também usam `opacity:.45` no botão inteiro (`css/style.css:300`), reduzindo a leitura dos requisitos. O navegador confirmou que esses botões continuam interativos (`disabled=false`), portanto não presumir a exceção de controles inativos.
- Correção: clarear os textos secundários e manter os requisitos legíveis; usar cadeado, etiqueta ou borda para comunicar bloqueio sem apagar o texto.
- Critério: WCAG 1.4.3.

### A04 — Alterar uma opção perde o foco

**Prioridade: média.** Ao desmarcar Som nos Ajustes, o controle é recriado e `document.activeElement` passa a ser `BODY`. O comportamento também ocorreu ao ativar as ferramentas na partida de teste.

- Evidência: `js/ui.js:58`, `js/ui.js:260`, `js/ui.js:1017`, `js/ui.js:1235`.
- Causa: os switches usam `data-ch`, mas a chave usada para recuperar o foco não reconhece esse atributo; a alteração de settings refaz o conteúdo.
- Efeito: a navegação por teclado ou entrada assistiva perde a posição atual.
- Correção: atribuir chaves estáveis aos controles ou reconhecer `data-ch` ao recuperar o foco. Testar switches, filtros e seletores, sem presumir que todos têm o mesmo efeito.
- Critério relacionado: WCAG 2.4.3; a sequência efetiva deve preservar a operação.

### A05 — “Abrir arquivo” não oferece controle de teclado

**Prioridade: média.** A interface usa um `label` estilizado como botão contendo `input type=file hidden`. O navegador expõe “Abrir arquivo” como texto, não como botão/entrada acionável; o input está com `display:none`.

- Evidência: `js/ui.js:1025`, árvore de acessibilidade e estilo calculado.
- Correção: usar um botão nativo que acione o seletor ou manter um input de arquivo acessível estilizado. Validar ativação por teclado e leitor de tela sem abrir seletor automaticamente.
- Critério relacionado: WCAG 2.1.1.

### A06 — EXP não comunica seu estado

**Prioridade: média.** Após ligar a exportação, o botão mostra “EXP ✓”, mas mantém o mesmo nome acessível e não tem `aria-pressed` nem `aria-checked`.

- Evidência: `js/ui.js:338` e `js/ui.js:649`; confirmado antes e depois do clique.
- Correção: expor um estado de alternância atualizado, por exemplo `aria-pressed`, mantendo nome estável e identificando o recurso.
- Critério relacionado: WCAG 4.1.2.

### A07 — A ordem visual diverge da leitura e do foco

**Prioridade: média.** O celular mostra missões e gargalo antes do estoque, mas o DOM começa por estoque e instalações. A navegação assistiva segue esse DOM.

- Evidência: `js/ui.js:648–656` e `css/style.css:560–563`.
- Reprodução: após Rotas e transporte, Tab foi para Exportar excedente de Minério, na posição vertical aproximada de 1419 px, embora as missões começassem em 347 px. Depois de passar pelo outro recurso, voltou para Operar refinaria, em 1263 px. A interface faz a pessoa saltar entre trechos.
- Correção: organizar o DOM na sequência lógica do celular e montar as colunas maiores por CSS, preservando uma ordem de leitura compreensível.
- Critérios relacionados: WCAG 1.3.2 e 2.4.3. A diferença de ordem, isoladamente, não basta para declarar falha; o efeito de saltos foi observado e deve ser eliminado.

### A08 — Nomes longos de recursos ficam truncados em 375 px

**Prioridade: média.** Em estado avançado, os cabeçalhos dos cartões têm 127 px disponíveis. O botão EXP ocupa espaço reservado, e o nome usa uma única linha com corte.

| Nome | Espaço disponível | Largura necessária medida |
|---|---:|---:|
| Componentes | 127 px | 143 px |
| Combustível | 127 px | 135 px |
| Células Solares | 127 px | 151 px |
| Módulos Estruturais | 127 px | 180 px |
| Supercondutores | 127 px | 161 px |

- Evidência: `css/style.css:190` e `css/style.css:491`; `scrollWidth > clientWidth` nos nomes, apesar de a página não apresentar overflow horizontal.
- Em 320 px, até Minério precisou de 107 px num cabeçalho com 100 px.
- Correção: permitir duas linhas, separar EXP do título ou utilizar uma coluna em larguras menores. O nome completo precisa ser recuperável por toque, sem depender de hover.
- Classificação: perda visual confirmada; verificar também texto ampliado antes de classificar integralmente os critérios 1.4.4/1.4.10.

### A09 — Campo de reserva da rota não tem nome associado

**Prioridade: média.** O texto “Reserva mínima na origem” aparece ao lado do campo, mas não está associado por `label`, `aria-label` ou `aria-labelledby`. A árvore o expõe como um campo numérico com valor 0.

- Evidência: `js/ui.js:761`; confirmado numa rota construída pela interface da partida isolada. `input.labels` estava vazio e `aria-label` ausente.
- Correção: associar o texto ao campo e identificar a rota quando houver várias.
- Critérios relacionados: WCAG 1.3.1, 3.3.2 e 4.1.2.

### A10 — Seleção da navegação e avisos não têm estado acessível

**Prioridade: média.** A tela atual usa apenas `.on`; os avisos usam um ponto visual vazio. A árvore não informa qual seção está selecionada nem o que o aviso significa.

- Evidência: `js/ui.js:320–329`; `aria-current` ausente em todos os botões da navegação examinados.
- Correção: identificar a seção atual, expor o significado dos avisos e representar corretamente a seleção nas abas de Produção/Rotas e nas regiões. Usar anúncios apenas quando houver mudança relevante, sem narrar cada atualização de recursos.
- Critérios relacionados: WCAG 1.3.1 e 4.1.2, conforme o componente e o estado implementado.

## Melhorias de conforto e verificações adicionais

- A navegação usa texto de 10,5 px; EXP, 10 px; capacidades, 11,5 px. Aumentar a legibilidade é recomendável, mas a WCAG não estabelece um tamanho mínimo universal de fonte em pixels.
- A primeira operação útil fica muito abaixo da primeira tela na partida inicial: o atalho Operar refinaria foi medido em aproximadamente 1263 px na janela estreita. Um objetivo compacto e uma ação principal mais próxima reduzem a carga de rolagem. É uma melhoria de usabilidade, não uma falha WCAG automática.
- A maioria dos botões principais tem altura de pelo menos 44 px. Isso não significa que todos tenham 44 × 44 px. Alguns ícones mantêm largura de 40 px e switches usam 22 px de altura, com o label ampliando a área clicável. O mínimo AA é 24 × 24 px com exceções por espaçamento/equivalência; 44 × 44 px é a meta AAA. Não classificar controles pequenos somente pela altura sem considerar toda a área acionável.
- Os contornos de campos usam cores com contraste estimado abaixo de 3:1. Conferir se o contorno é necessário para identificar cada campo e reforçá-lo onde for; a marca de foco cyan já é mais visível. Não foi feita uma conclusão formal global de WCAG 1.4.11.
- Os alvos de planetas diminuem com a escala do SVG. Convém medir área e espaçamento reais e oferecer destinos por botões/lista. Um alvo menor que 24 px num mapa não implica falha automaticamente.
- O atraso interno de revelação do baú em `js/ui.js:971` ainda usa o ajuste manual em vez da preferência efetiva `H.reduceMotion()`. Unificar a regra é aconselhável.

## Pontos positivos confirmados

- Em 375 e 430 px não houve corte dos controles principais nas sete telas iniciais examinadas. Isso não elimina o truncamento interno de nomes de recursos.
- Em 812 × 375, Ajustes não apresentou corte horizontal dos controles medidos. O diálogo de comandante tinha altura de 341 px, conteúdo de 614 px e rolagem vertical disponível.
- O perfil tem label, instruções, grupo de avatares e mensagens de validação.
- O diálogo de perfil tem nome e torna o fundo inerte. Shift+Tab a partir do primeiro campo foi para Salvar comandante; Escape fechou o diálogo e devolveu o foco a Editar perfil.
- As seções recolhíveis usam `details/summary`, preservando semântica nativa.
- Há foco visível, áreas seguras previstas, feedback textual além das cores e mensagens em região `aria-live`.
- O viewport não proíbe zoom. Isso é um ponto favorável, mas não substitui o teste a 200%.

## Ordem sugerida de correção

1. Identificar recursos nos custos e receitas; corrigir a navegação cortada.
2. Corrigir contraste secundário e pesquisas bloqueadas.
3. Preservar foco nas alterações e tornar Abrir arquivo acionável.
4. Associar labels e expor estados de EXP/navegação.
5. Alinhar ordem DOM/visual e eliminar cortes dos nomes de recursos.
6. Repetir os casos corrigidos e testar texto/zoom a 200%, TalkBack, VoiceOver, teclado virtual, rotação e áreas seguras em aparelhos reais.

## Referências

- [WCAG 1.4.3 — Contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [WCAG 1.4.10 — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [WCAG 1.4.4 — Redimensionamento de texto](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)
- [WCAG 2.4.3 — Ordem de foco](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
- [WCAG 2.1.1 — Teclado](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)
- [WCAG 4.1.2 — Nome, função e valor](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)
- [WCAG 2.5.8 — Alvo mínimo, AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [WCAG 2.5.5 — Alvo ampliado, AAA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)
- [WCAG 1.4.11 — Contraste não textual](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

## Situação após as correções (30/10/2026)

Todos os achados A01–A10 foram corrigidos e cobertos por verificações automáticas em `tools/teste-interface.html` (seção “Acessibilidade”). A suíte de interface tem 153 verificações, todas aprovadas. As regressões do motor seguem em 231/231. Os testes com TalkBack, VoiceOver, texto/zoom a 200%, teclado virtual real, rotação e áreas seguras em aparelho continuam pendentes.

| Achado | Correção | Verificação |
|---|---|---|
| A01 | O ícone de recurso (`A.rg`) anuncia o nome (`role="img"` e `aria-label`) em custos, receitas e quantidades. Onde o nome já está escrito, o ícone fica decorativo para não repetir. | Custo do extrator anuncia “Metal”; insumo da refinaria, “Minério”. |
| A02 | Rótulos curtos abaixo de 400 px (Equipe, Sondas, Colapso), botões que podem encolher e rótulo longo fora do layout e da leitura. O nome acessível é o texto visível. | Os seis botões cabem em 320 px, todos com rótulo visível. |
| A03 | `--dim` passou de #61759b para #8a9cc0 (5,9:1 no estoque, 5,0:1 no painel mais claro). Pesquisa bloqueada: borda tracejada e cadeado, sem opacidade no texto. Botões desabilitados a 62% (antes 42%). Contorno dos campos #7a90b6 (5,8:1). | Contraste medido 5,90:1; pesquisa bloqueada com opacidade 1. |
| A04 | A chave de foco reconhece `data-ch` (interruptores e seletores). | O foco permanece em “Som” depois de mudar a opção. |
| A05 | “Abrir arquivo” é um botão nativo que aciona o seletor oculto. | O botão aciona o seletor. |
| A06 | EXP com `aria-pressed` atualizado e nome “EXP: exportar excedente de <recurso>”. | Falso → verdadeiro ao ligar. |
| A07 | Até 960 px, o HTML da região é gerado na ordem de prioridade (missões, gargalo, suprimentos, projetos, estoque, energia, instalações, especialistas, diário), sem reordenar por CSS. Ao cruzar a largura, a tela é refeita. | O primeiro controle da área é das missões; a ordem do HTML confere. |
| A08 | Nomes em até duas linhas. No celular o EXP vai para o canto inferior e o estoque usa uma coluna abaixo de 340 px. | Nenhum nome cortado em 375 e 320 px. |
| A09 | “Reserva mínima na origem” associada por `label`, com a rota no nome (ex.: “(Lua → Marte)”); os seletores de prioridade também citam a rota. | `input.labels` preenchido e nome com a rota. |
| A10 | `aria-current="page"` na navegação e `aria-current="true"` na aba e na região atuais. O ponto de aviso tem texto equivalente (ex.: “missões prontas”). | Seção, aba e região atuais marcadas. |

**Melhorias de conforto:**
- **Fontes:** navegação a 11,5 px no celular, EXP a 11,5 px e capacidade a 12,5 px.
- **Mapa:** lista “Destinos” com botões para cada planeta.
- **Baú:** o atraso de revelação usa `H.reduceMotion()`.
- **Avisos:** no celular aparecem no máximo dois sobre o conteúdo.
- **Primeira ação útil:** o gargalo, logo após as missões, oferece “Operar” na partida inicial.
