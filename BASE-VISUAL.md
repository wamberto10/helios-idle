# Base visual organizada — experimento arquivado

O usuário optou por manter o primeiro modelo. `SHOW_BASE_PANEL = false` em `js/ui.js` mantém este painel desativado. O jogo utiliza o cabeçalho panorâmico e os cartões de produção; os arquivos abaixo ficam preservados para referência.

A região tem duas áreas separadas: resumo de título/progresso e terreno da base. O terreno usa `H.ASSET_MANIFEST.terrain`; imagens antigas de cenários com construções não são usadas como fundo da base.

## Posições e representações

`A.baseLayout(rid)` considera todos os tipos de `D.regions[rid].build`, inclusive os bloqueados. Calcula uma ordem fixa e reserva até nove posições em três fileiras. Construir, desbloquear ou melhorar não muda as coordenadas dos outros tipos.

`A.scene(rid, reg, { available })` desenha o terreno limpo e um botão por tipo. Cada instalação construída recebe uma única imagem PNG (ou SVG de reserva), pad, nome e badge `Nv. 2 · ×12`. A quantidade nunca cria cópias da máquina. Locais disponíveis ainda vazios mostram um pad com `+ Construir`; locais bloqueados permanecem reservados e ocultos.

Os botões usam as mesmas ações e os mesmos cards de produção da interface. Selecionar uma instalação move o foco ao card correspondente e o destaca; não compra nem opera automaticamente.

## Atualização

A interface mantém o DOM do terreno por região durante o universo atual. Os updaters `baseslot` e `basecount` atualizam quantidade, nível, automação, pausa e gargalos. As imagens só são inseridas quando o tipo passa a existir. Mudanças estruturais nas missões/cards reutilizam a base e restauram sua rolagem horizontal. Um novo universo ou estado de partida recria o cache.

O canvas tem largura mínima de 1120 px e altura de 630 px, com rolagem horizontal no celular. Os sprites mantêm tamanho legível, padding de 8 px e `object-fit: contain`. O fundo usa alinhamento no topo, sem prédios decorativos. As demais regiões usam um terreno SVG limpo enquanto não houver PNG declarado.

## Prévia isolada

Abra `tools/base-preview.html` diretamente ou pelo servidor local. A página usa o componente real `A.scene`, os dados e o motor para criar fixtures de Lua e Mercúrio. Oferece início, base consolidada (12 unidades, nível 2) e extrema (120 unidades, nível 25). Não carrega `main.js`, não inicia o laço da partida e não grava salvamentos.

Conferir na prévia e na partida:

- Nove tipos completos cabem sem sobreposição entre nomes/badges.
- Quantidades altas mantêm uma só máquina por tipo.
- Comprar/melhorar mantém coordenadas, foco e rolagem.
- Avançar fase revela novos locais nas posições reservadas.
- Falha/ausência de PNG mantém o SVG no mesmo pad.
- Tab/Enter selecionam as instalações; a área móvel permite explorar os lados.
- Redução de movimento remove deslocamentos de hover e rolagem suave.
