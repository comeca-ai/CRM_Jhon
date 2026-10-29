// Schema e dados de exemplo (vindos do protótipo). O schema é dado, não código: o usuário pode estendê-lo.
export const SEED_SCHEMA = {
  companies: { label: 'Empresas', singular: 'Empresa', icon: '▦', fields: [
    { id: 'name', label: 'Empresa', type: 'text' },
    { id: 'setor', label: 'Setor', type: 'select', options: ['Bancos', 'Crédito', 'Seguros', 'Pagamentos', 'Cooperativas', 'Varejo', 'Outro'] },
    { id: 'porte', label: 'Porte', type: 'select', options: ['Startup', 'Pequeno', 'Médio', 'Grande'] },
    { id: 'status', label: 'Status', type: 'status', options: ['Prospecção', 'Negociação', 'Cliente', 'Perdido'] },
    { id: 'owner', label: 'Responsável', type: 'user' },
    { id: 'site', label: 'Site', type: 'url' }
  ] },
  people: { label: 'Contatos', singular: 'Contato', icon: '◉', fields: [
    { id: 'name', label: 'Nome', type: 'text' },
    { id: 'cargo', label: 'Cargo', type: 'text' },
    { id: 'empresa', label: 'Empresa', type: 'ref', ref: 'companies' },
    { id: 'email', label: 'E-mail', type: 'email' },
    { id: 'owner', label: 'Responsável', type: 'user' },
    { id: 'perfil', label: 'Perfil', type: 'url' }
  ] },
  deals: { label: 'Negócios', singular: 'Negócio', icon: '◆', fields: [
    { id: 'name', label: 'Negócio', type: 'text' },
    { id: 'empresa', label: 'Empresa', type: 'ref', ref: 'companies' },
    { id: 'valor', label: 'Valor (R$)', type: 'money' },
    { id: 'estagio', label: 'Estágio', type: 'stage', options: ['Lead', 'Qualificado', 'Proposta', 'Negociação', 'Fechado'] },
    { id: 'prob', label: 'Prob.', type: 'percent' },
    { id: 'owner', label: 'Responsável', type: 'user' },
    { id: 'proximo', label: 'Próximo passo', type: 'text' }
  ] }
};

const T0 = Date.parse('2026-10-20T12:00:00Z');
const tl = (text) => [{ t: T0, kind: 'created', text }];

export const SEED_RECORDS = {
  companies: [
    { id: 'c1', name: 'Banco Meridiano', setor: 'Bancos', porte: 'Grande', status: 'Cliente', owner: 'Jhonata', site: 'https://meridiano.com.br' },
    { id: 'c2', name: 'CredVale', setor: 'Crédito', porte: 'Médio', status: 'Negociação', owner: 'Marina', site: 'https://credvale.com.br' },
    { id: 'c3', name: 'Seguros Atlas', setor: 'Seguros', porte: 'Grande', status: 'Prospecção', owner: 'Jhonata', site: 'https://atlasseg.com.br' },
    { id: 'c4', name: 'PagueJá', setor: 'Pagamentos', porte: 'Startup', status: 'Cliente', owner: 'Rafael', site: 'https://pagueja.io' },
    { id: 'c5', name: 'Coop Horizonte', setor: 'Cooperativas', porte: 'Médio', status: 'Negociação', owner: 'Marina', site: 'https://coophorizonte.coop.br' },
    { id: 'c6', name: 'FinMax Capital', setor: 'Crédito', porte: 'Médio', status: 'Prospecção', owner: 'Rafael', site: 'https://finmax.com.br' }
  ],
  people: [
    { id: 'p1', name: 'Carla Nogueira', cargo: 'Head de Risco', empresa: 'Banco Meridiano', email: 'carla@meridiano.com.br', owner: 'Jhonata' },
    { id: 'p2', name: 'Eduardo Lima', cargo: 'CTO', empresa: 'PagueJá', email: 'edu@pagueja.io', owner: 'Rafael' },
    { id: 'p3', name: 'Fernanda Souza', cargo: 'Gerente de Crédito', empresa: 'CredVale', email: 'fernanda@credvale.com.br', owner: 'Marina' },
    { id: 'p4', name: 'Paulo Teixeira', cargo: 'Diretor Comercial', empresa: 'Seguros Atlas', email: 'paulo@atlasseg.com.br', owner: 'Jhonata' },
    { id: 'p5', name: 'Luiza Prado', cargo: 'Analista de Dados', empresa: 'Coop Horizonte', email: 'luiza@coophorizonte.coop.br', owner: 'Marina' }
  ],
  deals: [
    { id: 'd1', name: 'Score de crédito PJ', empresa: 'Banco Meridiano', valor: 420000, estagio: 'Negociação', prob: 70, owner: 'Jhonata', proximo: 'Revisar SLA com jurídico' },
    { id: 'd2', name: 'Antifraude onboarding', empresa: 'PagueJá', valor: 180000, estagio: 'Fechado', prob: 100, owner: 'Rafael', proximo: 'Kickoff 10/11' },
    { id: 'd3', name: 'Modelo de churn', empresa: 'CredVale', valor: 95000, estagio: 'Proposta', prob: 50, owner: 'Marina', proximo: 'Enviar proposta revisada' },
    { id: 'd4', name: 'Precificação dinâmica', empresa: 'Seguros Atlas', valor: 310000, estagio: 'Qualificado', prob: 30, owner: 'Jhonata', proximo: 'Demo técnica quinta' },
    { id: 'd5', name: 'Esteira de cobrança', empresa: 'Coop Horizonte', valor: 140000, estagio: 'Proposta', prob: 55, owner: 'Marina', proximo: 'Alinhar escopo de dados' },
    { id: 'd6', name: 'Limite pré-aprovado', empresa: 'FinMax Capital', valor: 220000, estagio: 'Lead', prob: 15, owner: 'Rafael', proximo: 'Primeira call de descoberta' },
    { id: 'd7', name: 'Monitoramento de modelos', empresa: 'Banco Meridiano', valor: 160000, estagio: 'Qualificado', prob: 40, owner: 'Jhonata', proximo: 'Mapear stakeholders' }
  ]
};
for (const list of Object.values(SEED_RECORDS)) for (const r of list) { r.createdAt = T0; r.updatedAt = T0; r.timeline = tl('Registro criado (dados de exemplo)'); r.sample = true; }

export const SEED_VIEWS = [
  { id: 'v-emp', title: 'Empresas', object: 'companies', type: 'table', columns: ['name', 'setor', 'porte', 'status', 'owner'], generated: false },
  { id: 'v-pipe', title: 'Pipeline', object: 'deals', type: 'kanban', groupBy: 'estagio', card: ['name', 'empresa', 'valor'], generated: false },
  { id: 'v-ctt', title: 'Contatos', object: 'people', type: 'table', columns: ['name', 'cargo', 'empresa', 'email', 'owner'], generated: false }
];

export const DEFAULT_SETTINGS = { generator: 'rules', model: 'claude-opus-5-5', apiKey: '', dismissed: {}, sampleData: true, platform: { enabled: false, origin: 'https://decidaantes.com.br' } };
