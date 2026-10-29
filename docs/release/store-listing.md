# Ficha da Chrome Web Store (rascunho)

**Nome:** CRM Generativo
**Resumo (até 132 caracteres):** CRM no painel lateral: capture empresas e contatos da página aberta e crie telas descrevendo-as em português.
**Categoria:** Produtividade (Ferramentas de trabalho)
**Idioma:** Português (Brasil)

## Descrição
Registre leads sem sair da página. No site de uma empresa ou num perfil, clique em "Capturar página": o formulário vem preenchido e o registro guarda de onde veio.

Monte as telas do seu CRM pedindo em português: "negócios abertos acima de 150 mil", "kanban de contatos por responsável". Cada tela é uma definição validada contra os seus campos, desenhada por componentes fixos. Opcionalmente, use o Claude com a sua chave da API para entender pedidos mais livres.

- Empresas, contatos e negócios com campos que você cria
- Kanban com arrastar e soltar, tabela com ordenação
- Notas e linha do tempo por registro
- Sugestões de layout a partir do seu uso, aplicadas só com o seu aceite
- Dados locais no navegador, exportação e importação em JSON

## Justificativa das permissões (formulário da loja)
| Permissão | Justificativa |
|---|---|
| storage | Guardar o CRM do usuário localmente. |
| sidePanel | A interface do produto é o painel lateral. |
| activeTab, scripting | Ler título, URL, descrição, seleção e e-mails mailto da aba ativa quando o usuário clica em "Capturar página". |
| contextMenus | Item "Capturar esta página no CRM", que concede acesso só àquela aba, sem permissão permanente. |
| Hosts opcionais (https://*/*, http://*/*) | O usuário captura sites de qualquer empresa. Sem a permissão "tabs", o painel não vê o endereço da aba, por isso o acesso é pedido para os sites em geral, numa janela explicativa e só depois do clique de confirmação; nunca em páginas internas do Chrome. A leitura só acontece no clique em Capturar. Os mesmos hosts opcionais cobrem api.anthropic.com, pedido só ao ligar o gerador Claude, e o workspace Decida Antes (https://decidaantes.com.br), pedido só ao ligar o envio de capturas. |

**Código remoto:** não. Todo o código está no pacote, incluindo o SDK da Anthropic empacotado.
**Uso de dados (formulário), marcar:**
- Informações de identificação pessoal: nome, cargo e e-mail de contatos que o usuário salva.
- Informações de autenticação: a chave da API da Anthropic, quando informada (local, texto puro).
- Atividade do usuário: contagem de cliques em colunas, células e cartões (sugestão de layout, local).
- Histórico da web: endereços (sem parâmetros) das páginas que o usuário captura.
- Conteúdo do site: título, descrição, seleção e e-mails mailto da página capturada.
- Transferência: só para o workspace Decida Antes do próprio usuário, quando ele liga o envio de capturas.

Tudo sob ação do usuário e armazenado localmente; o único envio externo é o pedido de tela e a estrutura do CRM para api.anthropic.com quando o usuário liga o gerador Claude. Não vendido, não usado para publicidade nem para fins alheios ao propósito único. Política: `PRIVACY.md`.

## Pendências para publicar (fora deste repositório)
- Conta de desenvolvedor da Chrome Web Store e verificação.
- URL pública da política de privacidade (ex.: `PRIVACY.md` publicado no GitHub Pages).
- Capturas 1280×800 (as de `docs/screenshots/09-tela-cheia.png` servem de base) e ícone promocional 440×280.
- Revisão da loja. Nada disso foi feito; o pacote está pronto para envio.
