# Prato do Dia — pacote visual original

Este pacote preserva a aparência original do arquivo `_bundle(3).zip`, incluindo a identidade Plano Mestre Vida, logo, cores, tipografia, layout, manifesto PWA e ícones PNG compatíveis com Android.

## Publicar no GitHub Pages pelo Android

No repositório `faustoima/gasto-calorico`, apague os arquivos antigos e envie **o conteúdo desta pasta diretamente para a raiz**. O arquivo `index.html` deve aparecer na primeira tela do repositório.

Arquivos essenciais:

- `index.html`
- `assets/index-CZ9VoIu1.js`
- `assets/index-CWVMaK0X.css`
- `manifest.webmanifest`
- `sw.js`
- os arquivos PNG de ícone
- `logo-plano-mestre.png`

Depois faça um commit direto na branch `main`.

## Instalação no Android

Abra `https://faustoima.github.io/gasto-calorico/` no Chrome, não no visualizador de arquivos. Use uma aba anônima ou limpe os dados do site antigo antes do teste. O app também oferece uma orientação de instalação dentro da própria interface. Se o Chrome não mostrar o prompt automático, use `⋮ → Adicionar à tela inicial`.

O prompt automático não aparece em todos os acessos: o Chrome pode ocultá-lo se o site já foi instalado, se o Service Worker antigo estiver preso no cache ou se o navegador ainda não considerar o site como visitado o suficiente.

## Se aparecer apenas uma tela preta

Isso significa que o Android ainda está usando o Service Worker antigo. Publique novamente o `sw.js` desta entrega, aguarde alguns minutos, abra o site no Chrome, entre em **Configurações do site → Excluir dados e redefinir permissões**, feche todas as abas do endereço, abra o site novamente e atualize duas vezes. O Service Worker desta versão usa cache `v6` e reconhece corretamente o caminho do GitHub Pages (`/gasto-calorico/port/5000/api/...`).
