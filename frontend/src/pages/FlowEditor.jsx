import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus, Send, Trash2, Wand2 } from 'lucide-react';
import { api } from '../api';
import { canPerform } from '../permissions';
import { EmptyState, LoadingState, StatusBadge, TechnicalDetailsForAdmin } from '../components/ui/Feedback';

const objectives = [
  ['lead', 'Capturar lead'],
  ['initial_support', 'Atendimento inicial'],
  ['schedule', 'Agendamento'],
  ['support', 'Suporte'],
  ['post_sale', 'Pos-venda'],
  ['blank', 'Fluxo em branco']
];

const actionTypes = [
  ['message', 'Enviar mensagem'],
  ['tag', 'Adicionar tag'],
  ['transfer', 'Transferir para atendente'],
  ['sequence', 'Iniciar sequencia'],
  ['ai', 'Chamar IA'],
  ['finish', 'Finalizar fluxo']
];

function defaultOption(label, actionType = 'message') {
  return {
    label,
    actionType,
    responseText: label === 'Quero falar com atendente'
      ? 'Perfeito. Vou chamar uma pessoa do nosso time para continuar.'
      : 'Certo. Vou continuar o atendimento por aqui.',
    tag: ''
  };
}

function buildDefinition(form) {
  const steps = {
    inicio: {
      message: form.initialMessage,
      options: form.options.map((option, index) => ({
        label: option.label,
        next: `opcao_${index + 1}`
      }))
    }
  };

  form.options.forEach((option, index) => {
    const stepId = `opcao_${index + 1}`;
    steps[stepId] = {
      message: option.responseText || 'Obrigado. Vamos continuar por aqui.',
      next: null,
      completionMessage: option.actionType === 'finish' ? 'Atendimento finalizado.' : undefined,
      action: {
        type: option.actionType,
        tag: option.tag || undefined
      }
    };
  });

  return {
    start: 'inicio',
    objective: form.objective,
    status: 'published',
    steps
  };
}

function validateFlow(form) {
  if (!form.name.trim()) return 'Informe um nome para o fluxo.';
  if (!form.initialMessage.trim()) return 'Escreva a mensagem inicial.';
  if (!form.options.length) return 'Adicione pelo menos uma opcao para o cliente.';
  if (form.options.some((option) => !option.label.trim())) return 'Todas as opcoes precisam de um texto.';
  return '';
}

export default function FlowEditor({ setStatus, session }) {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [form, setForm] = useState({
    name: 'Boas-vindas',
    trigger: 'oi',
    objective: 'initial_support',
    initialMessage: 'Oi! Como posso ajudar hoje?',
    options: [
      defaultOption('Quero saber preco', 'message'),
      defaultOption('Quero falar com atendente', 'transfer'),
      defaultOption('Tenho uma duvida', 'ai')
    ]
  });

  const canUseAdvanced = canPerform(session, 'viewTechnicalDetails');
  const definition = useMemo(() => buildDefinition(form), [form]);
  const [advancedDefinition, setAdvancedDefinition] = useState(JSON.stringify(definition, null, 2));

  useEffect(() => {
    if (!advancedOpen) setAdvancedDefinition(JSON.stringify(definition, null, 2));
  }, [advancedOpen, definition]);

  async function loadFlows() {
    setLoading(true);
    try {
      const data = await api('/api/automation/flows');
      setFlows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFlows().catch((error) => setStatus(error.message, 'error'));
  }, [setStatus]);

  function updateOption(index, patch) {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => (
        optionIndex === index ? { ...option, ...patch } : option
      ))
    }));
  }

  function removeOption(index) {
    setForm((current) => ({
      ...current,
      options: current.options.filter((_, optionIndex) => optionIndex !== index)
    }));
  }

  async function submit(event) {
    event.preventDefault();
    const validationMessage = validateFlow(form);
    if (validationMessage) {
      setStatus(validationMessage, 'error');
      return;
    }

    let parsedDefinition = definition;
    if (advancedOpen && canUseAdvanced) {
      try {
        parsedDefinition = JSON.parse(advancedDefinition);
      } catch {
        setStatus('O modo avancado tem JSON invalido. Corrija ou oculte o avancado para usar o wizard.', 'error');
        return;
      }
    }

    setSaving(true);
    setStatus('Salvando fluxo...', 'info');
    try {
      await api('/api/automation/flows', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          trigger: form.trigger,
          definition: parsedDefinition
        })
      });
      await loadFlows();
      setStatus('Fluxo salvo com sucesso.', 'success');
    } finally {
      setSaving(false);
    }
  }

  const steps = ['Objetivo', 'Mensagem', 'Opcoes', 'Acoes', 'Revisao'];

  return (
    <section className="work-area">
      <header className="section-header">
        <div>
          <h2>Fluxos</h2>
          <p>Crie automacoes guiadas com mensagens, opcoes e proximas acoes claras.</p>
        </div>
      </header>

      <div className="split wide-left">
        <form className="panel form-grid wizard-layout" onSubmit={submit}>
          <div className="panel-title wide-field">
            <div>
              <h3>Novo fluxo</h3>
              <p>Use o wizard para publicar um fluxo sem editar payload tecnico.</p>
            </div>
            <Wand2 size={20} />
          </div>

          <div className="stepper wide-field" aria-label="Etapas do fluxo">
            {steps.map((item, index) => (
              <span key={item} className={index === step ? 'active' : ''}>{index + 1}. {item}</span>
            ))}
          </div>

          {step === 0 && (
            <>
              <label>
                Nome
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              </label>
              <label>
                Gatilho
                <input value={form.trigger} onChange={(event) => setForm({ ...form, trigger: event.target.value })} placeholder="Ex.: oi, quero comprar" />
              </label>
              <div className="objective-grid">
                {objectives.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={form.objective === id ? 'active' : ''}
                    onClick={() => setForm({ ...form, objective: id })}
                  >
                    <CheckCircle2 size={17} />
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <label className="wide-field">
              Mensagem inicial
              <textarea
                rows={6}
                value={form.initialMessage}
                onChange={(event) => setForm({ ...form, initialMessage: event.target.value })}
                placeholder="Escreva como a conversa deve comecar."
              />
            </label>
          )}

          {step === 2 && (
            <div className="step-list">
              {form.options.map((option, index) => (
                <fieldset key={index}>
                  <legend>Opcao {index + 1}</legend>
                  <label className="wide-field">
                    Texto do botao
                    <input value={option.label} onChange={(event) => updateOption(index, { label: event.target.value })} />
                  </label>
                  <button type="button" className="secondary-action" onClick={() => removeOption(index)} disabled={form.options.length === 1}>
                    <Trash2 size={16} />
                    Remover
                  </button>
                </fieldset>
              ))}
              <button type="button" className="secondary-action" onClick={() => setForm({ ...form, options: [...form.options, defaultOption('Nova opcao')] })}>
                <Plus size={16} />
                Adicionar opcao
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="step-list">
              {form.options.map((option, index) => (
                <fieldset key={index}>
                  <legend>{option.label || `Opcao ${index + 1}`}</legend>
                  <label>
                    Proxima acao
                    <select value={option.actionType} onChange={(event) => updateOption(index, { actionType: event.target.value })}>
                      {actionTypes.map(([id, label]) => (
                        <option key={id} value={id}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tag opcional
                    <input value={option.tag} onChange={(event) => updateOption(index, { tag: event.target.value })} placeholder="Ex.: interessado" />
                  </label>
                  <label className="wide-field">
                    Mensagem de resposta
                    <textarea rows={3} value={option.responseText} onChange={(event) => updateOption(index, { responseText: event.target.value })} />
                  </label>
                </fieldset>
              ))}
            </div>
          )}

          {step === 4 && (
            <>
              <div className="whatsapp-preview wide-field" aria-label="Previa do fluxo no WhatsApp">
                <strong>Preview WhatsApp</strong>
                <div className="whatsapp-bubble">{form.initialMessage || 'Mensagem inicial'}</div>
                {form.options.map((option, index) => (
                  <span className="whatsapp-option" key={`${option.label}-${index}`}>{option.label || `Opcao ${index + 1}`}</span>
                ))}
              </div>

              {canUseAdvanced && (
                <details className="technical-details wide-field" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
                  <summary>Avancado: definicao tecnica do fluxo</summary>
                  <textarea rows={12} value={advancedDefinition} onChange={(event) => setAdvancedDefinition(event.target.value)} />
                </details>
              )}
            </>
          )}

          <div className="button-row">
            <button type="button" className="secondary-action" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0 || saving}>
              Voltar
            </button>
            {step < steps.length - 1 ? (
              <button type="button" onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>
                Continuar
              </button>
            ) : (
              <>
                <button type="button" className="secondary-action" onClick={() => setStatus('Preview atualizado. Use Salvar e publicar para gravar o fluxo.', 'info')}>
                  <Send size={16} />
                  Testar preview
                </button>
                <button type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar e publicar'}
                </button>
              </>
            )}
          </div>
        </form>

        <div className="panel">
          <h3>Fluxos ativos</h3>
          {loading ? (
            <LoadingState label="Carregando fluxos..." />
          ) : (
            <div className="stack-list">
              {flows.map((flow) => (
                <article key={flow.id}>
                  <strong>{flow.name}</strong>
                  <span>Gatilho: {flow.trigger || '-'}</span>
                  <StatusBadge status={flow.active ? 'active' : 'inactive'}>{flow.active ? 'Ativo' : 'Inativo'}</StatusBadge>
                  <TechnicalDetailsForAdmin session={session} details={flow.definition} />
                </article>
              ))}
              {!flows.length && (
                <EmptyState
                  title="Nenhum fluxo salvo"
                  description="Comece por um fluxo simples de boas-vindas e publique quando a previa estiver correta."
                />
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
