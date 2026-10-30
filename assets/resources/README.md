# Recursos — HELIOS IDLE

Prancha PNG gerada com a ferramenta image_gen embutida em 30/10/2026.

Arquivo: `recursos-helios-idle-v1.png`. Dimensões verificadas: 1254 × 1254 px, RGBA, fundo realmente transparente. A imagem original foi preservada. O prompt está em `recursos-helios-idle-v1-prompt.txt`; a resolução solicitada no prompt foi 2048 × 2048, mas a ferramenta retornou 1254 × 1254. Os pixels não foram redimensionados.

Grade visual 4 × 4, sem texto embutido:

| Linha | Coluna 1 | Coluna 2 | Coluna 3 | Coluna 4 |
|---|---|---|---|---|
| 1 | Minério (`ore`) | Metal (`metal`) | Ligas (`alloy`) | Componentes (`comp`) |
| 2 | Gelo (`ice`) | Gases (`gas`) | Combustível (`fuel`) | Metais Raros (`rare`) |
| 3 | Células Solares (`cell`) | Combustível de Fusão (`fusion`) | Módulos Estruturais (`hull`) | Supercondutores (`cryo`) |
| 4 | Matéria Exótica (`exotic`) | Satélites Dyson (`sat`) | Dados (`data`) | Fragmentos (`frag`) |

## Integração no jogo (30/10/2026)

O grupo também inclui `icons/energy.png`, gerado separadamente na expansão visual final. Esse raio dourado não vem da prancha e não é alterado por `recortar-recursos.js`; seu prompt está em `../prompts-key-art-final.md`.

- `node tools/recortar-recursos.js` recorta a prancha em 16 arquivos de 128 × 128 px em `icons/<id>.png` (cerca de 420 KB no total). Cada ícone é separado pelos pixels conectados: partes de um vizinho que invadem a célula ficam de fora, e partes que passam da borda vêm inteiras. A prancha original não é alterada.
- Registrados em `assets/manifest.js` (grupo `resource`). O jogo usa `A.rg` em `js/art.js`: **24 px nos custos** (botões de construir/melhorar/ampliar, expedições, entregas, projetos, pesquisa, combustível das rotas) e **32 px no estoque**. Os demais usos continuam no tamanho anterior.
- Os nomes e as quantidades continuam em texto. O ícone de custo tem `alt` com o nome do recurso; no estoque, onde o nome está escrito ao lado, o ícone é decorativo.
- Se um arquivo não carregar, o ícone vetorial (SVG) volta no lugar.
- O aplicativo (`tools/preparar-app.js`) leva só os recortes, não a prancha de 2 MB.
