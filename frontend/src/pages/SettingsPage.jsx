import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bot,
  Building2,
  CheckCircle2,
  Circle,
  KeyRound,
  MessageCircle,
  Plug,
  RefreshCcw,
  Server,
  Settings,
  ShieldCheck,
  UserRound,
  Users
} from 'lucide-react';
import { api } from '../api';
import { canPerform, canView } from '../permissions';
import { LoadingState, StatusBadge } from '../components/ui/Feedback';

const checklist = [
  {
    id: 'account',
    title: 'Conta administrativa criada',
    description: 'O primeiro usuario ja pode configurar a operacao.'
  },
  {
    id: 'database',
    title: 'Banco de dados conectado',
    description: 'Use PostgreSQL/Supabase para operar em producao.'
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp Cloud API',
    description: 'Configure numero, webhook e credenciais no servidor.'
  },
  {
    id: 'openai',
    title: 'Assistente conectado',
    description: 'Configure um provedor de IA para respostas avancadas.'
  },
  {
    id: 'broadcasts',
    title: 'Politica de envio revisada',
    description: 'Valide opt-in, segmentos e janelas de envio antes de escalar.'
  }
];

export default function SettingsPage({ setStatus, session }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('account');

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

  const assistantReady = Boolean(health?.services?.ai?.openrouterConfigured || health?.services?.ai?.openaiConfigured);
  const done = {
    account: true,
    database: health?.services?.database?.dialect === 'postgres',
    whatsapp: Boolean(health?.services?.whatsapp?.connected),
    openai: assistantReady,
    broadcasts: true
  };

  const tabs = useMemo(() => {
    const baseTabs = [
      ['account', 'Minha conta', UserRound, true],
      ['company', 'Empresa', Building2, true],
      ['whatsapp', 'WhatsApp', MessageCircle, true],
      ['team', 'Equipe', Users, canView(session, 'team')],
      ['integrations', 'Integracoes', Plug, canView(session, 'integrations')],
      ['security', 'Seguranca', ShieldCheck, canPerform(session, 'manageSecurity')],
      ['notifications', 'Notificacoes', Bell, true],
      ['advanced', 'Avancado', Settings, canPerform(session, 'viewTechnicalDetails')]
    ];

    return baseTabs.filter(([, , , visible]) => visible);
  }, [session]);

  useEffect(() => {
    if (!tabs.some(([id]) => id === activeTab)) setActiveTab(tabs[0]?.[0] || 'account');
  }, [activeTab, tabs]);

  const services = health?.services || {};

  return (
    <section className="work-area settings-page">
      <header className="section-header">
        <div>
          <h2>Configuracoes</h2>
          <p>Organize conta, empresa, WhatsApp, equipe e seguranca sem expor detalhes tecnicos para usuarios comuns.</p>
        </div>
        <button type="button" onClick={() => loadHealth().catch((error) => setStatus(error.message, 'error'))} disabled={loading}>
          <RefreshCcw size={17} />
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </header>

      <div className="settings-tabs" role="tablist" aria-label="Configuracoes">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} type="button" className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState label="Carregando configuracoes..." />
      ) : (
        <div className="settings-layout single">
          {activeTab === 'account' && (
            <section className="panel setup-panel">
              <div className="panel-title">
                <div>
                  <h3>Minha conta</h3>
                  <p>Dados do usuario conectado e permissao visual aplicada no painel.</p>
                </div>
                <UserRound size={20} />
              </div>
              <div className="settings-grid">
                <span>Nome: {session?.user?.name || 'Nao informado'}</span>
                <span>Email: {session?.user?.email || '-'}</span>
                <span>Papel: {session?.user?.role || 'viewer'}</span>
                <span>Status: {session?.user?.active === false ? 'Inativo' : 'Ativo'}</span>
              </div>
            </section>
          )}

          {activeTab === 'company' && (
            <section className="panel setup-panel">
              <div className="panel-title">
                <div>
                  <h3>Empresa</h3>
                  <p>Resumo da area de trabalho e primeiros passos de implantacao.</p>
                </div>
                <Building2 size={20} />
              </div>
              <div className="settings-grid">
                <span>Nome: {session?.workspace?.name || 'Empresa'}</span>
                <span>Plano: {session?.workspace?.plan || 'starter'}</span>
                <span>Status: {session?.workspace?.status || 'active'}</span>
                <span>Banco: {services.database?.dialect === 'postgres' ? 'PostgreSQL' : 'SQLite local'}</span>
              </div>
              <div className="setup-list">
                {checklist.map((item) => {
                  const checked = done[item.id];
                  return (
                    <article key={item.id} className={checked ? 'done' : ''}>
                      {checked ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.description}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === 'whatsapp' && (
            <section className="panel integration-panel">
              <div className="panel-title">
                <div>
                  <h3>WhatsApp</h3>
                  <p>Status da conexao oficial sem exibir tokens ou segredos no front-end.</p>
                </div>
                <MessageCircle size={20} />
              </div>
              <div className="integration-grid">
                <article className={services.whatsapp?.connected ? 'ready' : 'pending'}>
                  <MessageCircle size={22} />
                  <strong>Cloud API</strong>
                  <StatusBadge status={services.whatsapp?.connected ? 'connected' : 'pending'}>
                    {services.whatsapp?.connected ? 'Conectado' : 'Pendente'}
                  </StatusBadge>
                  <small>{services.whatsapp?.lastEventAt ? `Ultimo evento: ${new Date(services.whatsapp.lastEventAt).toLocaleString('pt-BR')}` : 'Sem evento recebido'}</small>
                </article>
                <article className="ready">
                  <ShieldCheck size={22} />
                  <strong>Credenciais</strong>
                  <span>Protegidas no servidor</span>
                  <small>Tokens completos nao sao exibidos no front-end.</small>
                </article>
              </div>
            </section>
          )}

          {activeTab === 'team' && (
            <section className="panel setup-panel">
              <div className="panel-title">
                <div>
                  <h3>Equipe</h3>
                  <p>Convites e papeis devem ser gerenciados com menor privilegio possivel.</p>
                </div>
                <Users size={20} />
              </div>
              <div className="settings-grid">
                <span>Owner: acesso total</span>
                <span>Admin: configuracao e equipe</span>
                <span>Manager: automacao e operacao</span>
                <span>Atendente: contatos e atendimento</span>
              </div>
            </section>
          )}

          {activeTab === 'integrations' && (
            <section className="panel integration-panel">
              <div className="panel-title">
                <div>
                  <h3>Integracoes</h3>
                  <p>Status resumido. Logs tecnicos e payloads ficam restritos ao admin.</p>
                </div>
                <Plug size={20} />
              </div>
              <div className="integration-grid">
                <article className={services.integrations?.connected ? 'ready' : 'pending'}>
                  <Plug size={22} />
                  <strong>Conectores</strong>
                  <span>{services.integrations?.connected || 0} conectados</span>
                  <small>{services.integrations?.failing || 0} com falha</small>
                </article>
                <article className={assistantReady ? 'ready' : 'pending'}>
                  <Bot size={22} />
                  <strong>IA</strong>
                  <span>{assistantReady ? 'Configurada' : 'Pendente'}</span>
                  <small>{services.ai?.defaultModel || 'Modelo nao configurado'}</small>
                </article>
              </div>
            </section>
          )}

          {activeTab === 'security' && (
            <section className="panel setup-panel">
              <div className="panel-title">
                <div>
                  <h3>Seguranca</h3>
                  <p>Regras de acesso e protecao da conta da empresa.</p>
                </div>
                <ShieldCheck size={20} />
              </div>
              <div className="setup-list">
                <article className="done"><CheckCircle2 size={20} /><div><strong>Autenticacao ativa</strong><span>Sessao protegida por token e validacao no servidor.</span></div></article>
                <article className="done"><CheckCircle2 size={20} /><div><strong>Permissoes por papel</strong><span>O front-end oculta recursos, mas a API continua sendo a camada final de seguranca.</span></div></article>
                <article><Circle size={20} /><div><strong>Auditoria de acesso</strong><span>Adicionar logs de seguranca e alteracoes criticas em etapa futura.</span></div></article>
              </div>
            </section>
          )}

          {activeTab === 'notifications' && (
            <section className="panel setup-panel">
              <div className="panel-title">
                <div>
                  <h3>Notificacoes</h3>
                  <p>Preferencias de alertas operacionais para atendimento e campanhas.</p>
                </div>
                <Bell size={20} />
              </div>
              <div className="settings-grid">
                <span>Novas conversas: ativo</span>
                <span>Falhas de campanha: ativo</span>
                <span>Integrações com erro: ativo</span>
                <span>Resumo diario: pendente</span>
              </div>
            </section>
          )}

          {activeTab === 'advanced' && (
            <section className="panel env-panel">
              <div className="panel-title">
                <div>
                  <h3>Avancado</h3>
                  <p>Checklist tecnico para administradores. Valores sensiveis nunca devem aparecer completos no front-end.</p>
                </div>
                <KeyRound size={20} />
              </div>
              <div className="integration-grid">
                <article className={services.database?.dialect === 'postgres' ? 'ready' : 'pending'}>
                  <Server size={22} />
                  <strong>Banco de dados</strong>
                  <span>{services.database?.dialect === 'postgres' ? 'PostgreSQL' : 'SQLite local'}</span>
                  <small>{services.database?.latencyMs !== undefined ? `${services.database.latencyMs}ms` : 'Latencia indisponivel'}</small>
                </article>
                <article className={services.ai?.openrouterConfigured || services.ai?.openaiConfigured ? 'ready' : 'pending'}>
                  <Bot size={22} />
                  <strong>Provedores de IA</strong>
                  <span>{services.ai?.defaultModel || 'Modelo nao configurado'}</span>
                  <small>Chaves ficam mascaradas e fora do bundle.</small>
                </article>
              </div>
              <div className="settings-grid">
                <span>DATABASE_URL: {services.database?.dialect === 'postgres' ? 'configurado' : 'pendente'}</span>
                <span>WHATSAPP_API_TOKEN: {services.whatsapp?.connected ? 'configurado' : 'pendente'}</span>
                <span>OPENROUTER_API_KEY: {services.ai?.openrouterConfigured ? 'configurado' : 'opcional'}</span>
                <span>OPENAI_API_KEY: {services.ai?.openaiConfigured ? 'configurado' : 'opcional'}</span>
                <span>SERVICE_TOKEN: protegido no servidor</span>
                <span>JWT_SECRET: protegido no servidor</span>
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}

