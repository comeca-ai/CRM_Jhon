# Revisão de segurança, privacidade e permissões

Data: 29/10/2026. Revisor: agente independente (papel security-reviewer), que leu o código e o pacote sem acesso às conclusões do implementador e reproduziu os achados no Chromium. O implementador aplicou as correções abaixo; a reverificação foi feita pelos testes automatizados listados, não por uma segunda rodada do revisor.

## Achados e estado

| Nível | Achado | Estado | Evidência |
|---|---|---|---|
| Alto | Backup malicioso (schema vazio ou objeto herdado como `constructor`) travava o app de forma permanente | Corrigido: `core/validate-state.js` valida o estado inteiro antes de gravar; `Object.hasOwn` no validador; importação com Desfazer; tela de recuperação se o armazenamento estiver inválido | Testes unitários de importação; e2e "backup malicioso é recusado…" e "estado corrompido mostra recuperação…" |
| Médio | Fluxo de permissão da captura pedia acesso permanente sem necessidade e o caso "sem URL" não funcionava | Corrigido: tenta ler primeiro, só pede a origem se faltar acesso; item de menu de contexto (activeTab sem acesso permanente); lista "Sites com acesso" com revogar; checagem de origem do resultado | e2e "menu de contexto…" e "configurações listam os sites…". **Pendente:** teste manual do diálogo real de permissão (não automatizável) |
| Médio | Declaração de dados da loja e política incompletas | Corrigido: `PRIVACY.md` e `docs/release/store-listing.md` declaram chave da API, atividade de uso, URLs capturadas e persistência das permissões | Revisão de texto |
| Baixo | Backup ligava o gerador Claude e trocava o modelo | Corrigido: importação não traz configurações | Teste unitário "importação válida devolve estado limpo…" |
| Baixo | `mailto:` malformado derrubava a captura | Corrigido: try/catch por e-mail, cortes dentro da página | e2e (fixture com `mailto:%E0%A4%A`) |
| Baixo | URL completa (com tokens) e nota não revisada | Corrigido: URL sem query/fragmento; nota da captura visível e editável no formulário | Teste unitário "captura remove query…"; e2e |
| Baixo | Chave da API como atributo do DOM | Corrigido: `value` sempre como propriedade em `dom.js` | Revisão de código |
| Baixo | `id` externo aceito no validador | Corrigido: gerador sempre cria id; importação desduplica | Teste unitário "…desduplica ids" |
| Baixo | CSP e incógnito | Corrigido: `connect-src 'self' https://api.anthropic.com`; `incognito: not_allowed` | Manifesto |
| Info | `h()` aceitava `on*` como string | Corrigido: handler não-função lança erro | Revisão de código |

## Verificado sem problema (pelo revisor)
Nenhum caminho de dado da página ou do backup vira HTML/código (sem `innerHTML` e equivalentes no app); sem content scripts, mensagens externas ou recursos expostos; saída do modelo limitada por JSON Schema estrito e reconstruída pelo validador; chave fora do backup e só enviada a `api.anthropic.com`; SDK empacotado sem `eval`, `new Function` ou import remoto.

## Premissas ainda não verificadas
- Se abrir o painel pelo ícone concede activeTab no Chrome estável (afeta só quantas vezes o diálogo de permissão aparece).
- Chamada real à API da Anthropic (todos os testes usam resposta simulada).
