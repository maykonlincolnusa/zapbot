const { generateAIResponse } = require('./assistant');
const { PRODUCT_NAME } = require('../config/product');

const platformTopics = [
  {
    id: 'whatsapp',
    keywords: ['whatsapp', 'webhook', 'mensagem', 'cloud api', 'status'],
    answer:
      'Para ativar o WhatsApp, configure WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_VERIFY_TOKEN. Depois aponte o webhook da Meta para /webhook. Mensagens recebidas e status de envio ficam persistidos para chat ao vivo e análises.'
  },
  {
    id: 'flows',
    keywords: ['fluxo', 'flow', 'botão', 'botao', 'ramo', 'automação', 'automacao'],
    answer:
      'Fluxos são JSONs com start, steps, mensagens, botões e next. Comece com poucos passos: saudação, pergunta principal e encerramento. Depois conecte MCPs em eventos do fluxo quando precisar enviar dados para CRM ou marketing.'
  },
  {
    id: 'sequences',
    keywords: ['sequência', 'sequencia', 'follow', 'cadência', 'cadencia', 'dias', 'agendar'],
    answer:
      'Sequências enviam follow-ups por tempo. Cada passo tem delayMinutes ou delayValue/delayUnit. Use para dia 1, dia 2 e lembretes. Evite sequências longas antes de validar resposta e opt-in.'
  },
  {
    id: 'campaigns',
    keywords: ['campanha', 'broadcast', 'transmissão', 'transmissao', 'delay', 'segmento'],
    answer:
      'Campanhas enviam mensagem, template ou fluxo para contatos filtrados por tags. Use delay inteligente para variar intervalos, teste em um segmento pequeno e acompanhe os status antes de escalar.'
  },
  {
    id: 'chat',
    keywords: ['chat', 'atendimento', 'fila', 'assumir', 'transferir'],
    answer:
      'No chat ao vivo, use os filtros Todos, Meus e Não atribuídos. Um atendente pode assumir, devolver para fila ou transferir. As respostas enviadas pelo atendimento também entram no histórico WhatsApp.'
  },
  {
    id: 'integrations',
    keywords: ['mcp', 'integração', 'integracao', 'hubspot', 'slack', 'notion', 'github', 'rd station', 'stripe', 'google'],
    answer:
      'Em Integrações, cadastre servidores MCP externos, rode a descoberta de ferramentas e depois mapeie eventos como contact.created, flow.completed ou chat.unassigned para ferramentas do servidor. Comece com um mapeamento simples antes de automatizar vários eventos.'
  },
  {
    id: 'supabase',
    keywords: ['supabase', 'banco', 'postgres', 'database', 'sql'],
    answer:
      'O banco operacional é Supabase/PostgreSQL. Defina DATABASE_URL com a connection string do Supabase, mantenha DB_SSL=true e rode docs/supabase.sql depois da primeira criação do schema para índices, pgvector e RLS opcional.'
  }
];

function localAnswer(message, context = {}) {
  const text = String(message || '').toLowerCase();
  const topic =
    platformTopics.find((candidate) => candidate.keywords.some((keyword) => text.includes(keyword))) ||
    platformTopics.find((candidate) => candidate.id === context.activeTab);

  if (topic) return topic.answer;

  if (text.includes('criar') || text.includes('começar') || text.includes('comecar')) {
    return 'Comece por este caminho: 1. configure Supabase e WhatsApp, 2. cadastre contatos, 3. crie um fluxo curto, 4. conecte um MCP importante, 5. rode uma campanha pequena com delay inteligente.';
  }

  return 'Posso ajudar com WhatsApp, fluxos, sequências, campanhas, atendimento, MCPs, Supabase e configurações. Diga o que você quer fazer e eu indico o menor caminho dentro da plataforma.';
}

async function answerPlatformQuestion(message, context = {}) {
  const fallbackText = localAnswer(message, context);

  if (!process.env.OPENAI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    return {
      response: fallbackText,
      source: 'local',
      suggestions: suggestionsForContext(context)
    };
  }

  const response = await generateAIResponse(message, {
    workspaceId: context.workspaceId,
    skipRag: false,
    fallbackText,
    businessContext: [
      `Produto: ${PRODUCT_NAME}`,
      `Tela atual: ${context.activeTab || 'dashboard'}`,
      `Papel do usuário: ${context.role || 'admin'}`,
      'Ajude o usuário a operar a plataforma. Seja direto, indique o próximo clique e evite falar como uma IA separada.',
      platformTopics.map((topic) => `- ${topic.id}: ${topic.answer}`).join('\n')
    ].join('\n')
  });

  return {
    response: response || fallbackText,
    source: response ? 'llm' : 'local',
    suggestions: suggestionsForContext(context)
  };
}

function suggestionsForContext(context = {}) {
  if (context.activeTab === 'integrations') {
    return ['Quais MCPs devo conectar primeiro?', 'Como mapear um evento para o HubSpot?', 'Como testar a descoberta de ferramentas?'];
  }
  if (context.activeTab === 'flows') {
    return ['Crie um fluxo de boas-vindas', 'Como usar botões?', 'Como acionar um MCP no fim do fluxo?'];
  }
  if (context.activeTab === 'broadcasts') {
    return ['Como montar uma campanha segura?', 'Qual delay devo usar?', 'Como segmentar por tags?'];
  }
  return ['Como começar?', 'Configurar Supabase', 'Conectar WhatsApp', 'Adicionar MCP famoso'];
}

module.exports = {
  answerPlatformQuestion,
  localAnswer,
  platformTopics,
  suggestionsForContext
};
