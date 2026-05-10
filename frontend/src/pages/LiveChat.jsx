import { useCallback, useEffect, useState } from 'react';
import { api, eventSourceUrl } from '../api';
import { EmptyState, LoadingState, StatusBadge } from '../components/ui/Feedback';

export default function LiveChat({ setStatus }) {
  const [view, setView] = useState('unassigned');
  const [chats, setChats] = useState([]);
  const [attendants, setAttendants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyChatId, setBusyChatId] = useState(null);
  const [newAttendant, setNewAttendant] = useState({ name: '', email: '', password: '', role: 'attendant' });

  const loadData = useCallback(
    async (nextView = view) => {
      setLoading(true);
      try {
        const [chatData, attendantData] = await Promise.all([
          api(`/api/inbox/chats/${nextView}`),
          api('/api/team')
        ]);
        setChats(chatData);
        setAttendants(attendantData);
      } finally {
        setLoading(false);
      }
    },
    [view]
  );

  useEffect(() => {
    loadData().catch((error) => setStatus(error.message, 'error'));
  }, [loadData, setStatus]);

  useEffect(() => {
    const source = new EventSource(eventSourceUrl('/api/chats/events'));
    source.addEventListener('chat_snapshot', () => {
      loadData().catch((error) => setStatus(error.message, 'error'));
    });
    source.addEventListener('error', () => {
      setStatus('A atualizacao em tempo real foi interrompida. Atualize a tela se necessario.', 'error');
    });
    return () => source.close();
  }, [loadData, setStatus]);

  async function assign(chatId, attendantId) {
    setBusyChatId(chatId);
    setStatus('Assumindo conversa...', 'info');
    try {
      await api(`/api/inbox/chats/${chatId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ attendantId })
      });
      await loadData();
      setStatus('Chat atribuido com sucesso.', 'success');
    } finally {
      setBusyChatId(null);
    }
  }

  async function transfer(chatId, attendantId) {
    setBusyChatId(chatId);
    setStatus('Transferindo conversa...', 'info');
    try {
      await api(`/api/inbox/chats/${chatId}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ attendantId })
      });
      await loadData();
      setStatus('Chat transferido com sucesso.', 'success');
    } finally {
      setBusyChatId(null);
    }
  }

  async function createAttendant(event) {
    event.preventDefault();
    setSaving(true);
    setStatus('Criando atendente...', 'info');
    try {
      await api('/api/team', {
        method: 'POST',
        body: JSON.stringify(newAttendant)
      });
      setNewAttendant({ name: '', email: '', password: '', role: 'attendant' });
      await loadData();
      setStatus('Atendente criado com sucesso.', 'success');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="work-area">
      <header className="section-header">
        <div>
          <h2>Atendimento</h2>
          <p>Fila de conversas não atribuídas, meus atendimentos e visão geral.</p>
        </div>
        <div className="segmented">
          {[
            ['unassigned', 'Não atribuídos'],
            ['mine', 'Meus'],
            ['all', 'Todos']
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={view === id ? 'active' : ''}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="split wide-left">
        <div className="panel">
          <h3>Conversas</h3>
          {loading ? (
            <LoadingState label="Carregando conversas..." />
          ) : (
            <div className="stack-list chat-list">
              {chats.map((chat) => (
                <article key={chat.id}>
                  <strong>{chat.Contact?.name || chat.Contact?.phone || `Chat ${chat.id}`}</strong>
                  <span>Atribuido: {chat.assignedAttendant?.name || 'Ninguem'}</span>
                  <StatusBadge status={chat.status}>{chat.status}</StatusBadge>
                  <div className="button-row">
                    <button type="button" onClick={() => assign(chat.id).catch((error) => setStatus(error.message, 'error'))} disabled={busyChatId === chat.id}>
                      {busyChatId === chat.id ? 'Atualizando...' : 'Assumir'}
                    </button>
                    <select onChange={(event) => event.target.value && transfer(chat.id, event.target.value).catch((error) => setStatus(error.message, 'error'))} defaultValue="" disabled={busyChatId === chat.id}>
                      <option value="">Transferir</option>
                      {attendants.map((attendant) => (
                        <option key={attendant.id} value={attendant.id}>{attendant.name}</option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}
              {!chats.length && <EmptyState title="Sem conversas nessa fila" description="Quando uma conversa entrar, ela aparecera aqui com a acao apropriada." />}
            </div>
          )}
        </div>

        <form className="panel form-grid" onSubmit={(event) => createAttendant(event).catch((error) => setStatus(error.message, 'error'))}>
          <h3>Novo atendente</h3>
          <label>
            Nome
            <input value={newAttendant.name} onChange={(event) => setNewAttendant({ ...newAttendant, name: event.target.value })} required />
          </label>
          <label>
            Email
            <input type="email" value={newAttendant.email} onChange={(event) => setNewAttendant({ ...newAttendant, email: event.target.value })} required />
          </label>
          <label>
            Senha
            <input type="password" value={newAttendant.password} onChange={(event) => setNewAttendant({ ...newAttendant, password: event.target.value })} required />
          </label>
          <label>
            Papel
            <select value={newAttendant.role} onChange={(event) => setNewAttendant({ ...newAttendant, role: event.target.value })}>
              <option value="attendant">Atendente</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button type="submit" disabled={saving}>{saving ? 'Criando...' : 'Criar atendente'}</button>

          <h3>Equipe</h3>
          <div className="stack-list">
            {attendants.map((attendant) => (
              <article key={attendant.id}>
                <strong>{attendant.name}</strong>
                <span>{attendant.email}</span>
                <StatusBadge status={attendant.active ? 'active' : 'inactive'}>{attendant.role}</StatusBadge>
              </article>
            ))}
          </div>
        </form>
      </div>
    </section>
  );
}
