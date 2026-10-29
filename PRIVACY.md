# Política de privacidade — CRM Generativo (extensão do Chrome)

Última atualização: 29/10/2026.

## O que a extensão guarda
Tudo no armazenamento local da extensão neste navegador (`chrome.storage.local`). Não há servidor do CRM Generativo, conta, telemetria nem rastreamento.
- **Dados do CRM que você cria:** empresas, contatos (nome, cargo, e-mail), negócios, notas e telas.
- **Endereços das páginas capturadas:** guardados sem parâmetros (sem `?…` nem `#…`), para não registrar tokens ou rastreio.
- **Atividade de uso:** contagem de cliques em colunas, células e cartões, usada só para sugerir a ordem das colunas. Fica no navegador.
- **Chave da API da Anthropic (se você informar):** guardada em texto puro no armazenamento local da extensão, no seu perfil do Chrome.

A extensão não funciona em janelas anônimas.

## Leitura de páginas
Somente quando você clica em **Capturar página** (ou escolhe **Capturar esta página no CRM** no menu do botão direito), a extensão lê da aba ativa: endereço, título, descrição (meta tags), nome do site, texto que você selecionou e endereços de e-mail em links `mailto:`. Antes de salvar, você vê e pode editar tudo o que vai para o registro, inclusive a nota da captura. Nada é lido em segundo plano.

Acesso a sites: pelo menu do botão direito ou logo após abrir o painel pelo ícone, o acesso vale só para aquela aba naquele momento. Se o botão do painel precisar pedir acesso a um site, o Chrome pergunta, e **essa permissão continua valendo** até você revogar em **Configurações → Sites com acesso** (ou em `chrome://extensions`).

## Gerador de telas com Claude (opcional, desligado por padrão)
Se você ligar o gerador Claude e informar sua chave da API da Anthropic:
- a chave fica só no armazenamento local da extensão e nunca entra no backup exportado;
- ao gerar uma tela, a extensão envia para `api.anthropic.com` o texto do seu pedido e a estrutura do seu CRM (nomes de objetos, campos e opções de lista). **Registros, notas e dados capturados não são enviados**;
- o uso da API segue os termos e a política de privacidade da Anthropic, na conta dona da chave.

## Compartilhamento
Nenhum dado é vendido, compartilhado ou usado para publicidade. O único envio externo é o descrito acima, e só quando você liga o gerador Claude.

## Seus controles
- **Exportar JSON** e **Importar JSON** nas configurações.
- **Restaurar exemplo** apaga seus dados, a chave da API e as preferências, e volta aos dados de exemplo.
- **Sites com acesso** lista e revoga as permissões de sites concedidas.
- Remover a extensão apaga todo o armazenamento local dela.

## Contato
Abra uma issue em https://github.com/comeca-ai/CRM_Jhon.
