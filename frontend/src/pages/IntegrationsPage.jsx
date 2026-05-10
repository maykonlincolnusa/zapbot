import { useEffect, useMemo, useState } from 'react';
import { Cable, CheckCircle2, FlaskConical, Plug, RefreshCcw, ServerCog, ShieldCheck, Workflow } from 'lucide-react';
import { api } from '../api';
import { canPerform } from '../permissions';
import { EmptyState, LoadingState, StatusBadge, TechnicalDetailsForAdmin } from '../components/ui/Feedback';

const defaultMapping = [{ event: 'contact.created', tool: 'create_lead' }];

function hostLabel(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'Endpoint configurado';
  }
}

function parseJsonArray(value, fallback = []) {
  const parsed = JSON.parse(value || '[]');
  return Array.isArray(parsed) ? parsed : fallback;
}

export default function IntegrationsPage({ setStatus, session }) {
  const [summary, setSummary] = useState({ connectors: [], samples: [] });
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [discoveringId, setDiscoveringId] = useState(null);
  const [testing, setTesting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [invokeResult, setInvokeResult] = useState(null);
  const [invokeState, setInvokeState] = useState({
    serverId: '',
    toolName: '',
    phone: '5511999999999',
    argumentsText: '{\n  "phone": "5511999999999"\n}'
  });
  const [form, setForm] = useState({
    name: 'HubSpot',
    provider: 'hubspot',
    endpointUrl: '',
    authType: 'bearer',
    authToken: '',
    eventMappingsText: JSON.stringify(defaultMapping, null, 2),
    active: true
  });

  const canUseAdvanced = canPerform(session, 'viewTechnicalDetails');

  async function loadData() {
    setLoading(true);
    try {
      const [summaryData, serverData] = await Promise.all([
        api('/api/integrations'),
        api('/api/integrations/servers')
      ]);
      setSummary(summaryData);
      setServers(serverData);
      if (!invokeState.serverId && serverData[0]) {
        setInvokeState((current) => ({ ...current, serverId: String(serverData[0].id) }));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch((error) => setStatus(error.message, 'error'));
  }, [setStatus]);

  const selectedServer = useMemo(
    () => servers.find((server) => String(server.id) === String(invokeState.serverId)),
    [invokeState.serverId, servers]
  );

  async function saveServer(event) {
    event.preventDefault();
    let eventMappings = defaultMapping;

    if (expanded && canUseAdvanced) {
      try {
        eventMappings = parseJsonArray(form.eventMappingsText, defaultMapping);
      } catch {
        setStatus('O mapeamento avancado esta invalido. Revise antes de salvar.', 'error');
        return;
      }
    }

    setSaving(true);
    setStatus('Salvando integracao...', 'info');
    try {
      await api('/api/integrations/servers', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          provider: form.provider,
          endpointUrl: form.endpointUrl,
          authType: expanded ? form.authType : 'bearer',
          authToken: expanded ? form.authToken : '',
          eventMappings,
          active: form.active
        })
      });
      setForm({ ...form, endpointUrl: '', authToken: '' });
      await loadData();
      setStatus('Integracao salva com sucesso.', 'success');
    } finally {
      setSaving(false);
    }
  }

  async function discover(serverId) {
    setDiscoveringId(serverId);
    setStatus('Testando conexao e descobrindo ferramentas...', 'info');
    try {
      await api(`/api/integrations/servers/${serverId}/discover`, { method: 'POST' });
      await loadData();
      setStatus('Ferramentas descobertas com sucesso.', 'success');
    } finally {
      setDiscoveringId(null);
    }
  }

  async function invoke(event) {
    event.preventDefault();
    if (!invokeState.serverId || !invokeState.toolName) {
      setStatus('Selecione um servidor e uma ferramenta para testar.', 'error');
      return;
    }

    let args = { phone: invokeState.phone };
    if (expanded && canUseAdvanced) {
      try {
        args = JSON.parse(invokeState.argumentsText || '{}');
      } catch {
        setStatus('Os argumentos avancados estao invalidos.', 'error');
        return;
      }
    }

    setTesting(true);
    setInvokeResult(null);
    setStatus('Executando teste da integracao...', 'info');
    try {
      const payload = await api(`/api/integrations/servers/${invokeState.serverId}/invoke`, {
        method: 'POST',
        body: JSON.stringify({
          toolName: invokeState.toolName,
          arguments: args
        })
      });

      setInvokeResult(payload.result ?? { ok: true });
      setStatus('Teste concluido com sucesso.', 'success');
    } finally {
      setTesting(false);
    }
  }

  function applySample(sample) {
    setForm({
      ...form,
      name: sample.name,
      provider: sample.provider,
      endpointUrl: sample.endpointUrl,
      eventMappingsText: JSON.stringify(sample.eventMappings || defaultMapping, null, 2)
    });
    setExpanded(false);
  }

  return (
    <section className="work-area integrations-page">
      <header className="section-header">
        <div>
          <h2>IntegraÃÂ§ÃÂµes</h2>
          <p>Conecte ferramentas externas com status claro, teste guiado e credenciais protegidas.</p>
        </div>
        <button type="button" onClick={() => loadData().catch((error) => setStatus(error.message, 'error'))} disabled={loading}>
          <RefreshCcw size={17} />
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </header>

      <div className="integration-overview">
        {summary.connectors?.map((connector) => (
          <article key={connector.id} className={connector.configured ? 'ready' : 'pending'}>
            <Plug size={19} />
            <strong>{connector.name}</strong>
            <StatusBadge status={connector.configured ? 'connected' : 'pending'}>
              {connector.configured ? 'Conectado' : 'Pendente'}
            </StatusBadge>
          </article>
        ))}
      </div>

      <div className="split wide-left">
        <div className="panel integration-workbench">
          <div className="panel-title">
            <div>
              <h3>Nova integracao</h3>
              <p>Cadastre o conector e teste antes de usar em fluxos, campanhas ou atendimento.</p>
            </div>
            <ServerCog size={20} />
          </div>

          <div className="sample-connectors">
            {summary.samples?.map((sample) => (
              <button key={sample.provider} type="button" className="secondary-action" onClick={() => applySample(sample)}>
                <Cable size={16} />
                {sample.name}
              </button>
            ))}
          </div>

          <div className="mcp-catalog">
            {summary.samples?.map((sample) => (
              <article key={`${sample.provider}-catalog`}>
                <strong>{sample.name}</strong>
                <span>{sample.category}</span>
                <small>{sample.description}</small>
                <em>{(sample.commonTools || []).slice(0, 3).join(', ')}</em>
              </article>
            ))}
          </div>

          <form className="form-grid quiet-form" onSubmit={saveServer}>
            <label>
              Nome
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </label>
            <label>
              Provedor
              <input value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} />
            </label>
            <label className="wide-field">
              URL segura da integracao
              <input placeholder="https://service.example.com/mcp" value={form.endpointUrl} onChange={(event) => setForm({ ...form, endpointUrl: event.target.value })} required />
            </label>

            {canUseAdvanced && (
              <button type="button" className="secondary-action" onClick={() => setExpanded((value) => !value)}>
                {expanded ? 'Ocultar avancado' : 'Mostrar avancado'}
              </button>
            )}

            {expanded && canUseAdvanced && (
              <>
                <label>
                  Tipo de autenticacao
                  <select value={form.authType} onChange={(event) => setForm({ ...form, authType: event.target.value })}>
                    <option value="bearer">Token Bearer</option>
                    <option value="api_key">Cabecalho API key</option>
                    <option value="basic">Token Basic</option>
                    <option value="none">Sem autenticacao</option>
                  </select>
                </label>
                <label>
                  Token de autenticacao
                  <input type="password" value={form.authToken} onChange={(event) => setForm({ ...form, authToken: event.target.value })} autoComplete="off" />
                </label>
                <label className="wide-field">
                  Mapeamento tecnico de eventos
                  <textarea rows={5} value={form.eventMappingsText} onChange={(event) => setForm({ ...form, eventMappingsText: event.target.value })} />
                </label>
              </>
            )}

            <button type="submit" disabled={saving}>
              <CheckCircle2 size={17} />
              {saving ? 'Salvando...' : 'Salvar integracao'}
            </button>
          </form>
        </div>

        <aside className="panel integration-sidebar">
          <div className="panel-title">
            <div>
              <h3>Conectores</h3>
              <p>Teste a conexao antes de liberar para automacoes.</p>
            </div>
            <Workflow size={20} />
          </div>

          {loading ? (
            <LoadingState label="Carregando integracoes..." />
          ) : (
            <div className="stack-list">
              {servers.map((server) => (
                <article key={server.id}>
                  <strong>{server.name}</strong>
                  <span>{server.provider || 'Provedor'} - {server.availableTools?.length || 0} ferramentas</span>
                  <small>{hostLabel(server.endpointUrl)}</small>
                  <StatusBadge status={server.active ? 'connected' : 'inactive'}>{server.active ? 'Ativo' : 'Inativo'}</StatusBadge>
                  <div className="button-row">
                    <button type="button" onClick={() => discover(server.id).catch((error) => setStatus(error.message, 'error'))} disabled={discoveringId === server.id}>
                      <ShieldCheck size={16} />
                      {discoveringId === server.id ? 'Testando...' : 'Testar conexao'}
                    </button>
                    <button type="button" className="secondary-action" onClick={() => setInvokeState({ ...invokeState, serverId: String(server.id) })}>
                      Selecionar
                    </button>
                  </div>
                  <TechnicalDetailsForAdmin session={session} details={{ endpoint: server.endpointUrl, tools: server.availableTools }} />
                </article>
              ))}
              {!servers.length && <EmptyState title="Nenhuma integracao cadastrada" description="Comece por um conector sugerido e teste a conexao antes de usar em automacoes." />}
            </div>
          )}
        </aside>
      </div>

      <form className="panel form-grid invoke-panel" onSubmit={invoke}>
        <div className="panel-title wide-field">
          <div>
            <h3>Teste guiado</h3>
            <p>Valide uma ferramenta com dados simples. Detalhes tecnicos ficam restritos ao admin.</p>
          </div>
          <FlaskConical size={20} />
        </div>
        <label>
          Servidor
          <select value={invokeState.serverId} onChange={(event) => setInvokeState({ ...invokeState, serverId: event.target.value })}>
            <option value="">Selecione</option>
            {servers.map((server) => (
              <option key={server.id} value={server.id}>{server.name}</option>
            ))}
          </select>
        </label>
        <label>
          Ferramenta
          <select value={invokeState.toolName} onChange={(event) => setInvokeState({ ...invokeState, toolName: event.target.value })}>
            <option value="">Selecione</option>
            {(selectedServer?.availableTools || []).map((tool) => {
              const name = tool.name || tool.id || tool;
              return <option key={name} value={name}>{name}</option>;
            })}
          </select>
        </label>
        <label className="wide-field">
          Telefone de teste
          <input value={invokeState.phone} onChange={(event) => setInvokeState({ ...invokeState, phone: event.target.value })} />
        </label>

        {expanded && canUseAdvanced && (
          <label className="wide-field">
            Argumentos avancados
            <textarea rows={5} value={invokeState.argumentsText} onChange={(event) => setInvokeState({ ...invokeState, argumentsText: event.target.value })} />
          </label>
        )}

        <button type="submit" disabled={testing}>
          {testing ? 'Executando teste...' : 'Testar ferramenta'}
        </button>

        {invokeResult && (
          <div className="integration-result">
            <strong>Teste concluido</strong>
            <span>A ferramenta respondeu com sucesso. Confira detalhes tecnicos apenas se precisar depurar.</span>
            <TechnicalDetailsForAdmin session={session} details={invokeResult} title="Resposta tecnica" />
          </div>
        )}
      </form>
    </section>
  );
}

