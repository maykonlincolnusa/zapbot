const axios = require('axios');

function authHeaders(server) {
  if (!server.authToken) return {};
  if (server.authType === 'api_key') return { 'X-API-Key': server.authToken };
  if (server.authType === 'basic') return { Authorization: `Basic ${server.authToken}` };
  return { Authorization: `Bearer ${server.authToken}` };
}

async function mcpRequest(server, method, params = {}) {
  const response = await axios.post(
    server.endpointUrl,
    {
      jsonrpc: '2.0',
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      method,
      params
    },
    {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(server)
      },
      timeout: Number(process.env.MCP_CONNECTOR_TIMEOUT_MS || 20000)
    }
  );

  if (response.data?.error) {
    const error = new Error(response.data.error.message || 'MCP server returned an error');
    error.details = response.data.error;
    throw error;
  }

  return response.data?.result ?? response.data;
}

async function discoverTools(server) {
  const result = await mcpRequest(server, 'tools/list');
  return result.tools || result || [];
}

async function invokeTool(server, toolName, argumentsPayload = {}) {
  return mcpRequest(server, 'tools/call', {
    name: toolName,
    arguments: argumentsPayload
  });
}

function sampleConnectors() {
  return [
    {
      provider: 'rd-station',
      name: 'RD Station',
      endpointUrl: 'https://your-rd-mcp.example.com/mcp',
      category: 'Marketing',
      description: 'Cria leads, atualiza etapa do funil e sincroniza conversoes de campanha.',
      commonTools: ['create_lead', 'update_lead', 'track_conversion'],
      eventMappings: [{ event: 'contact.created', tool: 'create_lead' }]
    },
    {
      provider: 'hubspot',
      name: 'HubSpot',
      endpointUrl: 'https://your-hubspot-mcp.example.com/mcp',
      category: 'CRM',
      description: 'Atualiza contatos, negocios e notas a partir de conversas no WhatsApp.',
      commonTools: ['upsert_contact', 'create_deal', 'add_note'],
      eventMappings: [{ event: 'flow.completed', tool: 'upsert_contact' }]
    },
    {
      provider: 'slack',
      name: 'Slack',
      endpointUrl: 'https://your-slack-mcp.example.com/mcp',
      category: 'Equipe',
      description: 'Notifica canais quando chats precisam de atencao ou campanhas terminam.',
      commonTools: ['post_message', 'create_channel_message', 'notify_user'],
      eventMappings: [{ event: 'chat.unassigned', tool: 'post_message' }]
    },
    {
      provider: 'notion',
      name: 'Notion',
      endpointUrl: 'https://your-notion-mcp.example.com/mcp',
      category: 'Conhecimento',
      description: 'Cria paginas, busca bases de conhecimento e registra aprendizados.',
      commonTools: ['search_pages', 'create_page', 'append_block'],
      eventMappings: [{ event: 'campaign.completed', tool: 'create_page' }]
    },
    {
      provider: 'google-drive',
      name: 'Google Drive',
      endpointUrl: 'https://your-google-drive-mcp.example.com/mcp',
      category: 'Arquivos',
      description: 'Busca documentos, anexa arquivos e salva registros de conversa.',
      commonTools: ['search_files', 'get_file', 'create_file'],
      eventMappings: [{ event: 'chat.closed', tool: 'create_file' }]
    },
    {
      provider: 'gmail',
      name: 'Gmail',
      endpointUrl: 'https://your-gmail-mcp.example.com/mcp',
      category: 'Email',
      description: 'Envia resumos de passagem e follow-ups por email.',
      commonTools: ['send_email', 'search_email', 'create_draft'],
      eventMappings: [{ event: 'sequence.completed', tool: 'send_email' }]
    },
    {
      provider: 'github',
      name: 'GitHub',
      endpointUrl: 'https://your-github-mcp.example.com/mcp',
      category: 'Engenharia',
      description: 'Abre issues a partir de atendimentos e vincula incidentes tecnicos.',
      commonTools: ['create_issue', 'search_issues', 'add_issue_comment'],
      eventMappings: [{ event: 'support.escalated', tool: 'create_issue' }]
    },
    {
      provider: 'stripe',
      name: 'Stripe',
      endpointUrl: 'https://your-stripe-mcp.example.com/mcp',
      category: 'Pagamentos',
      description: 'Cria links de pagamento, consulta clientes e reconcilia eventos.',
      commonTools: ['create_payment_link', 'get_customer', 'list_invoices'],
      eventMappings: [{ event: 'payment.requested', tool: 'create_payment_link' }]
    },
    {
      provider: 'shopify',
      name: 'Shopify',
      endpointUrl: 'https://your-shopify-mcp.example.com/mcp',
      category: 'Comercio',
      description: 'Consulta pedidos, perfis de clientes e disponibilidade de produtos.',
      commonTools: ['search_customers', 'get_order', 'search_products'],
      eventMappings: [{ event: 'chat.order_question', tool: 'get_order' }]
    },
    {
      provider: 'salesforce',
      name: 'Salesforce',
      endpointUrl: 'https://your-salesforce-mcp.example.com/mcp',
      category: 'CRM',
      description: 'Sincroniza leads, oportunidades e notas de conta a partir dos fluxos.',
      commonTools: ['upsert_lead', 'create_opportunity', 'add_account_note'],
      eventMappings: [{ event: 'contact.qualified', tool: 'upsert_lead' }]
    },
    {
      provider: 'zendesk',
      name: 'Zendesk',
      endpointUrl: 'https://your-zendesk-mcp.example.com/mcp',
      category: 'Suporte',
      description: 'Cria tickets a partir de conversas e atualiza status de suporte.',
      commonTools: ['create_ticket', 'update_ticket', 'search_users'],
      eventMappings: [{ event: 'support.escalated', tool: 'create_ticket' }]
    },
    {
      provider: 'calendly',
      name: 'Calendly',
      endpointUrl: 'https://your-calendly-mcp.example.com/mcp',
      category: 'Agenda',
      description: 'Cria links de agendamento depois de fluxos de qualificacao.',
      commonTools: ['create_scheduling_link', 'list_events', 'cancel_event'],
      eventMappings: [{ event: 'lead.demo_requested', tool: 'create_scheduling_link' }]
    }
  ];
}

module.exports = {
  discoverTools,
  invokeTool,
  sampleConnectors
};
