# Política de privacidade — CRM Generativo (extensão do Chrome)

Última atualização: 29/10/2026.

## O que a extensão guarda
Tudo no armazenamento local da extensão neste navegador (`chrome.storage.local`). A extensão não tem servidor próprio, conta, telemetria nem rastreamento. O único servidor que pode receber capturas é o do seu workspace Decida Antes, e só se você ligar o envio (veja abaixo).
- **Dados do CRM que você cria:** empresas, contatos (nome, cargo, e-mail), negócios, notas e telas.
- **Endereços das páginas capturadas:** guardados sem parâmetros (sem `?…` nem `#…`), para não registrar tokens ou rastreio.
- **Atividade de uso:** contagem de cliques em colunas, células e cartões, usada só para sugerir a ordem das colunas. Fica no navegador.
- **Chave da API da Anthropic (se você informar):** guardada em texto puro no armazenamento local da extensão, no seu perfil do Chrome.

A extensão não funciona em janelas anônimas.

## Leitura de páginas
Somente quando você clica em **Capturar página** (ou escolhe **Capturar esta página no CRM** no menu do botão direito), a extensão lê da aba ativa: endereço, título, descrição (meta tags), nome do site, texto que você selecionou e endereços de e-mail em links `mailto:`. Antes de salvar, você vê e pode editar tudo o que vai para o registro, inclusive a nota da captura. Nada é lido em segundo plano.

Acesso a sites: pelo menu do botão direito ou logo após abrir o painel pelo ícone, o acesso vale só para aquela aba naquele momento. Fora disso, o Chrome não mostra ao painel nem o endereço da aba, então o botão do painel pede, numa janela própria e com a sua confirmação, **leitura dos sites que você abrir**. Essa permissão continua valendo até você revogar em **Configurações → Sites com acesso** (ou em `chrome://extensions`), e mesmo com ela a leitura só acontece quando você clica em Capturar. Páginas internas do Chrome nunca são lidas, e nelas a extensão não pede acesso.

## Envio ao Decida Antes (opcional, desligado por padrão)
Se você ligar **Enviar capturas ao Decida Antes** nas configurações:
- a extensão pede permissão só para o endereço do seu workspace (`https://decidaantes.com.br` ou um subdomínio dele) e usa o login do Cloudflare Access que você já fez neste Chrome. Ela não guarda senha nem token;
- ao salvar uma captura, envia ao workspace o endereço da página (sem parâmetros), o título, a descrição, o nome do site, o texto selecionado, os e-mails `mailto:` encontrados, a sua nota e o nome da empresa ou do contato que você revisou. Lá, a captura vira um sinal novo com evidência, para validação humana;
- o botão **Hoje** lê do workspace os sinais a validar, as ações vencidas e as oportunidades abertas, só para mostrar no painel;
- o tratamento desses dados segue as regras do seu workspace Decida Antes.

## Gerador de telas com Claude (opcional, desligado por padrão)
Se você ligar o gerador Claude e informar sua chave da API da Anthropic:
- a chave fica só no armazenamento local da extensão e nunca entra no backup exportado;
- ao gerar uma tela, a extensão envia para `api.anthropic.com` o texto do seu pedido e a estrutura do seu CRM (nomes de objetos, campos e opções de lista). **Registros, notas e dados capturados não são enviados**;
- o uso da API segue os termos e a política de privacidade da Anthropic, na conta dona da chave.

## Compartilhamento
Nenhum dado é vendido, compartilhado ou usado para publicidade. Os únicos envios externos são os descritos acima, e só quando você liga o envio ao Decida Antes ou o gerador Claude.

## Seus controles
- **Exportar JSON** e **Importar JSON** nas configurações.
- **Restaurar exemplo** apaga seus dados, a chave da API e as preferências, e volta aos dados de exemplo.
- **Sites com acesso** lista e revoga as permissões de sites concedidas.
- Remover a extensão apaga todo o armazenamento local dela.

## Contato
Abra uma issue em https://github.com/comeca-ai/CRM_Jhon.
