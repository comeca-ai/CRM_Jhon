# Relatório de testes

Data: 2026-10-29. Navegador: Chromium 141.0.7390.37 (headless, perfil temporário).
Artefato: `dist/decida-antes-chrome-0.2.0.zip (extraído), sha256 99d512cd4fcd1dd4c146aa62240f3181b85986fc44b9117cb483a16e94ba9c36`. Código: commit que adiciona a ligação com o Decida Antes.

## Resumo
| Conjunto | Resultado |
|---|---|
| Unitários (`npm test`) | 31 de 31 passaram |
| Ponta a ponta no Chromium (`npm run test:e2e`) | 22 de 22 passaram |
| Acessibilidade (axe-core, WCAG 2.1 A/AA) | sem violações graves ou críticas no painel, registro e configurações |
| Verificador do construtor | 1 erro falso positivo (regra sem distinção de maiúsculas casa `function(` no SDK empacotado; busca exata não acha `eval`, `new Function` nem import remoto) e 1 aviso de hosts amplos, que são opcionais e justificados |

## Desempenho medido
| Medida | Valor |
|---|---|
| Abertura do painel até pronto | 192 ms |
| Gerar tela com o gerador por regras | 61 ms |
| SDK da Anthropic carregado com o gerador por regras | não (carregado só quando o Claude é usado) |

Pacote: 196 KB compactado, dos quais 165 KB são a fonte Manrope; o SDK (347 KB) só é baixado do próprio pacote quando o gerador Claude é usado.

## Jornadas
| Jornada | Resultado |
|---|---|
| service worker configura abrir painel ao clicar no ícone | passou |
| telas base com dados de exemplo | passou |
| gera tela por linguagem natural (regras) | passou |
| kanban: arrastar negócio muda o estágio e registra na linha do tempo | passou |
| captura a página ativa como empresa (texto da página não vira HTML) | passou |
| captura sem acesso: explica, pede permissão num clique próprio e captura | passou |
| registro: editar campo e adicionar nota entram na linha do tempo | passou |
| aprendizado: após cliques, sugere reordenar e só muda com aceite | passou |
| schema dinâmico: novo campo aparece na tabela | passou |
| exportar JSON nunca inclui a chave da API | passou |
| gerador Claude: pedido estruturado, spec validada e campo inventado descartado | passou |
| gerador Claude: falha da API cai para regras com aviso | passou |
| menu de contexto: captura sem botão do painel abre o formulário | passou |
| configurações listam os sites com acesso | passou |
| backup malicioso é recusado e o armazenamento fica intacto | passou |
| estado corrompido mostra recuperação e restaura o exemplo | passou |
| aba cheia reflete o mesmo estado | passou |
| Decida Antes: conecta, envia captura como sinal, trata duplicata e login expirado | passou |
| acessibilidade (axe-core, WCAG 2.1 A/AA) no painel, registro e configurações | passou |
| tema escuro renderiza | passou |
| desempenho: abertura do painel e geração de tela | passou |
| sem erros de JavaScript nas páginas da extensão | passou |

## Limites desta evidência
- Painel lateral exercitado como página da extensão a 400 px; o painel nativo do Chrome não é aberto por automação.
- Origens http://127.0.0.1 e api.anthropic.com concedidas por manifesto de teste; o diálogo de permissão real não foi clicado.
- API da Anthropic simulada; nenhuma chamada real foi feita.
- Sem permissão, o Chrome real não mostra ao painel o endereço da aba, e o botão Capturar abre uma janela que pede acesso aos sites. No e2e, essa falha de acesso e a resposta do diálogo do Chrome são simuladas. O diálogo real e o item do menu de contexto clicado por uma pessoa precisam de teste manual; o e2e chama a mesma função do menu pelo service worker.
- Nenhuma chamada real à API da Anthropic foi feita.
- A plataforma Decida Antes foi simulada no formato do tRPC. O login real do Cloudflare Access e a gravação do sinal no banco da plataforma só podem ser conferidos no Chrome do usuário autenticado. Do lado da plataforma, a procedure tem testes próprios no repositório `comeca-ai/decidaantes`.

Capturas: `docs/screenshots/`. As de 01 a 11 e de 14 a 16 foram tiradas nesta execução; 12 e 13 vêm do teste da demo web.
