import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Cloud,
  Database,
  MessageCircle,
  Plug,
  RefreshCcw,
  Radio,
  ServerCog
} from 'lucide-react';
import { api } from '../api';
import { LoadingState } from '../components/ui/Feedback';

const statusLabels = {
  operational: 'Operacional',
  degraded: 'Atenção',
  not_configured: 'Pendente'
};

function statusClass(status) {
  if (status === 'operational') return 'ready';
  return 'pending';
}

export default function HealthCenter({ setStatus }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadHealth() {
    setLoading(true);
    try {
      const data = await api('/api/health-center');
      setHealth(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHealth().catch((error) => setStatus(error.message, 'error'));
  }, [setStatus]);

  const services = health?.services || {};
  const cards = useMemo(() => [
    {
      id: 'whatsapp',
      icon: MessageCircle,
      title: 'WhatsApp API',
      status: services.whatsapp?.status,
      detail: services.whatsapp?.connected ? 'Token e numero configurados' : 'Configure token e phone number ID',
      meta: services.whatsapp?.lastEventAt ? `Ultimo evento: ${new Date(services.whatsapp.lastEventAt).toLocaleString('pt-BR')}` : 'Sem evento recebido'
    },
    {
      id: 'database',
      icon: Database,
      title: 'Banco de dados',
      status: services.database?.status,
      detail: `${services.database?.dialect || 'desconhecido'}${services.database?.latencyMs !== null && services.database?.latencyMs !== undefined ? `, ${services.database.latencyMs}ms` : ''}`,
      meta: services.database?.migrations || services.database?.error || 'Status indisponivel'
    },
    {
      id: 'queues',
      icon: ServerCog,
      title: 'Redis e filas',
      status: services.queues?.status,
      detail: services.queues?.backend || 'nao configurado',
      meta: services.queues?.note || 'Sem metricas de fila'
    },
    {
      id: 'ai',
      icon: Bot,
      title: 'OpenAI/IA',
      status: services.ai?.status,
      detail: services.ai?.defaultModel || 'Modelo nao configurado',
      meta: services.ai?.openaiConfigured || services.ai?.openrouterConfigured ? 'Provedor disponivel' : 'Usando respostas locais'
    },
    {
      id: 'integrations',
      icon: Plug,
      title: 'Integrações',
      status: services.integrations?.status,
      detail: `${services.integrations?.connected || 0} conectadas, ${services.integrations?.failing || 0} falhando`,
      meta: `${services.integrations?.total || 0} servidores cadastrados`
    },
    {
      id: 'storage',
      icon: Cloud,
      title: 'Storage',
      status: services.storage?.status,
      detail: services.storage?.provider || 'nao configurado',
      meta: 'Necessario para importacoes e anexos'
    },
    {
      id: 'realtime',
      icon: Radio,
      title: 'Tempo real',
      status: services.realtime?.status,
      detail: services.realtime?.transport || 'sse',
      meta: services.realtime?.endpoint || '/api/chats/events'
    }
  ], [services]);

  return (
    <section className="work-area health-page">
      <header className="section-header">
        <div>
          <h2>Health Center</h2>
          <p>Diagnóstico operacional dos serviços essenciais da plataforma.</p>
        </div>
        <button type="button" onClick={() => loadHealth().catch((error) => setStatus(error.message, 'error'))} disabled={loading}>
          <RefreshCcw size={17} />
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </header>

      <div className="health-summary panel">
        <Activity size={22} />
        <div>
          <strong>{health?.productName || 'Plataforma'}</strong>
          <span>{health?.generatedAt ? `Atualizado em ${new Date(health.generatedAt).toLocaleString('pt-BR')}` : 'Carregando diagnostico...'}</span>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Carregando diagnostico..." />
      ) : (
        <div className="readiness-grid health-grid">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.id} className={statusClass(card.status)}>
                <Icon size={22} />
                <strong>{card.title}</strong>
                <span>{statusLabels[card.status] || 'Carregando'}</span>
                <small>{card.detail}</small>
                <small>{card.meta}</small>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
