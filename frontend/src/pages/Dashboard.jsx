import { useEffect, useState } from 'react';
import { api } from '../api';
import { LoadingState } from '../components/ui/Feedback';

export default function Dashboard({ setStatus }) {
  const [stats, setStats] = useState({ contacts: 0, flows: 0, openChats: 0, attendants: 0 });
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([api('/api/dashboard'), api('/health')])
      .then(([dashboard, healthData]) => {
        setStats(dashboard);
        setHealth(healthData);
      })
      .catch((error) => setStatus(error.message, 'error'))
      .finally(() => setLoading(false));
  }, [setStatus]);

  const assistantReady = Boolean(health?.openaiConfigured || health?.openrouterConfigured);
  const databaseLabel = health?.database === 'postgres' ? 'Supabase/PostgreSQL' : 'SQLite local de desenvolvimento';

  return (
    <section className="work-area">
      <header className="section-header">
        <div>
          <h2>Painel</h2>
          <p>Resumo operacional, integrações e próximos passos da plataforma.</p>
        </div>
      </header>

      {loading && <LoadingState label="Carregando painel..." />}

      <div className="metrics">
        <article>
          <span>Contatos</span>
          <strong>{stats.contacts}</strong>
        </article>
        <article>
          <span>Fluxos</span>
          <strong>{stats.flows}</strong>
        </article>
        <article>
          <span>Chats abertos</span>
          <strong>{stats.openChats}</strong>
        </article>
        <article>
          <span>Atendentes</span>
          <strong>{stats.attendants}</strong>
        </article>
      </div>

      <div className="panel">
        <div className="panel-title">
          <div>
            <h3>Saúde da operação</h3>
            <p>O essencial para começar a receber e responder contatos.</p>
          </div>
        </div>
        <div className="readiness-grid">
          <article className={health?.whatsappConfigured ? 'ready' : 'pending'}>
            <strong>WhatsApp oficial</strong>
            <span>{health?.whatsappConfigured ? 'Pronto para envio' : 'Configure token e número'}</span>
          </article>
          <article className={assistantReady ? 'ready' : 'pending'}>
            <strong>Assistente interno</strong>
            <span>{assistantReady ? 'Modelo configurado' : 'Ajuda local ativa'}</span>
          </article>
          <article className="ready">
            <strong>Webhook</strong>
            <span>/webhook ativo na API</span>
          </article>
          <article className={health?.database === 'postgres' ? 'ready' : 'pending'}>
            <strong>Banco</strong>
            <span>{databaseLabel}</span>
          </article>
        </div>
      </div>
    </section>
  );
}
