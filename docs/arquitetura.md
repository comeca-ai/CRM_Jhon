# Arquitetura — telas geradas e aprendidas

## 1. Schema dinâmico

Objetos e atributos são registros, não tabelas fixas:

```json
{
  "object": "deals",
  "label": "Negócios",
  "fields": [
    { "id": "name",    "label": "Negócio",     "type": "text"  },
    { "id": "valor",   "label": "Valor (R$)",  "type": "money" },
    { "id": "estagio", "label": "Estágio",     "type": "stage" },
    { "id": "owner",   "label": "Responsável", "type": "user"  }
  ]
}
```

O gerador de telas **introspecta** esse schema antes de compor qualquer view — ele só referencia objetos e campos que existem.

## 2. Telas como dados (view specs)

Uma tela é uma spec declarativa, nunca código:

```json
{
  "id": "v-gen-173...",
  "title": "Negócios abertos acima de 150 mil",
  "object": "deals",
  "type": "table",
  "columns": ["name", "empresa", "valor", "estagio", "owner"],
  "filter": { "field": "valor", "op": ">=", "value": 150000 },
  "sort": { "field": "valor", "dir": "desc" }
}
```

O renderer é um conjunto fechado de componentes (`table`, `kanban`, `record`). Vantagens: specs são versionáveis, auditáveis, validáveis contra o schema, e o LLM não pode quebrar o layout nem injetar código.

## 3. Geração (onde entra o LLM)

```
prompt do usuário ──► LLM (recebe schema + exemplos de spec) ──► spec JSON
                                                                    │
                                              validador de spec ◄───┘
                                                    │
                                      renderer (componentes fixos)
```

No protótipo, o LLM é simulado por um parser de regras (`generateView()` em `prototype/crm-generativo.html`). A interface de saída é idêntica, então a troca é pontual.

## 4. Aprendizado

Telemetria mínima por campo: `{ "deals.valor": 14, "deals.estagio": 9, ... }` acumulada a cada interação (clique, ordenação, edição). Usos:

- reordenar colunas e campos da record page pelo uso real;
- sugerir novas views ("você filtra por responsável toda segunda — quer uma tela fixa disso?");
- alimentar o contexto do LLM na próxima geração de tela.

Princípio: o sistema **propõe**, o usuário aceita — mudanças de layout nunca acontecem silenciosamente.

## 5. Integrações via MCP

O CRM age como cliente MCP. Primeira integração planejada: **Granola** (notas/gravações de reunião):

- reunião termina no Granola → resumo e transcrição chegam via MCP;
- matching por participantes/empresa → evento na timeline do registro certo;
- extração de "próximos passos" da reunião → sugestão de atualização do campo `proximo` do negócio.

O mesmo padrão serve para e-mail, calendário e WhatsApp depois.
