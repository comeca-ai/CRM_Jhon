# Pesquisa — CRM Generativo como extensão do Chrome

Data: 29/10/2026. Fontes: conversa registrada em `conversa-crm-generativo.md` (avaliação do Attio) e o protótipo `prototype/crm-generativo.html`.

## Problema
Quem vende B2B passa o dia no navegador (site da empresa, LinkedIn, e-mail) e o CRM fica em outra aba. Registrar um lead custa copiar e colar. O Attio resolve parte disso com extensão própria, mas tem telas fixas e não fala português.

## Propósito único
Registrar empresas, contatos e negócios a partir da página aberta e montar as telas do CRM descrevendo-as em português, tudo no painel lateral do Chrome.

## Usuários
- Primário: vendedor/analista B2B (perfil Datarisk), que prospecta pelo navegador.
- Secundário: gestor que quer visões rápidas ("negócios abertos acima de 150 mil").

## Alternativas observadas
| Opção | Ponto forte | Lacuna para este caso |
|---|---|---|
| Attio + extensão | modelo de dados flexível, captura do LinkedIn | telas fixas, sem português, preço por usuário |
| HubSpot Sales (extensão) | captura de e-mail, ecossistema | pesado, telas fixas |
| Planilha | flexível | sem captura, sem telas |

## Viabilidade (Manifest V3)
- Painel lateral (`chrome.sidePanel`) comporta a UI inteira; aba cheia reaproveita o mesmo código.
- Captura sob demanda com `scripting.executeScript` + permissão de origem pedida no clique (`optional_host_permissions`), sem script fixo em todas as páginas.
- Dados locais em `chrome.storage.local` (modo local; backend é a próxima fase do roadmap).
- IA: gerador por regras como padrão. Gerador opcional com Claude usando a chave do próprio usuário; a saída é uma spec JSON validada contra o schema e nunca código.

## Jornadas de aceite
1. Abrir o painel lateral e ver as telas base (Empresas, Pipeline, Contatos) com dados de exemplo.
2. Digitar "negócios abertos acima de 150 mil" e receber uma tabela filtrada, salva como tela gerada.
3. Em um site de empresa, clicar "Capturar página", revisar o formulário pré-preenchido e salvar; o registro aparece com evento "capturado de <url>" na linha do tempo.
4. Abrir um registro, editar um campo e adicionar nota; ambos entram na linha do tempo.
5. Mover um negócio de estágio no kanban (arrastando ou pelo registro).
6. Depois de alguns cliques, aceitar a sugestão "reordenar colunas pelo seu uso".
7. Criar um campo novo em um objeto (schema dinâmico) e vê-lo na tela.
8. Exportar e importar os dados em JSON.
9. (Opcional) Ligar o gerador Claude, gerar uma tela e ver a spec validada no inspetor.
