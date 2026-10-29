# Especificação de interface

## Layout
- **Painel (até ~600 px):** cabeçalho (marca, botão "Capturar página", menu), faixa de telas em chips roláveis, área da tela, inspetor recolhível, barra de comando fixa no rodapé.
- **Aba cheia (≥ 900 px):** barra lateral com telas base e geradas, área central, inspetor fixo à direita (como o protótipo).

## Componentes fechados
`table`, `kanban`, `record` (gaveta), `capture` (folha), `settings` (folha). A IA só escolhe entre eles via spec.

## Estados
| Estado | Comportamento |
|---|---|
| Primeira execução | dados de exemplo com aviso "Dados de exemplo · limpar" |
| Sem registros | mensagem com ação "Capturar página" ou "Novo registro" |
| Gerando tela | botão desabilitado com "Gerando…", `aria-busy` |
| Erro do gerador Claude | aviso e queda para regras |
| Página sem permissão / página do Chrome | aviso explicando que a página não pode ser lida |
| Sugestão de aprendizado | faixa com "Aplicar" e "Agora não"; nada muda sem aceite |

## Acessibilidade
- Tudo operável por teclado; foco visível; Esc fecha gaveta/folhas e devolve o foco.
- Gaveta e folhas com `role="dialog"`, `aria-modal`, título rotulado.
- Linhas da tabela focáveis (Enter abre o registro); kanban com alternativa ao arrasto (campo Estágio no registro).
- Avisos em região `aria-live="polite"`.
- Contraste AA nos dois temas (claro/escuro seguem o sistema).
