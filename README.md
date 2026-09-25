# Prato do Dia — PWA final v27

Este pacote preserva a identidade visual original do **Plano Mestre Vida · Prato do Dia**, incluindo logo, cores, tipografia, layout, manifesto PWA e ícones compatíveis com Android. Os dados do usuário permanecem locais no dispositivo, em IndexedDB; não há envio de dados de saúde para um servidor.

## Conteúdo final

A aplicação inclui banco oficial separado em `assets/dados/alimentos.json` e `assets/dados/exercicios.json`, Service Worker para GitHub Pages, exportação/importação JSON e CSV, relatório PDF, lançamentos retroativos e edição de água e exercícios, medidas corporais, gráfico normalizado de evolução e navegação por gesto horizontal.

Na aba **Painel**, a sequência é: consumido hoje, gasto em exercício, meta do dia, falta para a meta, macros e micronutrientes, resumo semanal/mensal, alimentos × exercício, evolução corporal e composição corporal. Fibras, sódio e água ficam junto das barras de macronutrientes. O cartão de água é iniciado automaticamente e aparece como o primeiro item da aba **Alimentos**.

## Publicar no GitHub Pages pelo Android

No repositório `faustoima/gasto-calorico`, abra **Add file → Upload files**, selecione **todos os arquivos e pastas dentro desta pasta** e confirme a substituição dos arquivos existentes. O arquivo `index.html` precisa ficar na raiz do repositório; não envie a pasta externa `prato-do-dia-original` como um nível adicional.

Depois faça o commit na branch `main`. Em **Settings → Pages**, selecione `Deploy from a branch`, branch `main` e pasta `/ (root)`. Aguarde o GitHub concluir a publicação e acesse:

`https://faustoima.github.io/gasto-calorico/`

Arquivos essenciais: `index.html`, `assets/index-CZ9VoIu1.js`, `assets/index-CWVMaK0X.css`, `assets/pd-data.js`, `assets/dados/`, `manifest.webmanifest`, `sw.js`, os PNGs de ícone e `logo-plano-mestre.png`.

## Teste no Android

Abra o endereço publicado no Chrome do Android, não pelo visualizador de arquivos. Na primeira abertura, o app inicializa o cartão de água automaticamente mesmo quando a aba inicial é **Alimentos**. Toque em **Instalar**; quando o Chrome liberar o prompt, confirme a instalação. Se o prompt não aparecer, use `⋮ → Adicionar à tela inicial` ou `⋮ → Instalar aplicativo`, conforme a versão do Chrome.

Se aparecer uma tela preta ou uma versão antiga, publique novamente `sw.js`, abra as configurações do site no Chrome, exclua os dados do site e as permissões, feche todas as abas do endereço e abra-o novamente. O Service Worker usa cache versionado e reconhece o subdiretório `/gasto-calorico/` do GitHub Pages.

## Observações de uso

Novos usuários começam com perfil vazio. O peso mais recente define automaticamente a meta de água como peso × 35 ml, salvo quando uma meta manual é configurada no perfil. Medidas sem lançamento em determinada data mantêm o último valor conhecido no gráfico de evolução. Exportações e importações devem ser feitas pela aba **Perfil**; o relatório PDF é gerado a partir do painel e inclui as métricas corporais.

## Regra de preservação

Não substituir os arquivos oficiais de dados, o bundle JavaScript, o CSS, o manifesto ou o Service Worker por versões antigas. As fórmulas metabólicas e a identidade visual desta entrega devem ser mantidas.
