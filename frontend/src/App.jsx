import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CreditCard,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageCircle,
  Plug,
  Activity,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  UserPlus,
  Workflow
} from 'lucide-react';
import { api, getToken, setToken } from './api';
import Dashboard from './pages/Dashboard';
import ContactList from './pages/ContactList';
import FlowEditor from './pages/FlowEditor';
import SequenceBuilder from './pages/SequenceBuilder';
import BroadcastForm from './pages/BroadcastForm';
import LiveChat from './pages/LiveChat';
import PaymentPage from './pages/PaymentPage';
import SettingsPage from './pages/SettingsPage';
import AiAgents from './pages/AiAgents';
import IntegrationsPage from './pages/IntegrationsPage';
import HealthCenter from './pages/HealthCenter';
import CommandPalette from './components/CommandPalette';
import InlineHelper from './components/InlineHelper';
import AssistantDock from './components/AssistantDock';
import { LoadingState, Toast } from './components/ui/Feedback';
import { registerPwa } from './pwa';
import { PRODUCT_NAME } from './config';
import { canView, normalizeRole } from './permissions';
import './styles.css';

const projectName = PRODUCT_NAME;

const navigationGroups = [
  {
    label: 'Operação',
    items: [
      ['dashboard', 'Painel', LayoutDashboard, 'dashboard'],
      ['contacts', 'Contatos', Users, 'contacts'],
      ['livechat', 'Atendimento', MessageCircle, 'livechat']
    ]
  },
  {
    label: 'Automação',
    items: [
      ['flows', 'Fluxos', GitBranch, 'flows'],
      ['sequences', 'Sequencias', Workflow, 'sequences'],
      ['broadcasts', 'Campanhas', Megaphone, 'broadcasts']
    ]
  },
  {
    label: 'Gestão',
    items: [
      ['integrations', 'Integrações', Plug, 'integrations'],
      ['health', 'Health Center', Activity, 'health'],
      ['payment', 'Financeiro', CreditCard, 'payment'],
      ['settings', 'Configurações', Settings, 'settings'],
      ['ai', 'Regras de suporte', BrainCircuit, 'ai']
    ]
  }
];

function visibleNavigation(session) {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canView(session, item[0]))
    }))
    .filter((group) => group.items.length);
}

function App() {
  const [token, updateToken] = useState(getToken());
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(Boolean(token));
  const [authMode, setAuthMode] = useState('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [status, setStatusState] = useState(null);
  const [authForm, setAuthForm] = useState({
    name: 'Admin',
    company: projectName,
    email: '',
    password: '',
    remember: true
  });

  function setStatus(next, type = 'info') {
    if (!next) {
      setStatusState(null);
      return;
    }

    if (typeof next === 'string') {
      setStatusState({ message: next, type });
      return;
    }

    setStatusState(next);
  }

  useEffect(() => {
    if (!token) {
      setSessionLoading(false);
      return;
    }

    setSessionLoading(true);
    api('/api/auth/me')
      .then(setSession)
      .catch((error) => {
        setStatus(error.message, 'error');
        setToken('');
        updateToken('');
      })
      .finally(() => setSessionLoading(false));
  }, [token]);

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function authenticate(event) {
    event.preventDefault();
    setStatus('');
    setAuthLoading(true);

    try {
      const payload =
        authMode === 'register'
          ? authForm
          : { email: authForm.email, password: authForm.password };

      const result = await api(`/api/auth/${authMode}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setToken(result.token);
      updateToken(result.token);
      setSession({ user: result.user, workspace: result.workspace, permissions: result.permissions });
      setSessionLoading(false);
      setStatus('Sessao iniciada', 'success');
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    setToken('');
    updateToken('');
    setSession(null);
  }

  if (!token) {
    return (
      <main className="auth-layout">
        <section className="auth-copy auth-hero">
          <div className="brand-mark">
            <span><Bot size={24} /></span>
            <strong>{projectName}</strong>
          </div>
          <h1>Automação de WhatsApp, campanhas e atendimento humano em um painel simples.</h1>
          <p>Crie fluxos, rode sequências, conecte MCPs e acompanhe conversas sem excesso de informação.</p>

          <div className="auth-signal-grid">
            <article>
              <MessageCircle size={20} />
              <strong>WhatsApp oficial</strong>
              <span>Webhooks da Cloud API, envios e historico completo.</span>
            </article>
            <article>
              <Sparkles size={20} />
              <strong>Sugestoes no contexto</strong>
              <span>Tags, orientações e rotas aparecem no fluxo de trabalho.</span>
            </article>
            <article>
              <ShieldCheck size={20} />
              <strong>Equipe pronta</strong>
              <span>Papéis, atendentes e integrações ficam por área de trabalho.</span>
            </article>
          </div>
        </section>

        <form className="auth-panel elevated" onSubmit={(event) => authenticate(event).catch((error) => setStatus(error.message, 'error'))}>
          <div className="auth-panel-head">
            <div>
              <h2>{authMode === 'register' ? 'Criar área de trabalho' : 'Entrar'}</h2>
              <p>{authMode === 'register' ? 'O primeiro usuário vira admin local.' : `Acesse sua área ${projectName}.`}</p>
            </div>
            <span className="secure-badge"><ShieldCheck size={16} /> Seguro</span>
          </div>

          <div className="segmented full">
            <button type="button" className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>
              <ArrowRight size={16} />
              Login
            </button>
            <button type="button" className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>
              <UserPlus size={16} />
              Cadastro
            </button>
          </div>

          {authMode === 'register' && (
            <div className="form-grid tight">
              <label>
                Nome
                <input value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} required />
              </label>
              <label>
                Empresa
                <input value={authForm.company} onChange={(event) => setAuthForm({ ...authForm, company: event.target.value })} />
              </label>
            </div>
          )}

          <label>
            Email
            <input type="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} required />
          </label>
          <label>
            Senha
            <input type="password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} required />
          </label>
          <label className="check-line auth-check">
            <input type="checkbox" checked={authForm.remember} onChange={(event) => setAuthForm({ ...authForm, remember: event.target.checked })} />
            Manter acesso neste dispositivo
          </label>
          <button className="primary-action" type="submit" disabled={authLoading}>
            {authMode === 'register' ? <UserPlus size={18} /> : <ArrowRight size={18} />}
            {authLoading ? 'Aguarde...' : authMode === 'register' ? 'Criar conta' : 'Entrar'}
          </button>
          <Toast status={status} onDismiss={() => setStatus('')} />
        </form>
      </main>
    );
  }

  if (sessionLoading || !session) {
    return (
      <main className="auth-layout">
        <section className="auth-panel elevated">
          <LoadingState label="Carregando sessao..." />
        </section>
      </main>
    );
  }

  const role = normalizeRole(session?.user?.role);
  const navGroups = visibleNavigation(session);
  const navItems = navGroups.flatMap((group) =>
    group.items.map(([id, label, Icon]) => ({
      id,
      label,
      icon: Icon,
      group: group.label,
      keywords: `${id} ${label}`,
      recent: ['dashboard', 'livechat', 'broadcasts'].includes(id),
      run: () => setActiveTab(id)
    }))
  );
  const commandActions = [
    ...navItems,
    { id: 'refresh', label: 'Atualizar tela atual', group: 'Acoes', keywords: 'reload atualizar', icon: Sparkles, run: () => window.location.reload() },
    { id: 'logout', label: 'Sair', group: 'Conta', keywords: 'logout sair', icon: LogOut, run: logout }
  ];
  const pageProps = { setStatus, session, role, permissions: session?.permissions };

  return (
    <main className="app-layout">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-logo"><Bot size={20} /></span>
          <strong>{projectName}</strong>
          <span>{session?.user?.email || 'área local'}</span>
        </div>

        <nav>
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span>{group.label}</span>
              {group.items.map(([id, label, Icon]) => (
                <button key={id} type="button" className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <button className="sidebar-logout" type="button" onClick={logout}>
          <LogOut size={18} />
          Sair
        </button>
      </aside>

      <section className="main-content">
        <div className="topbar">
          <div>
            <span>{session?.workspace?.name || projectName}</span>
            <strong>{role === 'owner' ? 'Area de propriedade' : role === 'admin' ? 'Area de administracao' : role === 'manager' ? 'Area de gestao' : 'Area de atendimento'}</strong>
          </div>
          <button type="button" className="command-trigger" onClick={() => setPaletteOpen(true)}>
            <span>Buscar ou executar comando</span>
            <kbd>Ctrl K</kbd>
          </button>
        </div>

        <InlineHelper role={role} activeTab={activeTab} />
        <Toast status={status} onDismiss={() => setStatus('')} />
        {activeTab === 'dashboard' && <Dashboard {...pageProps} />}
        {activeTab === 'contacts' && <ContactList {...pageProps} />}
        {activeTab === 'flows' && <FlowEditor {...pageProps} />}
        {activeTab === 'sequences' && <SequenceBuilder {...pageProps} />}
        {activeTab === 'broadcasts' && <BroadcastForm {...pageProps} />}
        {activeTab === 'integrations' && <IntegrationsPage {...pageProps} />}
        {activeTab === 'health' && <HealthCenter {...pageProps} />}
        {activeTab === 'ai' && <AiAgents {...pageProps} />}
        {activeTab === 'livechat' && <LiveChat {...pageProps} />}
        {activeTab === 'payment' && <PaymentPage {...pageProps} />}
        {activeTab === 'settings' && <SettingsPage {...pageProps} />}
      </section>

      <CommandPalette actions={commandActions} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <AssistantDock activeTab={activeTab} role={role} setStatus={setStatus} />
    </main>
  );
}

registerPwa();
createRoot(document.getElementById('root')).render(<App />);

