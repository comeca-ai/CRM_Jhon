# Decida Antes para Chrome (CRM_Jhon)

> Desde a versão 0.2.0, esta extensão é a companheira de navegador do **Decida Antes** (`comeca-ai/decidaantes`): mesma marca, mesmo login (Cloudflare Access) e a mesma regra. Toda captura vira um **sinal com evidência** para validação humana, como as integrações e, depois, o MCP. O CRM local continua funcionando como modo de demonstração e uso sem plataforma. Este repositório guarda a origem do projeto, o CRM Generativo.

CRM no estilo Attio, mas com uma diferença central: **as telas não são fixas — a IA escreve e evolui as telas** conforme aprende como o time usa o sistema.

## Conceito

Três camadas:

1. **Schema dinâmico** — objetos (Empresas, Contatos, Negócios…) e seus atributos são dados, não código. Novos campos e objetos podem ser criados em runtime, como no Attio.
2. **Telas como specs JSON** — nenhuma tela é HTML escrito à mão. Cada view é uma definição declarativa (`type`, `object`, `columns`, `groupBy`, `filter`, `sort`) renderizada por um conjunto fechado de componentes (tabela, kanban, record page). A IA compõe specs; ela nunca escreve HTML/CSS livre em produção — isso mantém o sistema previsível e seguro.
3. **Geração + aprendizado** — o usuário descreve uma tela em linguagem natural ("kanban de negócios por responsável") e a spec nasce na hora. Cada interação (clique em célula, ordenação, abertura de registro) vira sinal de telemetria; o sistema aprende quais campos importam e reotimiza as telas.

## Extensão do Chrome (novo)

`extension/` é o CRM funcionando como extensão do Chrome (Manifest V3), no painel lateral:

- **Capturar página:** no site de uma empresa ou num perfil do LinkedIn, um clique abre o formulário já preenchido (nome, site, cargo, e-mails da página) e o registro nasce com o evento "capturado de <url>" na linha do tempo.
- **Telas por linguagem natural:** "negócios abertos acima de 150 mil", "kanban de contatos por responsável", "empresas clientes". Cada pedido vira uma spec JSON validada contra o schema e desenhada por componentes fixos.
- **Gerador Claude (opcional):** com a sua chave da API da Anthropic, o Claude compõe a spec via saída estruturada. Falha, recusa ou campo inventado são tratados; sem chave, o gerador por regras funciona offline.
- **Registro:** edição campo a campo, notas e linha do tempo; kanban com arrastar e soltar.
- **Aprendizado:** cada clique vira sinal; o CRM propõe reordenar colunas e só muda com o seu aceite.
- **Schema dinâmico:** crie campos novos (texto, número, dinheiro, lista, data, link…) em qualquer objeto.
- **Dados locais:** tudo em `chrome.storage.local`, com exportação/importação em JSON (a chave da API nunca entra no backup).

### Instalar para testar

**Baixar:** [decida-antes-chrome-0.2.0.zip](https://github.com/comeca-ai/CRM_Jhon/releases/latest/download/decida-antes-chrome-0.2.0.zip), ou veja todas as versões em [Releases](https://github.com/comeca-ai/CRM_Jhon/releases).

1. Abra `chrome://extensions` e ligue o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e escolha a pasta `extension/`.
3. Clique no ícone do Decida Antes na barra: o painel lateral abre. O botão ⤢ abre a versão em tela cheia.

### Demonstração web

`npm run web` monta `dist/web`: a mesma interface com uma camada (`web/chrome-shim.js`) que imita as APIs do Chrome usando o `localStorage`, mais uma página inicial com o .zip da extensão. A captura usa uma página de exemplo fixa. `npm run serve` publica em `http://0.0.0.0:8095`. `node tests/e2e/web-demo.mjs` testa a demo no Chromium.

### Desenvolver

```bash
npm install
npm test            # testes unitários (node --test)
npm run test:e2e    # extensão real no Chromium: jornadas, acessibilidade (axe), desempenho
npm run vendor      # regenera extension/src/vendor/anthropic.js a partir do @anthropic-ai/sdk
npm run package     # gera dist/crm-generativo-<versão>.zip com SHA-256
```

Documentos: [pesquisa](docs/extensao/research.md), [arquitetura](docs/extensao/architecture.md), [interface](docs/extensao/design-spec.md), [privacidade](PRIVACY.md), [qualidade](docs/quality/), [loja](docs/release/), [capturas](docs/screenshots/).

## Protótipo

`prototype/crm-generativo.html` — protótipo funcional em um único arquivo, sem dependências. Abra no navegador e:

- navegue pelas telas base (Empresas, Pipeline, Contatos);
- peça uma tela nova na barra de comando (ex.: "negócios abertos acima de 150 mil", "kanban por responsável");
- veja no inspetor à direita a **spec JSON** que a "IA" gerou e a telemetria de uso;
- clique em "Aplicar aprendizado" para reordenar as colunas pelo seu uso real.

No protótipo o gerador é um parser por regras. No produto real, esse é exatamente o ponto onde entra um LLM — recebendo o schema introspectado e devolvendo o **mesmo formato de spec**.

## Specs de exemplo

`specs/` contém exemplos do formato de view spec que o gerador produz.

## Roadmap

- [ ] Backend com schema dinâmico (Postgres + JSONB de atributos, ou EAV) e API de introspecção para o gerador
- [x] Gerador de telas com LLM (Claude, opcional), com validação de spec contra o schema — na extensão
- [x] Extensão do Chrome com captura da página ativa e painel lateral
- [x] **Ligação com o Decida Antes**: captura salva vira sinal novo com evidência na plataforma (`integrations.captureFromExtension`), com o login do Cloudflare Access do próprio Chrome; botão **Hoje** mostra o que pede decisão. Ver `docs/EXTENSAO.md` no repositório `comeca-ai/decidaantes`
- [x] Loop de aprendizado persistente: telemetria de uso → sugestões de layout → aceite do usuário (local, na extensão)
- [ ] **Integração Granola (MCP)**: reuniões gravadas/transcritas no Granola viram eventos na timeline do registro (empresa/negócio) e alimentam campos como "próximo passo" automaticamente — cobre o caso "gravar reuniões" do Attio sem construir gravação própria
- [ ] Sincronização de e-mail/calendário para enriquecimento automático de contatos
- [ ] Permissões por workspace e multiusuário

## Stack prevista

Protótipo e extensão: HTML/CSS/JS sem framework (módulos ES), SDK oficial da Anthropic empacotado com esbuild. Produto web: a definir (sugestão: Next.js + Postgres + camada MCP para integrações como Granola).
