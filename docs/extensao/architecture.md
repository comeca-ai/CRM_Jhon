# Arquitetura da extensão (ADR-001)

## Decisão
Extensão Manifest V3, modo **local**, sem build obrigatório: módulos ES puros em `extension/src`. A única dependência empacotada é o SDK oficial da Anthropic (`extension/src/vendor/anthropic.js`, gerado por `npm run vendor`), usado só quando o usuário liga o gerador Claude.

## Contextos de execução
| Contexto | Arquivo | Papel |
|---|---|---|
| Service worker | `src/sw.js` | instala dados de exemplo na primeira execução; abre o painel ao clicar no ícone |
| Painel lateral | `src/app.html` | UI principal (estreita) |
| Aba cheia | `src/app.html?surface=tab` | mesma UI com barra lateral e inspetor visíveis |
| Script injetado sob demanda | `src/core/capture.js` (`extractPageInfo`) | lê metadados da página ativa só quando o usuário clica em "Capturar página" |

Não há content script permanente nem mensagens entre páginas e extensão: a função injetada só retorna dados, e o painel trata o retorno como não confiável (texto, nunca HTML).

Fluxo de captura: o botão do painel tenta ler a página com o acesso que já existe e só pede a origem ao Chrome se faltar acesso (permissão que persiste; revogável em Configurações). O menu de contexto chama o service worker, que lê a página com activeTab e entrega o resultado ao painel por `chrome.storage.session`. A URL é guardada sem query nem fragmento.

Endurecimento: CSP `connect-src 'self' https://api.anthropic.com`, `incognito: not_allowed`, importação e estado salvo validados por completo em `core/validate-state.js` (com tela de recuperação se o armazenamento estiver corrompido).

## Dados (`chrome.storage.local`)
| Chave | Conteúdo |
|---|---|
| `crm.schema` | objetos e campos (schema dinâmico) |
| `crm.records` | `{companies:[], people:[], deals:[]}` com linha do tempo por registro |
| `crm.views` | specs de tela (base + geradas) |
| `crm.usage` | contagem de uso por `objeto.campo` |
| `crm.settings` | gerador escolhido, modelo, chave do usuário (só local), dispensas de sugestão |

## Permissões
| Permissão | Por quê |
|---|---|
| `storage` | guardar o CRM no próprio navegador |
| `sidePanel` | painel lateral |
| `scripting` + `activeTab` | ler título/URL/descrição da página quando o usuário pede a captura |
| `contextMenus` | "Capturar esta página no CRM": concede activeTab só àquela aba, sem acesso permanente |
| `optional_host_permissions` `https://*/*`, `http://*/*` | pedidas por origem no clique de captura, e para `api.anthropic.com` ao ligar o gerador Claude |

## Contrato da spec de tela
```json
{ "id": "v-…", "title": "…", "object": "deals", "type": "table|kanban",
  "columns": ["name", "valor"], "groupBy": "estagio", "card": ["name","valor"],
  "filter": { "field": "valor", "op": ">=", "value": 150000 },
  "sort": { "field": "valor", "dir": "desc" }, "generated": true, "generator": "rules|claude", "prompt": "…" }
```
`validateSpec(spec, schema)` em `src/core/spec.js` é a única porta de entrada: remove chaves desconhecidas, recusa objeto/campo inexistente, operador inválido e tipos errados. Vale para o gerador por regras, para o Claude e para importação.

## Gerador Claude
- SDK `@anthropic-ai/sdk` no navegador (`dangerouslyAllowBrowser: true`), chave do usuário guardada só em `chrome.storage.local`.
- Modelo padrão `claude-opus-5-5`, `effort: low`, saída estruturada (`output_config.format` com JSON Schema), fallback de recusa do lado do servidor (`fallbacks: "default"`).
- O prompt leva o schema introspectado e exemplos; a resposta passa pelo mesmo `validateSpec`. Falha de rede, recusa ou spec inválida caem para o gerador por regras com aviso.

## Fora de escopo nesta fase
Backend/sincronização, multiusuário, integração Granola via MCP, e-mail/calendário. Ficam no roadmap do README.
