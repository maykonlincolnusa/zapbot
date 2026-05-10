import { useEffect, useMemo, useState } from 'react';
import { Download, Megaphone, Plus, RefreshCcw, Tag, Upload } from 'lucide-react';
import { api } from '../api';
import { canPerform } from '../permissions';
import ContactImportWizard from '../components/ContactImportWizard';
import { EmptyState, LoadingState, StatusBadge } from '../components/ui/Feedback';

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags;
  return String(tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function contactSource(contact) {
  return contact.metadata?.source || contact.metadata?.origem || 'manual';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function ContactList({ setStatus, session }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filters, setFilters] = useState({ q: '', tag: '', source: '', status: '' });
  const [form, setForm] = useState({ name: '', phone: '', email: '', tags: 'lead', source: 'manual' });

  const canImport = canPerform(session, 'importContacts');

  function suggestedTags() {
    const values = new Set(normalizeTags(form.tags));
    if (form.email?.includes('@')) values.add('email');
    if (form.phone?.startsWith('55')) values.add('brasil');
    if (/demo|teste|orcamento|proposta/i.test(`${form.name} ${form.email}`)) values.add('comercial');
    if (!values.size) values.add('lead');
    return Array.from(values);
  }

  async function loadContacts() {
    setLoading(true);
    try {
      const data = await api('/api/contacts');
      setContacts(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContacts().catch((error) => setStatus(error.message, 'error'));
  }, [setStatus]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setStatus('Salvando contato...', 'info');
    try {
      await api('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          tags: normalizeTags(form.tags),
          metadata: { source: form.source || 'manual' }
        })
      });
      setForm({ name: '', phone: '', email: '', tags: 'lead', source: 'manual' });
      await loadContacts();
      setStatus('Contato salvo com sucesso.', 'success');
    } finally {
      setSaving(false);
    }
  }

  const tags = useMemo(() => Array.from(new Set(contacts.flatMap((contact) => contact.tags || []))).sort(), [contacts]);
  const sources = useMemo(() => Array.from(new Set(contacts.map(contactSource))).sort(), [contacts]);
  const statuses = useMemo(() => Array.from(new Set(contacts.map((contact) => contact.status).filter(Boolean))).sort(), [contacts]);

  const filteredContacts = useMemo(() => {
    const query = filters.q.trim().toLowerCase();
    return contacts.filter((contact) => {
      const matchesQuery = !query || `${contact.name || ''} ${contact.phone || ''} ${contact.email || ''}`.toLowerCase().includes(query);
      const matchesTag = !filters.tag || (contact.tags || []).includes(filters.tag);
      const matchesSource = !filters.source || contactSource(contact) === filters.source;
      const matchesStatus = !filters.status || contact.status === filters.status;
      return matchesQuery && matchesTag && matchesSource && matchesStatus;
    });
  }, [contacts, filters]);

  function exportContacts() {
    const header = ['nome', 'telefone', 'email', 'tags', 'origem', 'status'];
    const lines = filteredContacts.map((contact) => [
      contact.name,
      contact.phone,
      contact.email,
      (contact.tags || []).join('|'),
      contactSource(contact),
      contact.status
    ]);
    const csv = [header, ...lines].map((line) => line.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contatos.csv';
    link.click();
    URL.revokeObjectURL(url);
    setStatus('Exportacao gerada.', 'success');
  }

  return (
    <section className="work-area contacts-page">
      <header className="section-header">
        <div>
          <h2>Contatos</h2>
          <p>Base de leads e clientes para fluxos, sequencias, campanhas e atendimento.</p>
        </div>
        <div className="button-row">
          <button type="button" className="secondary-action" onClick={() => loadContacts().catch((error) => setStatus(error.message, 'error'))} disabled={loading}>
            <RefreshCcw size={16} />
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button type="button" onClick={() => setImportOpen(true)} disabled={!canImport}>
            <Upload size={16} />
            Importar contatos
          </button>
          <button type="button" className="secondary-action" onClick={exportContacts} disabled={!filteredContacts.length}>
            <Download size={16} />
            Exportar
          </button>
        </div>
      </header>

      <div className="contact-toolbar panel">
        <button type="button" className="secondary-action" onClick={() => setStatus('Use o formulario lateral para criar um contato.', 'info')}>
          <Plus size={16} />
          Novo contato
        </button>
        <button type="button" className="secondary-action" onClick={() => setStatus('Selecione contatos em uma proxima etapa para aplicar tags em lote.', 'info')}>
          <Tag size={16} />
          Adicionar tag
        </button>
        <button type="button" className="secondary-action" onClick={() => setStatus('Crie campanhas a partir da tela Campanhas usando tags e segmentos.', 'info')}>
          <Megaphone size={16} />
          Criar campanha
        </button>
      </div>

      <div className="split wide-left">
        <div className="panel contacts-panel">
          <div className="filters-grid">
            <label>
              Buscar
              <input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Nome, telefone ou email" />
            </label>
            <label>
              Tag
              <select value={filters.tag} onChange={(event) => setFilters({ ...filters, tag: event.target.value })}>
                <option value="">Todas</option>
                {tags.map((tagName) => <option key={tagName} value={tagName}>{tagName}</option>)}
              </select>
            </label>
            <label>
              Origem
              <select value={filters.source} onChange={(event) => setFilters({ ...filters, source: event.target.value })}>
                <option value="">Todas</option>
                {sources.map((source) => <option key={source} value={source}>{source}</option>)}
              </select>
            </label>
            <label>
              Status
              <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                <option value="">Todos</option>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
          </div>

          {loading ? (
            <LoadingState label="Carregando contatos..." />
          ) : (
            <div className="table contacts-table">
              <div className="table-row table-head contacts-table-row">
                <span>Nome</span>
                <span>Telefone</span>
                <span>Email</span>
                <span>Tags</span>
                <span>Origem</span>
                <span>Responsavel</span>
                <span>Ultima interacao</span>
                <span>Status</span>
              </div>
              {filteredContacts.map((contact) => (
                <div className="table-row contacts-table-row" key={contact.id}>
                  <span>{contact.name || '-'}</span>
                  <span>{contact.phone}</span>
                  <span>{contact.email || '-'}</span>
                  <span>{(contact.tags || []).join(', ') || '-'}</span>
                  <span>{contactSource(contact)}</span>
                  <span>{contact.assignedAttendant?.name || contact.metadata?.responsible || '-'}</span>
                  <span>{contact.updatedAt ? new Date(contact.updatedAt).toLocaleDateString('pt-BR') : '-'}</span>
                  <span><StatusBadge status={contact.status}>{contact.status || 'Sem status'}</StatusBadge></span>
                </div>
              ))}
              {!filteredContacts.length && (
                <EmptyState
                  title="Nenhum contato encontrado"
                  description="Ajuste os filtros ou importe uma planilha para preencher a base."
                />
              )}
            </div>
          )}
        </div>

        <form className="panel form-grid" onSubmit={(event) => submit(event).catch((error) => setStatus(error.message, 'error'))}>
          <h3>Novo contato</h3>
          <label>
            Nome
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            WhatsApp
            <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            Origem
            <input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} />
          </label>
          <label className="wide-field">
            Tags
            <input placeholder="lead, cliente, suporte" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
          </label>
          <div className="suggestion-strip">
            <span>Tags sugeridas</span>
            {suggestedTags().map((tagName) => (
              <button key={tagName} type="button" className="chip-button" onClick={() => setForm({ ...form, tags: suggestedTags().join(', ') })}>
                {tagName}
              </button>
            ))}
          </div>
          <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar contato'}</button>
        </form>
      </div>

      <ContactImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={loadContacts}
        setStatus={setStatus}
      />
    </section>
  );
}
