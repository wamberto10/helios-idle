# Imagens do HELIOS IDLE

O jogo combina ilustrações raster com arte de reserva em SVG. As imagens disponíveis são registradas em **`assets/manifest.js`**, carregado antes de `js/art.js`. Esse arquivo funciona tanto ao abrir `index.html` diretamente quanto com um servidor local.

Somente as imagens declaradas no manifesto são solicitadas. As demais continuam em SVG. O SVG permanece visível até a imagem carregar; se um arquivo declarado falhar, o jogo mantém a reserva e evita repetir a solicitação durante aquela sessão. Recarregue a página depois de corrigir ou adicionar arquivos.

## Expansão visual — 30/10/2026

O catálogo ativo agora possui **94 artes**, incluindo 31 novas imagens geradas com `image_gen` embutido, uma chamada por arte. As artes do catálogo anterior foram preservadas.

| Grupo | Novas artes | Uso no jogo |
|---|---|---|
| Interface | `assets/ui/anomaly.png`, `logo.png` | Anomalia de Netuno, cabeçalho e criação de comandante; favicon derivado do logo |
| Naves | `assets/ships/freighter.png`, `probe.png` | Rotas, mapa, expedições e animação do Colapso |
| Recursos | `assets/resources/icons/energy.png` | Energia, no mesmo carregador dos outros ícones |
| Universos | 5 PNGs em `assets/universes/` | Universo atual e seleção de destino do Colapso |
| Pesquisa | 6 PNGs em `assets/research/` | Cabeçalhos dos ramos de pesquisa |
| Conquistas | 15 PNGs em `assets/achievements/` | Medalhas em cinza antes da conquista e coloridas depois |

Os nomes, as descrições, os requisitos e os estados permanecem em texto acessível. O SVG de reserva continua funcionando caso um PNG falhe. Os planetas e controles pequenos mantêm os vetores próprios.

Prompts exatos e caminhos das saídas originais: [artes principais](assets/prompts-key-art-final.md), [universos e pesquisa](assets/prompts-universes-research-final.md), [emblemas de Exploração e Singularidade](assets/prompts-research-extra.md), [conquistas](assets/prompts-achievements-final.md) e [medalhas finais](assets/prompts-achievements-extra.md).

`tools/exportar-artes-finais.ps1` preserva os originais em `artifacts/artes-finais-originais/` e exporta cópias menores para o jogo, mantendo proporção e transparência. Os originais não entram na distribuição Android. O catálogo completo inclui também os 16 ícones de recursos do lote anterior.

Verificação final: 31 novas artes exportadas de 58,77 MB para 9,37 MB (redução de 84,1%); 94 artes ativas sem caminhos ausentes; 99 PNGs íntegros, incluindo arquivos preservados e favicon. A galeria carregou as 94 artes sem imagens quebradas. A cópia `app/www` foi regenerada e suas imagens conferem com as fontes.

No navegador, passaram 194 verificações gerais de interface e 22 específicas das novas artes em 1280 e 375 px, incluindo carregamento, seleção de universo, posição do cargueiro, retorno do SVG após falha e ausência de rolagem horizontal. Prévia final em `artifacts/preview-artes-finais.jpg`.

## Primeiro lote gráfico — registro histórico

Este lote concluiu **11 retratos, 4 avatares de comandante, 22 instalações, 9 cenários e 1 baú**, totalizando **47 artes** antes dos ícones de recursos e da expansão visual. Abra [a galeria completa](assets/galeria-completa.html) para ver o catálogo atual e filtrar por categoria. O primeiro lote abaixo foi preservado como registro.

| Categoria | Arquivos registrados |
|---|---|
| Retratos | `assets/portraits/iris.png`, `vulcano.png`, `nix.png`, `oraculo.png` |
| Cenários | `assets/regions/lua.png`, `marte-v2.png` (versão selecionada de Marte) |
| Instalações | `assets/buildings/extrator.png`, `refinaria.png`, `painel.png` |
| Interface | `assets/ui/chest.png` |

Abra **`assets/galeria.html`** para conferir as 10 artes em uma prancha local. Cada imagem abre o arquivo original. A galeria usa somente arquivos do projeto e funciona ao abrir diretamente no navegador.

Retratos e panoramas preenchem sua área com recorte proporcional. Instalações e baú usam a imagem inteira, preservando transparência. O jogo mantém o modelo inicial com cabeçalho panorâmico e cartões de produção. O painel separado de construção está desativado (`SHOW_BASE_PANEL = false`); as máquinas não são sobrepostas ao cabeçalho.

## Painel de construção arquivado

O experimento com terreno separado e posições fixas foi desativado por decisão do usuário. Seus arquivos foram preservados; o jogo utiliza os cartões de instalação e o cabeçalho do primeiro modelo.

| Categoria | Arquivos |
|---|---|
| Terrenos sem construções | `assets/regions/lua-terreno.png`, `marte-terreno.png` |
| Instalações lunares adicionais | `assets/buildings/armazem.png`, `esc_gelo.png`, `eletrolisador.png`, `observatorio.png`, `forja.png`, `reator.png` |

Os dois terrenos permanecem no grupo `terrain` do manifesto, mas o painel arquivado não é montado durante a partida. As 22 instalações agora possuem imagem raster nos cartões de produção; o SVG continua como reserva em caso de falha no carregamento.

Os prompts usados estão em `assets/prompts-terrenos.md`, `assets/prompts-buildings-base.md` e `assets/prompts-forja-reator.md`. As imagens foram geradas com a ferramenta image_gen embutida; os originais anteriores foram preservados.

## Lote final — 27 novas artes

| Categoria | Arquivos adicionados |
|---|---|
| 7 retratos | `assets/portraits/vega.png`, `helio.png`, `aura.png`, `ion.png`, `lumen.png`, `eco.png`, `reliquia.png` |
| 13 instalações | `assets/buildings/coletor_solar.png`, `min_ast.png`, `garimpo.png`, `plataforma.png`, `quimica.png`, `fotovoltaica.png`, `ref_fusao.png`, `fabrica.png`, `criogenico.png`, `fab_sat.png`, `estaleiro.png`, `obs_profundo.png`, `lab_anomalia.png` |
| 7 cenários | `assets/regions/cinturao.png`, `mercurio.png`, `venus.png`, `jupiter.png`, `saturno.png`, `urano.png`, `netuno.png` |

Todas foram geradas com **image_gen embutido**, uma chamada por arte, e registradas em `assets/manifest.js`. Prompts exatos e caminhos dos originais:

- [Retratos](assets/prompts-portraits-pendentes.md)
- [Máquinas de extração, energia e pesquisa](assets/prompts-maquinas-extracao.md)
- [Máquinas industriais](assets/prompts-maquinas-industriais.md)
- [Cenários](assets/prompts-regions-pendentes.md)

Os planetas do mapa e os glifos pequenos da interface continuam em SVG intencionalmente. Não são imagens pendentes. Os dois terrenos e o primeiro cenário de Marte são arquivos preservados fora do catálogo ativo.

### Verificação do lote final

- Conferidos os identificadores dos dados do jogo contra o manifesto: nenhum retrato, instalação ou cenário ausente.
- Galeria no navegador: 43 imagens carregadas, nenhum arquivo quebrado ou erro no console. Filtros de tripulação, instalações e cenários conferidos.
- Instalações: 22 PNGs quadrados de 1254 × 1254 com cantos transparentes; retratos: 11 PNGs de 1122 × 1402. Cenários panorâmicos próximos de 3:1.
- Jogo real em partida de verificação separada: cabeçalho lunar e imagens dos cartões carregados; painel de construção ausente. Layout em 390 px sem transbordamento horizontal; tamanho de teste restaurado depois da conferência.
- Prévias salvas em `assets/preview-tripulacao-completa.jpg`, `preview-instalacoes-completas.jpg`, `preview-modelo-inicial.jpg` e `preview-modelo-inicial-celular.jpg`.

## Adicionar novas artes

Os avatares próprios do jogador ficam em `assets/commanders/{aurora,atlas,sentinela,eclipse}.png`, com 1122 × 1402 e fundo opaco. Foram gerados com image_gen embutido; os [prompts exatos](assets/prompts-commanders.md) preservam as referências dos originais. O grupo `commander` do manifesto é usado pela tela de criação e pelo perfil, separado dos especialistas.

1. Salve a imagem dentro de `assets/`, preferencialmente com o identificador já usado pelo jogo.
2. Abra `assets/manifest.js` e adicione o caminho no grupo correspondente: `portrait`, `building`, `region`, `terrain`, `planet` ou `ui`.
3. Recarregue a página. Para retornar ao SVG, remova a entrada do manifesto.

Exemplo para incluir Vega e Vênus:

```js
portrait: {
  // mantenha as entradas existentes
  vega: 'assets/portraits/vega.png',
},
region: {
  // mantenha as entradas existentes
  venus: 'assets/regions/venus.png',
},
```

Os caminhos são relativos à pasta de `index.html`. PNG, JPEG e WebP podem ser usados conforme o caminho declarado; para recortes transparentes, preserve um formato com canal alfa. Todas as artes das tabelas abaixo já estão presentes; as sugestões originais foram mantidas como referência.

**Estilo comum para todos os prompts** (cole no início de cada pedido):

> Ilustração 2D digital, estilo de jogo mobile premium, traço limpo, iluminação de ficção científica, fundo azul-escuro/preto espacial, destaques em ciano (tecnologia), dourado (recompensas) e roxo (singularidade). Sem texto, sem logotipos, sem marca d'água.

## Retratos dos especialistas — `assets/portraits/<id>.png`

Formato retrato **4:5** (ex.: 800×1000), personagem do peito para cima, centralizado, fundo com brilho da cor indicada.

| Arquivo | Personagem | Sugestão de prompt |
|---|---|---|
| `iris.png` | Íris, Engenheira Lunar (humana) | Engenheira jovem com traje espacial branco e detalhes ciano, capacete aberto, ferramenta de mineração no ombro, poeira lunar, brilho ciano |
| `vulcano.png` | Vulcano, Mestre de Forja (robô) | Robô industrial robusto, placas de metal escurecido, olhos laranja incandescentes, faíscas de forja, brilho laranja |
| `nix.png` | Nix, Especialista Criogênica (humana) | Cientista com traje térmico azul-gelo, cabelo com cristais de gelo, respiração visível, brilho azul-claro |
| `oraculo.png` | Oráculo, IA de Pesquisa | Inteligência artificial como núcleo luminoso violeta cercado por anéis orbitais e glifos de dados, sem rosto humano |
| `vega.png` | Vega, Piloto de Carga (humano) | Piloto confiante com jaqueta de voo verde-menta, fones, painel de cabine ao fundo, brilho verde |
| `helio.png` | Hélio, IA Solar | IA como esfera solar dourada com coroa de luz e painéis geométricos orbitando, brilho dourado |
| `aura.png` | Aura, Exploradora Atmosférica (humana) | Exploradora com traje leve amarelo-areia, óculos de proteção, nuvens de Vênus ao fundo |
| `ion.png` | Íon, Engenheiro de Fusão (robô) | Robô esguio com núcleo de plasma magenta no peito, bobinas magnéticas nos ombros |
| `lumen.png` | Lúmen, Arquiteta do Enxame (IA lendária) | Figura de luz dourada feita de milhares de pequenos satélites formando um rosto sereno, Sol ao fundo |
| `eco.png` | Eco, Eco da Singularidade (lendário) | Silhueta humanoide feita de vazio estrelado com contorno roxo, horizonte de eventos atrás |
| `reliquia.png` | Relíquia, Guardião Ancestral (robô) | Robô antigo de bronze com runas geométricas, musgo cósmico, olhos âmbar |

## Instalações — `assets/buildings/<id>.png`

Formato **quadrado** (ex.: 512×512), objeto isolado, vista 3/4, fundo transparente ou escuro liso.

| Arquivo | Instalação |
|---|---|
| `painel.png` | Painel solar inclinado em suporte |
| `coletor_solar.png` | Grande espelho parabólico solar |
| `reator.png` | Reator de fusão toroidal com brilho |
| `armazem.png` | Contêineres e silos empilhados |
| `extrator.png` | Torre de perfuração lunar |
| `min_ast.png` | Nave mineradora agarrando um asteroide |
| `garimpo.png` | Estação extraindo cristais roxos de rocha |
| `esc_gelo.png` | Escavadora com blocos de gelo |
| `plataforma.png` | Plataforma flutuante com balão nas nuvens |
| `refinaria.png` | Fornalha industrial com chaminé |
| `eletrolisador.png` | Tanques com gotas e eletrodos |
| `quimica.png` | Refinaria química com frascos e tubos |
| `forja.png` | Bigorna/forja futurista com metal incandescente |
| `fotovoltaica.png` | Fábrica de células solares azuis |
| `ref_fusao.png` | Esfera de contenção com anel magnético |
| `fabrica.png` | Fábrica com engrenagens e esteira |
| `criogenico.png` | Câmara criogênica com névoa ciano |
| `fab_sat.png` | Linha de montagem de satélites dourados |
| `estaleiro.png` | Estaleiro orbital com casco gigante e guindaste |
| `observatorio.png` | Cúpula de observatório com telescópio |
| `obs_profundo.png` | Antena parabólica gigante no gelo |
| `lab_anomalia.png` | Laboratório hexagonal com núcleo roxo |

## Cenários das regiões — `assets/regions/<id>.png`

Formato **panorâmico**, exibido em uma faixa próxima de **5:1**. Uma arte 3:1 também funciona; mantenha os elementos importantes na faixa central vertical para permitir o recorte. A metade esquerda fica sob o texto, então deixe-a mais escura e simples.

`lua.png` (superfície lunar cinza, Terra no céu), `marte-v2.png` (versão selecionada: deserto vermelho e cânions), `cinturao.png` (campo de asteroides), `mercurio.png` (superfície queimada, Sol enorme), `venus.png` (mar de nuvens amarelas), `jupiter.png` (faixas e tempestades), `saturno.png` (anéis de gelo em primeiro plano), `urano.png` (azul-gelo, inclinado), `netuno.png` (azul profundo, brilho estranho).

## Interface — `assets/ui/`

| Arquivo | Uso | Formato |
|---|---|---|
| `chest.png` | Baú de Suprimentos | quadrado, baú sci-fi dourado e azul-escuro |

## Observações

- A pasta `assets/planets/` está reservada para uso futuro (o mapa usa planetas desenhados em SVG).
- Imagens em `.png` com fundo transparente ficam melhores nas instalações; retratos podem ter fundo.
- Os PNGs preservam a resolução original gerada e o canal alfa das instalações.
