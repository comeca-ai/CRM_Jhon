# Relatório de testes

Data: 2026-10-29. Navegador: Chromium 141.0.7390.37 (headless, perfil temporário).
Artefato: `dist/crm-generativo-0.1.0.zip (extraído), sha256 93bf01aad45209ab6d67e15105553a08d03d46fa6752ab4485e5bc4aaaf862a7`. Commit do código: `07f3251`.

## Resumo
| Conjunto | Resultado |
|---|---|
| Unitários (`npm test`) | 23 de 23 passaram |
| Ponta a ponta no Chromium (`npm run test:e2e`) | 20 de 20 passaram |
| Acessibilidade (axe-core, WCAG 2.1 A/AA) | sem violações graves ou críticas no painel, registro e configurações |
| Verificador do construtor | 1 erro falso positivo (regra sem distinção de maiúsculas casa `function(` no SDK empacotado; busca exata não acha `eval`, `new Function` nem import remoto) e 1 aviso de hosts amplos, que são opcionais e justificados |

## Desempenho medido
| Medida | Valor |
|---|---|
| Abertura do painel até pronto | 135 ms |
| Gerar tela com o gerador por regras | 87 ms |
| SDK da Anthropic carregado com o gerador por regras | não (carregado só quando o Claude é usado) |

Pacote: 117 KB compactado; o SDK (347 KB) só é baixado do próprio pacote quando o gerador Claude é usado.

## Jornadas
| Jornada | Resultado |
|---|---|
| service worker configura abrir painel ao clicar no ícone | passou |
| telas base com dados de exemplo | passou |
| gera tela por linguagem natural (regras) | passou |
| kanban: arrastar negócio muda o estágio e registra na linha do tempo | passou |
| captura a página ativa como empresa (texto da página não vira HTML) | passou |
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
| acessibilidade (axe-core, WCAG 2.1 A/AA) no painel, registro e configurações | passou |
| tema escuro renderiza | passou |
| desempenho: abertura do painel e geração de tela | passou |
| sem erros de JavaScript nas páginas da extensão | passou |

## Limites desta evidência
- Painel lateral exercitado como página da extensão a 400 px; o painel nativo do Chrome não é aberto por automação.
- Origens http://127.0.0.1 e api.anthropic.com concedidas por manifesto de teste; o diálogo de permissão real não foi clicado.
- API da Anthropic simulada; nenhuma chamada real foi feita.
- O diálogo real de permissão do Chrome (botão do painel pedindo acesso a um site) e o item do menu de contexto clicado por uma pessoa precisam de teste manual; o e2e chama a mesma função do menu pelo service worker.
- Nenhuma chamada real à API da Anthropic foi feita.

Capturas: `docs/screenshots/` (01 a 11), tiradas desta execução.
