# HELIOS IDLE — versão aplicativo (Android com Capacitor)

A versão web continua na raiz do projeto e não depende do aplicativo. O aplicativo é uma casca Capacitor em `app/` que empacota uma cópia dos arquivos web (`app/www`, gerada por script).

> Estado: a integração está preparada e foi verificada no navegador (sem Capacitor ela não interfere). **A geração do APK e o teste em celular real ainda não foram feitos** — exigem Node, Android Studio e um aparelho ou emulador. A publicação em lojas está fora desta etapa.

## O que já está pronto

| Item | Onde | Como funciona |
|---|---|---|
| Arquivos distribuídos | `tools/preparar-app.js` → `app/www` | Copia `index.html`, `css/`, `js/` e as imagens de `assets/` (sem prévias, galerias e textos de prompt). Lista em `app/www/arquivos-do-app.txt`. |
| Configuração | `app/capacitor.config.json`, `app/package.json` | `webDir: "www"`, id provisório `com.heliosidle.app` (troque antes de publicar). Plugins: App e Preferences. |
| Segundo plano | `js/app-bridge.js` + `H.lifecycle` em `js/main.js` | Ao sair: contabiliza o tempo pendente e salva. Ao voltar: o laço normal aplica o tempo ausente como offline (limite do jogo), uma única vez. Não há execução em segundo plano. |
| Botão Voltar | `js/app-bridge.js` | Fecha o painel aberto (exceto os obrigatórios); fora da tela da região, volta para ela; na região, salva e minimiza o app. |
| Armazenamento persistente | `js/app-bridge.js` | O jogo continua salvando no `localStorage` do WebView (mesmo código da web, com revisão e posse entre abas). Cada gravação é espelhada no armazenamento nativo (Capacitor Preferences). Ao abrir, se o espelho tiver revisão mais nova **e** for um save válido, ele é restaurado antes do início (o que havia é guardado em `helios_idle_save_antes_restauracao_<data>`). |
| Migração do save atual | automática | Na primeira abertura não há espelho: o save do `localStorage` continua sendo usado e vira a primeira cópia nativa. Nada é apagado. |
| Áreas seguras e teclado | `css/style.css`, `index.html` | `viewport-fit=cover`, `env(safe-area-inset-*)` e `interactive-widget=resizes-content`; a navegação inferior some enquanto um campo de texto está em uso. |

## Dependências externas (sem internet)

- **Fonte Exo 2 (Google Fonts):** é a única dependência externa. O `preparar-app.js` remove o link; sem a fonte, o jogo usa a fonte do sistema. Para incluir a Exo 2 (licença OFL), coloque os arquivos `.woff2` em `assets/fonts/` com o peso no nome (ex.: `exo2-400.woff2`, `exo2-700.woff2`) e rode o script de novo — ele gera o `@font-face` local.
- Imagens, sons (gerados por Web Audio) e todo o código já são locais.
- O salvamento em pasta (`js/folder-save.js`) usa a API de arquivos do navegador, que não existe no WebView do Android: no aplicativo, use Exportar/Importar em Ajustes (ou, numa etapa futura, o plugin Filesystem do Capacitor).

## Gerar e testar no Android

Pré-requisitos: Node 18+, Android Studio (com SDK e um emulador ou aparelho com depuração USB).

```bash
cd app
npm install
node ../tools/preparar-app.js
npx cap add android
npx cap sync android
npx cap open android
```

No Android Studio, rode no emulador ou no aparelho. Depois de mudar o jogo, repita `node ../tools/preparar-app.js` e `npx cap sync android`.

Fixe as versões do Capacitor no `app/package.json` depois do primeiro `npm install` (hoje estão como `latest`).

## Roteiro de teste no celular

1. Abrir, criar o comandante, jogar alguns minutos; fechar o app pelo gerenciador de tarefas; abrir de novo: o progresso continua.
2. Ir para o segundo plano por 10 minutos e voltar: aparece o relatório offline com ~10 minutos; voltar de novo logo depois não credita outra vez.
3. Botão Voltar: com um painel aberto, fecha o painel; em Pesquisa, volta para a Região; na Região, minimiza.
4. Rotação e teclado: digitar o nome do comandante e o código de importação sem a navegação cobrir o campo.
5. Áreas seguras: nada encoberto pelo entalhe ou pela barra de gestos.
6. Limpar o armazenamento do WebView (ou reinstalar mantendo dados) e verificar a restauração a partir do espelho nativo.
7. Desempenho: as imagens somam ~104 MB. Converter os PNG para WebP deve reduzir bastante o tamanho do APK.
