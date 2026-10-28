# HELIOS IDLE

Jogo idle incremental no Sistema Solar: produção em cadeia, especialistas colecionáveis, missões por fase, rotas orbitais, enxame de Dyson e o **Colapso** (prestígio atravessando um buraco negro para universos alternativos).

Aplicação web sem etapa de build (HTML + CSS + JavaScript puro). Funciona no celular e no computador.

**Jogar online:** https://wamberto10.github.io/helios-idle/ (GitHub Pages, publicado a partir da branch `main`; cada `git push` atualiza o site em 1 a 2 minutos). O progresso fica salvo no navegador de cada pessoa.

## Como iniciar

**Opção 1 — mais simples:** dê dois cliques em `index.html`. O jogo abre direto no navegador e salva no armazenamento local.

**Opção 2 — servidor local (recomendado para celular na mesma rede):**

```bash
python tools/servidor.py
```

Depois abra `http://localhost:8765`. No Windows, `iniciar.bat` faz isso sozinho.

Para jogar no celular, sirva a pasta numa máquina da rede e abra `http://IP-DA-MAQUINA:8765` no celular, ou publique a pasta em qualquer hospedagem estática.

## Testes automáticos

```bash
node tools/bot.js padrao 20
```

Troque `padrao` por `abundante`, `energetico`, `congelado` ou `ancestral` para testar cada tipo de universo. Cada execução roda:

1. **Regressões do motor e das abas** (`tools/regress.js`, também executável sozinho com `node tools/regress.js`): importação válida e inválida (inclusive 600 salvamentos alterados ao acaso), migração v1 → v2, ciclos manuais com construção, melhoria, especialista e salvamento no meio, estoques intermediários cheios, produção igual em passos de 0,01s, 0,1s, 1s, 30s e offline, várias rotas e entregas parciais, conservação de carga, Colapso com carga a bordo, coordenação entre abas e falhas de armazenamento.
2. **Verificação estática** de dependências (nenhuma instalação exige material inacessível naquela fase etc.).
3. **Campanha completa** jogada pelo bot só com ações do jogador, até o Colapso, e depois um **segundo universo** até o próximo Colapso, com invariantes (recursos nunca negativos), online × offline, salvamento e Colapso.

**Interface:** com o jogo servido localmente (`iniciar.bat` ou `python tools/servidor.py`), abra `http://localhost:8765/tools/teste-interface.html`. A página carrega o jogo real (`ui.js` e `main.js`) em quadros isolados e verifica foco e teclado, painéis que se atualizam sozinhos, falhas de salvamento, importação, várias abas, offline com duas abas e layout no computador (1280 px) e no celular (375 px). Ela usa partidas separadas (`?slot=`) e apaga só essas no final: o salvamento pessoal não é lido nem alterado.

Tempos medidos pelo bot (jogo perfeito, sem pausas): primeira automação em ~50s, Marte em ~8 min, primeiro Colapso entre ~1h20 e ~2h50 (conforme o universo), segundo Colapso em ~35–50 min. Uma pessoa jogando deve levar de 2 a 5 min até a primeira automação e algumas horas (com períodos offline) até o primeiro Colapso.

## Estrutura

| Arquivo | Função |
|---|---|
| `js/data.js` | **Todos os valores de balanceamento**: recursos, instalações (receitas, custos, tempos, energia), regiões, fases e missões, especialistas e multiplicadores, expedições, pesquisa, universos, Dyson, regras do Colapso |
| `js/engine.js` | Simulação (sem DOM): produção, energia, rotas, missões, expedições, baús, pesquisa, Colapso, offline, salvamento versionado e validação de importações |
| `js/session.js` | Coordenação entre abas (uma aba gravadora) e gravação com revisão |
| `js/ui.js` | Interface: telas, cartas, mapa, modais |
| `js/art.js` | Arte de reserva em SVG (retratos, ícones, planetas, cenários) |
| `js/main.js` | Inicialização, laço de jogo, salvamento automático, som, animação do Colapso, ferramentas de desenvolvimento |
| `css/style.css` | Identidade visual e layout responsivo |
| `tools/bot.js` | Bot de teste (campanha completa) |
| `tools/regress.js` | Testes de regressão do motor e das abas |
| `tools/teste-interface.html` | Testes da interface no navegador |
| `assets/` | Imagens opcionais, registradas em `assets/manifest.js` (veja `ASSETS.md`) |

## Catálogo gráfico

Abra [assets/galeria-completa.html](assets/galeria-completa.html) para conferir as 47 artes: 11 especialistas, 4 avatares de comandante, 22 instalações, 9 cenários e o baú. O jogo mantém o primeiro modelo, com cabeçalho panorâmico e cartões de produção; o painel experimental de construção está desativado. Os prompts exatos e o inventário dos arquivos estão em [ASSETS.md](ASSETS.md).

## Perfil local e pasta de saves

Na primeira abertura, escolha um nome e um dos quatro avatares do comandante. Partidas antigas pedem apenas a identidade, preservando todo o progresso. O perfil pode ser editado pelo avatar no topo ou em **Ajustes → Comandante** e acompanha exportações, importações e o Colapso. Não há login online nesta etapa.

Em **Ajustes → Pasta de saves → Escolher pasta**, selecione uma pasta do dispositivo e autorize a gravação pelo navegador. O arquivo `helios-idle-save.json` é atualizado junto do salvamento normal. A seleção é lembrada quando o navegador permite; se necessário, use **Autorizar e salvar cópia** ao reabrir. Em navegadores sem essa API, **Baixar cópia** mantém a exportação por arquivo disponível. O save do navegador continua independente da cópia na pasta.

Ao selecionar uma pasta que já contém um save, o jogo oferece restaurar seu progresso, substituir explicitamente o arquivo pela partida atual ou cancelar. Desconectar a pasta mantém o arquivo. Para recuperar manualmente, use **Ajustes → Salvamento → Abrir arquivo** e confirme a importação.

O GitHub Pages hospeda arquivos estáticos; os saves desta versão ficam no dispositivo do jogador. Conta online com e-mail, senha e recuperação exigirá um serviço de autenticação e armazenamento na etapa futura. Referências: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) e [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access).

Testes específicos, sem acessar partidas ou pastas reais: `node tools/profile-test.js` e `node tools/folder-save-test.js`. O teste de interface também cobre criação e edição do comandante, migração visual de partidas antigas e o fluxo de pasta com arquivos em memória.

## Regras principais

- **Ciclos:** antes da automação, cada instalação roda um ciclo por toque em “Operar”. Os insumos são cobrados no início para as máquinas existentes naquele momento, e o ciclo entrega exatamente o produto dessas máquinas, no nível que tinham. Construções e melhorias feitas durante o ciclo valem a partir do seguinte. Se o armazenamento estiver cheio no fim, o produto espera e é entregue quando houver espaço. Com o especialista da categoria, a instalação roda sozinha enquanto houver insumos, energia e espaço.
- **Produção:** produção e consumo de cada intervalo são aplicados juntos (saldo por recurso). Um estoque intermediário cheio não faz recursos sumirem, e o resultado é o mesmo com passos grandes, pequenos ou offline.
- **Motivos de parada:** “Sem minério”, “Armazenamento cheio”, “Energia insuficiente”, “Aguardando transporte” (quando uma rota traz o insumo). Quando falta um insumo que está sobrando em outra região, o aviso diz onde (“Sem metais raros — sobrando em Cinturão de Asteroides”) e o painel de gargalo oferece **Planejar rota**, que abre a aba de rotas com origem, destino e recurso já escolhidos.
- **Energia:** capacidade × consumo por região. O consumo de cada instalação é energia × máquinas × velocidade^0,3 (`D.energySpeedExp`): especialistas e pesquisas de velocidade também aumentam o consumo. Com déficit, todas as instalações da região desaceleram na mesma proporção; sem material para novos geradores, pausar as instalações de transformação deixa a extração e o refino voltarem à velocidade.
- **Fragmentos de expedição:** as expedições do Universo Ancestral que dão fragmentos (Ruínas Precursoras e o bônus das Câmaras do Guardião) dão no máximo 1 fragmento cada por universo. Repetições continuam dando cartas e dados; o fragmento volta a ser possível depois do próximo Colapso. Fragmentos já ganhos não são removidos.
- **Exportar excedente (EXP):** botão em cada recurso. Ligado, a produção continua com o estoque cheio, os cargueiros que chegam descarregam tudo e o excesso vai para a Terra (o total exportado aparece na rota). Produção exportada conta para missões e para o Colapso, mas não rende dados (`D.exportRate = 0`, ajustável); carga exportada não conta como entrega.
- **Bônus:** velocidade (especialistas, pesquisa, universo, Eco) multiplica entre fontes; rendimento (nível da instalação, pesquisa, universo, fragmentos) aumenta o produto por ciclo; transporte (Vega, porões, janelas) é separado. Níveis de um mesmo projeto de pesquisa somam entre si.
- **Rotas:** estoque por região; cargueiros com origem, destino, até 3 recursos em prioridade, reserva mínima, capacidade, tempo e combustível (pagos na origem). Planetas orbitam em tempo comprimido; aproximações abrem janelas (−35% tempo e combustível).
- **Cargas:** o embarque reserva espaço no destino (descontando outras cargas a caminho) e a produção local respeita essa reserva. Se mesmo assim faltar espaço na chegada, o cargueiro descarrega o que couber e espera com o restante a bordo (“Aguardando espaço no destino”), retomando sozinho. Só o que entra no estoque conta como entrega. Ao desmontar, a carga vai para o destino e depois volta à origem; o que não couber em nenhuma das duas é mostrado antes da confirmação. No Colapso, cargas a bordo são materiais locais e reiniciam com os estoques (o resumo informa a quantidade).
- **Colapso:** exige a anomalia de Netuno investigada, 6 etapas do enxame de Dyson e o Núcleo da Singularidade. Fragmentos = ⌊3 × (valor produzido ÷ 1M)^0,45⌋ + regiões + etapas do Dyson + núcleo, × pesquisa. Cada fragmento já recebido dá +3% de rendimento global. A cada Colapso, as metas de produção das missões sobem 50% (até ×4).
- **Offline:** até 8h (ampliável por pesquisa e pela Eco), simulado com o mesmo motor da partida online.

## Ferramentas de desenvolvimento

Em **Ajustes → Ferramentas de desenvolvimento**: avançar tempo (+1 min a +8h, com relatório), adicionar recursos, dados, fragmentos e cartas, concluir missões ativas, liberar a próxima região, etapas do Dyson e “Pronto para Colapso”.

## Salvamento

- Automático a cada 20s, ao sair da página e após ações importantes (compras, promoções, resgates, Colapso). “Salvar agora” mostra o resultado real: “Jogo salvo.” só depois de gravar. Armazenamento cheio ou bloqueado gera mensagem própria, o indicador **Não salvo** no topo e novas tentativas a cada 5s. A partida continua em memória e pode ser exportada.
- **Várias abas:** só uma aba por vez joga e grava. As outras mostram “Partida aberta em outra aba” e não gravam nada, nem ao fechar ou recuperar o foco. “Usar esta aba” pede a partida: a aba atual salva, libera e passa a só exibir. Se a aba responsável fechar, outra aba visível continua sozinha; se travar, a posse expira em 6s. Cada gravação leva uma revisão (`rev`); uma aba que encontra revisão mais nova que a sua para de gravar. O tempo offline é aplicado uma única vez, pela aba responsável.
- Formato versionado (`v`, atual: 2), com migrações em `engine.js` (`MIGRATIONS`). **v1 → v2:** um ciclo manual em andamento passa a registrar as máquinas e o nível pagos (com os valores do salvamento, sem nova cobrança nem entrega dupla), e salvamentos sem revisão começam na revisão 0. Salvamentos v1 continuam carregando e importando normalmente.
- **Importação:** o conteúdo é validado numa cópia isolada (tipos, listas, campos obrigatórios, identificadores, enums e limites numéricos de regiões, instalações, especialistas, pesquisas, estoques, rotas, cargas, expedições, missões, projetos e ajustes) e depois executado numa simulação de ensaio. Campos opcionais ausentes recebem o padrão; estruturas incompatíveis são recusadas com mensagem compreensível. A partida só é trocada depois da confirmação; cancelar ou falhar mantém tudo como estava.
- Um salvamento inválido encontrado ao abrir o jogo é copiado para `helios_idle_save_corrompido_<data>` antes de qualquer gravação. Se nem a cópia for possível, o original fica protegido e o novo jogo não grava por cima.
- Exportar/importar em **Ajustes** (código `HELIOS1:…` ou arquivo `.txt`).
