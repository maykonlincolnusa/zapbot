import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Bot,
  BrainCircuit,
  CheckCircle2,
  FlaskConical,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react';
import { api } from '../api';
import { EmptyState, LoadingState, StatusBadge } from '../components/ui/Feedback';

const defaultPrompt =
  'Você é um atendente comercial da empresa. Responda pelo WhatsApp com clareza, cordialidade e objetividade. Faça perguntas curtas para entender a necessidade do contato e encaminhe para um atendente humano quando necessário.';

export default function AiAgents({ setStatus }) {
  const [providers, setProviders] = useState([]);
  const [modelsPayload, setModelsPayload] = useState({ models: [], source: 'fallback', configured: false });
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [query, setQuery] = useState('');
  const [testMessage, setTestMessage] = useState('Olá, quero entender como funciona.');
  const [testResult, setTestResult] = useState('');
  const [form, setForm] = useState({
    name: 'Agente comercial',
    provider: 'openrouter',
    model: 'openai/gpt-4o-mini',
    systemPrompt: defaultPrompt,
    temperature: 0.4,
    fallbackText: 'Recebi sua mensagem. Um atendente vai continuar por aqui.',
    isDefault: true,
    active: true
  });

  async function loadData() {
    setLoading(true);
    try {
      const [providerData, modelData, agentData] = await Promise.all([
        api('/api/ai/providers'),
        api('/api/ai/models'),
        api('/api/ai/agents')
      ]);

      setProviders(providerData);
      setModelsPayload(modelData);
      setAgents(agentData);

      if (modelData.models?.length && !modelData.models.some((model) => model.id === form.model)) {
        setForm((current) => ({ ...current, model: modelData.models[0].id }));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch((error) => setStatus(error.message, 'error'));
  }, [setStatus]);

  const filteredModels = useMemo(() => {
    const term = query.trim().toLowerCase();
    const models = modelsPayload.models || [];
    if (!term) return models.slice(0, 80);

    return models
      .filter((model) => `${model.id} ${model.name}`.toLowerCase().includes(term))
      .slice(0, 80);
  }, [modelsPayload.models, query]);

  const selectedModel = (modelsPayload.models || []).find((model) => model.id === form.model);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setStatus('Criando agente...', 'info');
    try {
      await api('/api/ai/agents', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      await loadData();
      setStatus('Agente criado com sucesso.', 'success');
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(agentId) {
    setTestingId(agentId);
    setStatus('Atualizando agente padrão...', 'info');
    try {
      await api(`/api/ai/agents/${agentId}/default`, { method: 'POST' });
      await loadData();
      setStatus('Agente padrão atualizado.', 'success');
    } finally {
      setTestingId(null);
    }
  }

  async function testAgent(agentId) {
    setTestingId(agentId);
    setStatus('Testando agente...', 'info');
    try {
      const payload = await api(`/api/ai/agents/${agentId}/test`, {
        method: 'POST',
        body: JSON.stringify({ message: testMessage })
      });
      setTestResult(payload.response);
      setStatus('Teste concluído.', 'success');
    } finally {
      setTestingId(null);
    }
  }

  return (
    <section className="work-area ai-page">
      <header className="section-header">
        <div>
          <h2>Regras de suporte</h2>
          <p>Configure agentes, modelos e respostas automáticas usadas no atendimento.</p>
        </div>
        <button type="button" onClick={() => loadData().catch((error) => setStatus(error.message, 'error'))} disabled={loading}>
          <RefreshCcw size={17} />
          {loading ? 'Atualizando...' : 'Atualizar modelos'}
        </button>
      </header>

      <div className="ai-layout">
        <form className="panel form-grid agent-builder" onSubmit={(event) => submit(event).catch((error) => setStatus(error.message, 'error'))}>
          <div className="panel-title wide-field">
            <div>
              <h3>Construtor de agente</h3>
              <p>Esse agente pode virar o padrão das respostas automáticas.</p>
            </div>
            <BrainCircuit size={20} />
          </div>

          <label>
            Nome do agente
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>
          <label>
            Provedor
            <select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })}>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} {provider.configured ? '' : '(pendente)'}
                </option>
              ))}
            </select>
          </label>

          <label className="wide-field">
            Buscar modelo
            <div className="input-with-icon">
              <Search size={17} />
              <input placeholder="Ex.: gpt, claude, gemini, llama..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </label>

          <label className="wide-field">
            Modelo
            <select value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })}>
              {filteredModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} - {model.id}
                </option>
              ))}
            </select>
          </label>

          <div className="model-details wide-field">
            <span><Sparkles size={16} /> Fonte: {modelsPayload.source === 'openrouter' ? 'OpenRouter' : 'lista local'}</span>
            <span><SlidersHorizontal size={16} /> Contexto: {selectedModel?.contextLength?.toLocaleString('pt-BR') || 'não informado'}</span>
            <span><BadgeCheck size={16} /> {modelsPayload.configured ? 'Chave configurada' : 'OPENROUTER_API_KEY pendente'}</span>
          </div>

          <label className="wide-field">
            Instruções do agente
            <textarea rows={8} value={form.systemPrompt} onChange={(event) => setForm({ ...form, systemPrompt: event.target.value })} />
          </label>
          <label>
            Temperatura
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={form.temperature}
              onChange={(event) => setForm({ ...form, temperature: Number(event.target.value) })}
            />
          </label>
          <label>
            Resposta de contingência
            <input value={form.fallbackText} onChange={(event) => setForm({ ...form, fallbackText: event.target.value })} />
          </label>
          <label className="check-line">
            <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} />
            Usar como agente padrão
          </label>
          <button type="submit" disabled={saving}>
            <Bot size={18} />
            {saving ? 'Criando...' : 'Criar agente'}
          </button>
        </form>

        <aside className="panel agents-panel">
          <div className="panel-title">
            <div>
              <h3>Agentes criados</h3>
              <p>O agente padrão será usado no autoatendimento.</p>
            </div>
            <Bot size={20} />
          </div>

          <label>
            Mensagem de teste
            <textarea rows={3} value={testMessage} onChange={(event) => setTestMessage(event.target.value)} />
          </label>

          {loading ? (
            <LoadingState label="Carregando agentes..." />
          ) : (
            <div className="stack-list">
              {agents.map((agent) => (
                <article key={agent.id} className={agent.isDefault ? 'agent-card default' : 'agent-card'}>
                  <strong>{agent.name}</strong>
                  <span>{agent.model}</span>
                  <small>{agent.provider} - temperatura {agent.temperature}</small>
                  {agent.isDefault && <em><CheckCircle2 size={15} /> Padrão</em>}
                  <StatusBadge status={agent.active ? 'active' : 'inactive'}>{agent.active ? 'Ativo' : 'Inativo'}</StatusBadge>
                  <div className="button-row">
                    <button type="button" onClick={() => setDefault(agent.id).catch((error) => setStatus(error.message, 'error'))} disabled={testingId === agent.id}>
                      Definir padrão
                    </button>
                    <button type="button" className="secondary-action" onClick={() => testAgent(agent.id).catch((error) => setStatus(error.message, 'error'))} disabled={testingId === agent.id}>
                      <FlaskConical size={16} />
                      {testingId === agent.id ? 'Testando...' : 'Testar'}
                    </button>
                  </div>
                </article>
              ))}
              {!agents.length && <EmptyState title="Nenhum agente criado" description="Escolha um modelo e salve o primeiro agente." />}
            </div>
          )}

          {testResult && (
            <div className="test-result">
              <strong>Resposta do agente</strong>
              <p>{testResult}</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
