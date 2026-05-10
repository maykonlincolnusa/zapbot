import { useEffect, useState } from 'react';
import { api } from '../api';
import { EmptyState, LoadingState, StatusBadge } from '../components/ui/Feedback';

export default function BroadcastForm({ setStatus }) {
  const [broadcasts, setBroadcasts] = useState([]);
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: 'Transmissão de leads',
    messageText: '',
    flowId: '',
    targetTags: 'lead',
    delayType: 'smart',
    delayMinSeconds: 1,
    delayMaxSeconds: 5,
    autoStart: true
  });

  async function loadData() {
    setLoading(true);
    try {
      const [broadcastData, flowData] = await Promise.all([api('/api/automation/broadcasts'), api('/api/automation/flows')]);
      setBroadcasts(broadcastData);
      setFlows(flowData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch((error) => setStatus(error.message, 'error'));
  }, [setStatus]);

  async function submit(event) {
    event.preventDefault();
    if (!form.messageText.trim() && !form.flowId) {
      setStatus('Informe uma mensagem ou escolha um fluxo antes de criar a campanha.', 'error');
      return;
    }

    setSaving(true);
    setStatus('Criando transmissão...', 'info');
    try {
      await api('/api/automation/broadcasts', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          flowId: form.flowId || null
        })
      });
      await loadData();
      setStatus('Transmissão agendada com sucesso.', 'success');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="work-area">
      <header className="section-header">
        <div>
          <h2>Transmissões</h2>
          <p>Envie mensagem ou fluxo para segmentos com atraso fixo ou inteligente.</p>
        </div>
      </header>

      <div className="split">
        <form className="panel form-grid" onSubmit={(event) => submit(event).catch((error) => setStatus(error.message, 'error'))}>
          <h3>Nova transmissão</h3>
          <label>
            Nome
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>
          <label>
            Tags alvo
            <input value={form.targetTags} onChange={(event) => setForm({ ...form, targetTags: event.target.value })} />
          </label>
          <label>
            Fluxo opcional
            <select value={form.flowId} onChange={(event) => setForm({ ...form, flowId: event.target.value })}>
              <option value="">Mensagem simples</option>
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>{flow.name}</option>
              ))}
            </select>
          </label>
          <label>
            Tipo de atraso
            <select value={form.delayType} onChange={(event) => setForm({ ...form, delayType: event.target.value })}>
              <option value="smart">Inteligente aleatório</option>
              <option value="fixed">Fixo manual</option>
            </select>
          </label>
          <label>
            Min. segundos
            <input type="number" min="0" value={form.delayMinSeconds} onChange={(event) => setForm({ ...form, delayMinSeconds: Number(event.target.value) })} />
          </label>
          <label>
            Max. segundos
            <input type="number" min="0" value={form.delayMaxSeconds} onChange={(event) => setForm({ ...form, delayMaxSeconds: Number(event.target.value) })} />
          </label>
          <label className="wide-field">
            Mensagem
            <textarea rows={6} value={form.messageText} onChange={(event) => setForm({ ...form, messageText: event.target.value })} />
          </label>
          <label className="check-line">
            <input type="checkbox" checked={form.autoStart} onChange={(event) => setForm({ ...form, autoStart: event.target.checked })} />
            Agendar agora
          </label>
          <button type="submit" disabled={saving}>{saving ? 'Criando...' : 'Criar transmissão'}</button>
        </form>

        <div className="panel">
          <h3>Histórico</h3>
          <div className="warning-note">
            Envie para grupos menores, respeite opt-in e use janelas escalonadas para proteger a qualidade do número.
          </div>
          {loading ? (
            <LoadingState label="Carregando transmissões..." />
          ) : (
            <div className="stack-list">
              {broadcasts.map((broadcast) => (
                <article key={broadcast.id}>
                  <strong>{broadcast.name}</strong>
                  <StatusBadge status={broadcast.status}>{broadcast.status}</StatusBadge>
                  <small>{broadcast.recipients?.length || 0} destinatários</small>
                </article>
              ))}
              {!broadcasts.length && <EmptyState title="Nenhuma transmissão criada" description="Valide um segmento pequeno antes de escalar." />}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
