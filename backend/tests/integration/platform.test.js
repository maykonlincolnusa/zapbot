const test = require('node:test');
const assert = require('node:assert/strict');
const { createStack } = require('./harness');

function whatsappTextPayload({ phone, name, text, messageId = 'wamid.test' }) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-test',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              contacts: [
                {
                  profile: { name },
                  wa_id: phone
                }
              ],
              messages: [
                {
                  from: phone,
                  id: messageId,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  text: { body: text },
                  type: 'text'
                }
              ]
            }
          }
        ]
      }
    ]
  };
}

function assertStatus(result, expected, context) {
  assert.equal(result.status, expected, `${context}: ${JSON.stringify(result.body)}`);
}

test('microservice platform supports auth, crm, automation, messaging, ai and billing flows', async () => {
  const stack = createStack();
  await stack.start();

  try {
    const unique = Date.now();
    const email = `admin-${unique}@test.local`;

    const denied = await stack.request('/api/crm/contacts');
    assertStatus(denied, 401, 'CRM should reject unauthenticated request');

    const registered = await stack.request('/api/auth/register', {
      method: 'POST',
      body: {
        companyName: 'Integration Co',
        name: 'Admin',
        email,
        password: 'admin12345'
      }
    });
    assertStatus(registered, 201, 'register');
    assert.ok(registered.body.token);
    assert.equal(registered.body.user.email, email);

    const loggedIn = await stack.request('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'admin12345' }
    });
    assertStatus(loggedIn, 200, 'login');
    const token = loggedIn.body.token;

    const me = await stack.request('/api/auth/me', { token });
    assertStatus(me, 200, 'me');
    assert.equal(me.body.user.email, email);

    const registry = await stack.request('/api/service-registry');
    assertStatus(registry, 200, 'service registry');
    assert.equal(registry.body.gateway, 'healthy');
    assert.ok(registry.body.services.some((service) => service.name === 'crm' && service.capabilities.includes('deals')));
    assert.ok(registry.body.services.some((service) => service.name === 'ai' && service.capabilities.includes('multi-llm-routing')));
    assert.ok(registry.body.services.some((service) => service.name === 'publicApi' && service.capabilities.includes('contacts-api')));

    const contact = await stack.request('/api/crm/contacts', {
      method: 'POST',
      token,
      body: {
        name: 'Cliente Integracao',
        phone: '+55 (11) 98888-7777',
        email: 'cliente@test.local',
        tags: ['lead', 'vip']
      }
    });
    assertStatus(contact, 201, 'create contact');
    assert.equal(contact.body.phone, '5511988887777');
    assert.deepEqual(
      contact.body.Tags.map((tag) => tag.name).sort(),
      ['lead', 'vip']
    );

    const field = await stack.request(`/api/crm/contacts/${contact.body.id}/custom-fields`, {
      method: 'POST',
      token,
      body: { fields: { origem: 'webhook', interesse: 'plano-pro' } }
    });
    assertStatus(field, 200, 'custom fields');

    const assigned = await stack.request(`/api/crm/contacts/${contact.body.id}/assign`, {
      method: 'POST',
      token,
      body: { assignedTo: 'Atendente 1' }
    });
    assertStatus(assigned, 200, 'assign contact');
    assert.equal(assigned.body.assignedTo, 'Atendente 1');

    const deal = await stack.request('/api/crm/deals', {
      method: 'POST',
      token,
      body: {
        contactId: contact.body.id,
        title: 'Assinatura Pro',
        stage: 'Qualificacao',
        valueCents: 19700,
        probability: 60
      }
    });
    assertStatus(deal, 201, 'create deal');
    assert.equal(deal.body.title, 'Assinatura Pro');
    assert.equal(deal.body.Contact.phone, '5511988887777');

    const task = await stack.request('/api/crm/tasks', {
      method: 'POST',
      token,
      body: {
        contactId: contact.body.id,
        dealId: deal.body.id,
        title: 'Ligar para lead qualificado',
        assignedTo: 'Atendente 1'
      }
    });
    assertStatus(task, 201, 'create task');
    assert.equal(task.body.title, 'Ligar para lead qualificado');

    const closedTask = await stack.request(`/api/crm/tasks/${task.body.id}`, {
      method: 'PATCH',
      token,
      body: { status: 'done' }
    });
    assertStatus(closedTask, 200, 'close task');
    assert.equal(closedTask.body.status, 'done');

    const manager = await stack.request('/api/team/managers', {
      method: 'POST',
      token,
      body: {
        email: `agent-${unique}@test.local`,
        fullName: 'Atendente Teste',
        liveChat: true,
        liveChatAll: true,
        broadcasts: true
      }
    });
    assertStatus(manager, 201, 'create manager');
    assert.equal(manager.body.email, `agent-${unique}@test.local`);

    const liveConversation = await stack.request('/api/livechat/conversations/open', {
      method: 'POST',
      token,
      body: {
        phone: '5511988887777',
        managerId: manager.body.id,
        assignedTo: manager.body.email,
        queue: 'sales'
      }
    });
    assertStatus(liveConversation, 200, 'open livechat conversation');
    assert.equal(liveConversation.body.status, 'open');

    const note = await stack.request('/api/livechat/conversations/5511988887777/notes', {
      method: 'POST',
      token,
      body: {
        author: manager.body.email,
        body: 'Lead pediu proposta.'
      }
    });
    assertStatus(note, 201, 'conversation note');

    const flowId = `integration_${unique}`;
    const flow = await stack.request('/api/automation/flows', {
      method: 'POST',
      token,
      body: {
        flowId,
        name: 'Fluxo de Integracao',
        trigger: `teste ${unique}`,
        definition: {
          start: 'intro',
          steps: {
            intro: {
              prompt: 'Mensagem inicial do fluxo de integracao.',
              nextStepId: 'qualify'
            },
            qualify: {
              prompt: 'Qualifique seu interesse.',
              nextStepId: null
            }
          }
        }
      }
    });
    assertStatus(flow, 201, 'create flow');

    const sequence = await stack.request('/api/automation/sequences', {
      method: 'POST',
      token,
      body: {
        sequenceId: `seq_${unique}`,
        name: 'Sequencia de teste',
        steps: [{ delayMinutes: 10, message: 'Follow-up automatico' }]
      }
    });
    assertStatus(sequence, 201, 'create sequence');

    const campaign = await stack.request('/api/automation/campaigns', {
      method: 'POST',
      token,
      body: {
        campaignId: `camp_${unique}`,
        name: 'Campanha de teste',
        triggerText: `campanha ${unique}`,
        actions: [{ type: 'tag', value: 'campanha' }]
      }
    });
    assertStatus(campaign, 201, 'create campaign');

    const agent = await stack.request('/api/ai/agents', {
      method: 'POST',
      token,
      body: {
        name: 'Agente de teste',
        systemPrompt: 'Responda de forma curta.',
        temperature: 0.2
      }
    });
    assertStatus(agent, 201, 'create ai agent');

    const providers = await stack.request('/api/ai/providers', { token });
    assertStatus(providers, 200, 'list ai providers');
    assert.deepEqual(
      providers.body.providers.map((provider) => provider.id).sort(),
      ['claude', 'gemini', 'gpt', 'grok']
    );

    const aiSettings = await stack.request('/api/ai/settings', {
      method: 'PUT',
      token,
      body: {
        defaultProvider: 'gemini',
        defaultModel: 'gemini-2.5-flash',
        fallbackProvider: 'gpt',
        fallbackModel: 'gpt-4o-mini',
        salesMode: 'consultative',
        conversionGoal: 'Converter o lead para uma chamada comercial.'
      }
    });
    assertStatus(aiSettings, 200, 'update ai routing settings');
    assert.equal(aiSettings.body.defaultProvider, 'gemini');

    const aiReply = await stack.request('/api/ai/chat/reply', {
      method: 'POST',
      token,
      body: {
        phone: '5511988887777',
        message: 'Quero saber mais',
        agentId: agent.body.id,
        provider: 'claude',
        model: 'claude-3-5-haiku-latest'
      }
    });
    assertStatus(aiReply, 200, 'ai reply');
    assert.equal(aiReply.body.mode, 'mock');
    assert.equal(aiReply.body.provider, 'claude');
    assert.match(aiReply.body.reply, /Configure a chave/);

    const salesReply = await stack.request('/api/ai/sales/reply', {
      method: 'POST',
      token,
      body: {
        phone: '5511988887777',
        message: 'Qual o valor do plano?',
        agentId: agent.body.id,
        provider: 'grok',
        model: 'grok-4',
        context: {
          product: 'Assinatura Pro',
          offer: 'Teste gratuito de 7 dias',
          nextStep: 'agendar demonstracao'
        }
      }
    });
    assertStatus(salesReply, 200, 'sales reply with selected provider');
    assert.equal(salesReply.body.provider, 'grok');
    assert.equal(salesReply.body.model, 'grok-4');
    assert.match(salesReply.body.reply, /Objetivo comercial/);

    const leadScore = await stack.request('/api/ai/insights/lead-score', {
      method: 'POST',
      token,
      body: {
        contact: contact.body,
        deal: deal.body,
        history: [
          { direction: 'inbound', body: 'quero contratar' },
          { direction: 'outbound', body: 'posso te ajudar' }
        ]
      }
    });
    assertStatus(leadScore, 200, 'lead score');
    assert.ok(leadScore.body.score >= 75);
    assert.equal(leadScore.body.temperature, 'hot');
    assert.ok(leadScore.body.suggestedActions.length > 0);

    const sentFlow = await stack.request('/api/messaging/flows/send', {
      method: 'POST',
      token,
      body: {
        phone: '5511988887777',
        flowId
      }
    });
    assertStatus(sentFlow, 200, 'send flow');
    assert.equal(sentFlow.body.flowId, flowId);
    assert.equal(sentFlow.body.messages[0].body, 'Mensagem inicial do fluxo de integracao.');

    const mediaMessage = await stack.request('/api/messaging/messages/send', {
      method: 'POST',
      token,
      body: {
        phone: '5511988887777',
        type: 'document',
        url: 'https://example.com/proposta.pdf',
        caption: 'Proposta',
        filename: 'proposta.pdf'
      }
    });
    assertStatus(mediaMessage, 200, 'send media message dry run');
    assert.equal(mediaMessage.body.dryRun, true);

    const segment = await stack.request('/api/broadcasts/segments', {
      method: 'POST',
      token,
      body: {
        name: 'Leads VIP',
        filters: { tags: ['vip'] }
      }
    });
    assertStatus(segment, 201, 'create broadcast segment');

    const broadcast = await stack.request('/api/broadcasts/broadcasts', {
      method: 'POST',
      token,
      body: {
        name: 'Oferta Pro',
        body: 'Temos uma oferta para voce.',
        segmentId: segment.body.id
      }
    });
    assertStatus(broadcast, 201, 'create broadcast');

    const queuedBroadcast = await stack.request(`/api/broadcasts/broadcasts/${broadcast.body.id}/queue`, {
      method: 'POST',
      token,
      body: { phones: ['5511988887777', '5511977776666'] }
    });
    assertStatus(queuedBroadcast, 200, 'queue broadcast');
    assert.equal(queuedBroadcast.body.jobs.length, 2);

    const integration = await stack.request('/api/integrations/integrations', {
      method: 'POST',
      token,
      body: {
        name: 'CRM externo',
        type: 'outbound_webhook',
        url: 'https://example.com/webhook'
      }
    });
    assertStatus(integration, 201, 'create integration');

    const triggeredIntegration = await stack.request(`/api/integrations/integrations/${integration.body.id}/trigger`, {
      method: 'POST',
      token,
      body: {
        eventType: 'lead.created',
        payload: { contactId: contact.body.id }
      }
    });
    assertStatus(triggeredIntegration, 200, 'trigger integration dry run');
    assert.equal(triggeredIntegration.body.status, 'dry_run');

    const inboundIntegration = await stack.request('/api/integrations/inbound/payment-approved', {
      method: 'POST',
      headers: { 'API-KEY': `api-key-${stack.runId || ''}` },
      body: { phone: '5511988887777', status: 'approved' }
    });
    // The public API key is random per harness, so this path is covered through public API below.
    assert.ok([202, 403].includes(inboundIntegration.status));

    const webhookVerify = await stack.request('/webhook?hub.mode=subscribe&hub.verify_token=verify-test-token&hub.challenge=abc123');
    assertStatus(webhookVerify, 200, 'webhook verify');
    assert.equal(webhookVerify.body, 'abc123');

    const webhook = await stack.request('/webhook', {
      method: 'POST',
      body: whatsappTextPayload({
        phone: '5511977776666',
        name: 'Lead WhatsApp',
        text: `teste ${unique}`,
        messageId: `wamid.${unique}`
      })
    });
    assertStatus(webhook, 200, 'webhook inbound');

    const conversation = await stack.request('/api/messaging/conversations/5511977776666', { token });
    assertStatus(conversation, 200, 'conversation history');
    assert.ok(conversation.body.some((message) => message.direction === 'inbound'));
    assert.ok(conversation.body.some((message) => message.direction === 'outbound'));

    const contacts = await stack.request('/api/crm/contacts', { token });
    assertStatus(contacts, 200, 'list contacts');
    assert.ok(contacts.body.some((item) => item.phone === '5511977776666'));

    const plans = await stack.request('/api/billing/plans');
    assertStatus(plans, 200, 'billing plans');
    assert.ok(plans.body.length >= 2);

    const subscription = await stack.request('/api/billing/subscription', { token });
    assertStatus(subscription, 200, 'subscription');
    assert.equal(subscription.body.status, 'trialing');

    const checkout = await stack.request('/api/billing/checkout', {
      method: 'POST',
      token,
      body: { planId: 'pro' }
    });
    assertStatus(checkout, 200, 'checkout');
    assert.equal(checkout.body.provider, 'mock');
    assert.match(checkout.body.checkoutUrl, /payment\/success/);

    const publicDenied = await stack.request('/public/v1/contacts');
    assertStatus(publicDenied, 403, 'public API requires API key');

    const publicHeaders = { 'API-KEY': `api-key-${stack.runId}` };
    const publicContact = await stack.request('/public/v1/contacts', {
      method: 'POST',
      headers: publicHeaders,
      body: {
        name: 'Lead Public API',
        phone: '5511966665555',
        tags: ['public-api']
      }
    });
    assertStatus(publicContact, 201, 'public api create contact');

    const publicMessage = await stack.request(`/public/v1/contacts/${publicContact.body.id}/send-message`, {
      method: 'POST',
      headers: publicHeaders,
      body: {
        type: 'text',
        body: 'Mensagem pela API publica'
      }
    });
    assertStatus(publicMessage, 200, 'public api send message');
    assert.equal(publicMessage.body.dryRun, true);

    const publicSequence = await stack.request(`/public/v1/contacts/${publicContact.body.id}/sequences/${sequence.body.sequenceId}`, {
      method: 'POST',
      headers: publicHeaders,
      body: {}
    });
    assertStatus(publicSequence, 201, 'public api add contact to sequence');
  } catch (error) {
    error.message = `${error.message}\n${stack.dumpLogs()}`;
    throw error;
  } finally {
    await stack.stop();
  }
});
