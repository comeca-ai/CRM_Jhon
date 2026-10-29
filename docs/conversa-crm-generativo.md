# Conversa — CRM Generativo (Jhonata × Claude)

**Data:** 29/10/2026
**Contexto:** Jhonata estava criando uma conta no Attio (app.attio.com) e, a partir daí, a conversa evoluiu para a criação de um CRM próprio com telas geradas por IA.

---

## 1. Vale a pena o Attio?

**Jhonata:** Você acha que vale a pena esse CRM?

**Claude:** Panorama do Attio:

- **Pontos fortes:** CRM moderno, rápido e flexível — modelo de dados customizável (objetos e atributos, estilo Notion), enriquecimento automático de contatos via e-mail/calendário sincronizados, UX elogiada. Queridinho de startups e empresas B2B de tech, perfil parecido com o da Datarisk.
- **Preço:** plano gratuito (até 3 usuários, limitado); pagos em torno de US$ 29–34/usuário/mês (Plus) e US$ 69 (Pro), Enterprise acima.
- **Pontos fracos:** relatórios e forecasting menos maduros que HubSpot/Salesforce, ecossistema de integrações menor, sem telefonia nativa, sem suporte em português / presença no Brasil.
- **Leitura final:** para time de vendas B2B enxuto, com processo próprio e confortável com inglês, vale testar (o free plan permite validar sem custo). Para automação de marketing pesada, relatórios complexos ou suporte local, HubSpot ou RD Station fazem mais sentido.

Fontes: Stacksync (review 2026), Capterra, MarketBetter (pricing 2026).

---

## 2. A ideia: um CRM que aprende e escreve as próprias telas

**Jhonata:** Minha ideia é fazer algo parecido, mas customizado — vai aprendendo a escrever as telas.

**Claude:** Generative UI sobre um modelo de dados flexível. Pontos para decidir cedo:

1. **O que é fixo vs. gerado** — sistemas 100% gerados ficam imprevisíveis. O padrão que funciona: design system fechado (tabela, kanban, timeline, formulário) e a IA só compõe layouts e queries, nunca escrevendo HTML/CSS livre em produção.
2. **Onde mora o aprendizado** — do simples (observar quais campos o usuário usa e reordenar) ao completo (usuário pede em linguagem natural "visão de pipeline por analista" e a tela nasce na hora).
3. **Dados primeiro** — schema flexível (EAV ou JSON + metadados) com introspecção: a IA precisa saber quais objetos e campos existem para desenhar algo coerente.

---

## 3. Granola para reuniões

**Jhonata:** Quando ele [Attio] perguntou se podemos gravar reuniões — a gente pode integrar com o Granola MCP.

**Claude:** Anotado no roadmap e na arquitetura: em vez de construir gravação própria, o CRM age como cliente MCP do Granola — reunião termina, resumo e transcrição entram na timeline do registro certo (empresa/negócio) e alimentam o campo "próximo passo". O mesmo padrão serve depois para e-mail, calendário e WhatsApp.

---

## 4. Código gerado

**Jhonata:** Vai gerando código. / Pode começar a escrever nesse GitHub: https://github.com/comeca-ai/CRM_Jhon

**Claude:** Protótipo funcional criado e publicado como artifact (**CRM Generativo**), com:

- **Schema dinâmico** — objetos (Empresas, Contatos, Negócios) e atributos definidos como dados;
- **Telas como specs JSON** — cada view é `{type, object, columns, groupBy, filter, sort}` renderizada por componentes fixos (tabela, kanban, record page com timeline);
- **Gerador de telas** — barra de comando em linguagem natural ("kanban de negócios por responsável", "negócios abertos acima de 150 mil") que compõe a spec na hora; no protótipo é um parser por regras, no produto real entra um LLM devolvendo o mesmo formato;
- **Aprendizado de uso** — cada clique vira sinal de telemetria; o inspetor mostra os campos mais usados e o botão "Aplicar aprendizado" reordena as colunas pelo uso real;
- **Inspetor de spec** — mostra o JSON da tela ativa, deixando visível o que a IA gerou.

Estrutura preparada para o repositório:

```
CRM_Jhon/
├── README.md               # visão, conceito, roadmap (incl. Granola MCP)
├── docs/arquitetura.md     # schema dinâmico, view specs, geração com LLM, aprendizado, MCP
├── prototype/crm-generativo.html   # protótipo standalone, sem dependências
└── specs/                  # exemplos de view spec (kanban e tabela)
```

---

## 5. O bloqueio do GitHub

O commit foi feito localmente, mas o **push foi recusado**: o ambiente desta sessão só autoriza repositórios registrados como fonte da sessão, e `comeca-ai/CRM_Jhon` não está nessa lista (a permissão dada no GitHub não resolve — o bloqueio é do ambiente, e este painel não tem opção de registrar repositório).

**Jhonata:** Gera uma chave SSH sua para eu pôr para você fazer deploy no repo.

**Claude:** Testado e descartado: este ambiente só fala HTTPS através de um proxy controlado — conexões SSH com o GitHub não completam (porta 22 não entrega tráfego SSH e a porta 443 SSH é bloqueada). Uma deploy key nunca funcionaria daqui. Token pessoal pelo chat também não é recomendável (fica exposto em texto plano e o mesmo proxy controla as credenciais HTTPS).

**Caminhos que funcionam:**

1. **Imediato:** descompactar o `CRM_Jhon.zip` entregue na conversa e subir via "Add file → Upload files" na página do repositório (ou git local).
2. **Fluxo contínuo:** abrir uma sessão em **claude.ai/code** com `comeca-ai/CRM_Jhon` conectado como repositório da sessão — lá o Claude commita e faz push diretamente.

---

## 6. Estado final e próximos passos

**Entregue:**

- Protótipo interativo publicado (artifact "CRM Generativo");
- `CRM_Jhon.zip` com todo o conteúdo do repositório, pronto para upload;
- Commit local preparado com mensagem descritiva.

**Roadmap registrado no README:**

- Backend com schema dinâmico (Postgres + JSONB ou EAV) e API de introspecção;
- Gerador de telas com LLM (substituindo o parser por regras), com validação de spec contra o schema;
- Loop de aprendizado persistente (telemetria → sugestões de layout → aceite do usuário);
- Integração Granola via MCP (reuniões → timeline + "próximo passo");
- Sincronização de e-mail/calendário para enriquecimento de contatos;
- Permissões por workspace e multiusuário.

**Pendências:**

- Subir o código no `comeca-ai/CRM_Jhon` (upload manual ou sessão no claude.ai/code);
- Capturar as telas do Attio como referência visual (a ponte com o Chrome esteve indisponível durante a conversa).
