import { useEffect, useState } from 'react';
import { api } from '../api';
import { EmptyState, LoadingState, StatusBadge } from '../components/ui/Feedback';

function emptyStep(order) {
  return { stepOrder: order, delayValue: order === 1 ? 0 : 1, delayUnit: 'days', messageText: '' };
}

export default function SequenceBuilder({ setStatus }) {
  const [sequences, setSequences] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [selectedSequenceId, setSelectedSequenceId] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [form, setForm] = useState({
    name: 'Follow-up comercial',
    description: '',
    steps: [
      { ...emptyStep(1), messageText: 'Oi! Passando para continuar nosso atendimento.' },
      { ...emptyStep(2), messageText: 'Ainda posso ajudar com alguma dúvida?' }
    ]
  });

  async function loadData() {
    setLoading(true);
    try {
      const [sequenceData, contactData] = await Promise.all([api('/api/automation/sequences'), api('/api/contacts')]);
      setSequences(sequenceData);
      setContacts(contactData);
      if (!selectedSequenceId && sequenceData[0]) setSelectedSequenceId(String(sequenceData[0].id));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch((error) => setStatus(error.message, 'error'));
  }, [setStatus]);

  function updateStep(index, patch) {
    const steps = form.steps.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step));
    setForm({ ...form, steps });
  }

  async function createSequence(event) {
    event.preventDefault();
    setSaving(true);
    setStatus('Salvando sequência...', 'info');
    try {
      await api('/api/automation/sequences', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      await loadData();
      setStatus('Sequência salva com sucesso.', 'success');
    } finally {
      setSaving(false);
    }
  }

  async function enroll(event) {
    event.preventDefault();
    if (!selectedSequenceId || !selectedContactIds.length) {
      setStatus('Selecione uma sequência e pelo menos um contato.', 'error');
      return;
    }

    setEnrolling(true);
    setStatus('Inscrevendo contatos...', 'info');
    try {
      await api(`/api/automation/sequences/${selectedSequenceId}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ contactIds: selectedContactIds.map(Number) })
      });
      setStatus('Contatos inscritos na sequência.', 'success');
    } finally {
      setEnrolling(false);
    }
  }

  return (
    <section className="work-area">
      <header className="section-header">
        <div>
          <h2>Sequências</h2>
          <p>Construa follow-ups com atrasos por minuto, hora ou dia.</p>
        </div>
      </header>

      <div className="split">
        <form className="panel form-grid" onSubmit={(event) => createSequence(event).catch((error) => setStatus(error.message, 'error'))}>
          <h3>Construtor</h3>
          <label>
            Nome
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>
          <label>
            Descrição
            <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>

          <div className="step-list">
            {form.steps.map((step, index) => (
              <fieldset key={index}>
                <legend>Passo {index + 1}</legend>
                <label>
                  Atraso
                  <input
                    type="number"
                    min="0"
                    value={step.delayValue}
                    onChange={(event) => updateStep(index, { delayValue: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Unidade
                  <select value={step.delayUnit} onChange={(event) => updateStep(index, { delayUnit: event.target.value })}>
                    <option value="minutes">Minutos</option>
                    <option value="hours">Horas</option>
                    <option value="days">Dias</option>
                  </select>
                </label>
                <label className="wide-field">
                  Mensagem
                  <textarea rows={3} value={step.messageText} onChange={(event) => updateStep(index, { messageText: event.target.value })} />
                </label>
              </fieldset>
            ))}
          </div>

          <div className="button-row">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setForm({ ...form, steps: [...form.steps, emptyStep(form.steps.length + 1)] })}
            >
              Adicionar passo
            </button>
            <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar sequência'}</button>
          </div>
        </form>

        <div className="panel form-grid">
          {loading && <LoadingState label="Carregando sequências e contatos..." />}
          <h3>Inscrever contatos</h3>
          <label>
            Sequência
            <select value={selectedSequenceId} onChange={(event) => setSelectedSequenceId(event.target.value)}>
              <option value="">Selecione</option>
              {sequences.map((sequence) => (
                <option key={sequence.id} value={sequence.id}>{sequence.name}</option>
              ))}
            </select>
          </label>
          <label className="wide-field">
            Contatos
            <select
              multiple
              value={selectedContactIds}
              onChange={(event) => setSelectedContactIds(Array.from(event.target.selectedOptions).map((option) => option.value))}
            >
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>{contact.name || contact.phone}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={(event) => enroll(event).catch((error) => setStatus(error.message, 'error'))} disabled={enrolling}>
            {enrolling ? 'Inscrevendo...' : 'Inscrever'}
          </button>

          <h3>Sequências salvas</h3>
          <div className="stack-list">
            {sequences.map((sequence) => (
              <article key={sequence.id}>
                <strong>{sequence.name}</strong>
                <span>{sequence.steps?.length || 0} passos</span>
                <StatusBadge status={sequence.active ? 'active' : 'inactive'}>{sequence.active ? 'Ativa' : 'Inativa'}</StatusBadge>
              </article>
            ))}
            {!sequences.length && <EmptyState title="Nenhuma sequência salva" description="Crie uma cadência curta para validar o envio." />}
          </div>
        </div>
      </div>
    </section>
  );
}
