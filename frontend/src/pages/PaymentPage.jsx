import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Banknote,
  Building2,
  CreditCard,
  FileText,
  LockKeyhole,
  Receipt,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { PRODUCT_NAME } from '../config';

const plans = [
  {
    id: 'starter',
    name: 'Inicial',
    monthly: 149,
    description: 'Para validar atendimento automatizado com uma operação pequena.',
    limits: ['2.000 contatos', '5.000 mensagens/mês', 'Fluxos e sequências', '1 número WhatsApp']
  },
  {
    id: 'growth',
    name: 'Crescimento',
    monthly: 349,
    description: 'Para times que precisam de automação e atendimento humano no mesmo painel.',
    limits: ['15.000 contatos', '35.000 mensagens/mês', 'Atendentes ilimitados', 'Transmissões segmentadas'],
    featured: true
  },
  {
    id: 'scale',
    name: 'Escala',
    monthly: 749,
    description: 'Para alto volume com governança, suporte e janelas de envio planejadas.',
    limits: ['Base ilimitada', 'Volume customizado', 'RAG e multiagentes', 'SLA de implantação']
  }
];

function money(value) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  });
}

export default function PaymentPage({ setStatus }) {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectedPlan, setSelectedPlan] = useState('growth');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [billing, setBilling] = useState({
    company: `${PRODUCT_NAME} Demo`,
    document: '',
    email: 'financeiro@demo.local',
    cardName: '',
    cardNumber: '',
    expiry: '',
    cvv: ''
  });

  const plan = plans.find((item) => item.id === selectedPlan) || plans[0];
  const subtotal = billingCycle === 'yearly' ? plan.monthly * 10 : plan.monthly;
  const discount = billingCycle === 'yearly' ? plan.monthly * 2 : 0;
  const total = subtotal;

  const completion = useMemo(() => {
    const requiredFields = paymentMethod === 'card'
      ? ['company', 'email', 'cardName', 'cardNumber', 'expiry', 'cvv']
      : ['company', 'email', 'document'];

    const filled = requiredFields.filter((field) => String(billing[field] || '').trim()).length;
    return Math.round((filled / requiredFields.length) * 100);
  }, [billing, paymentMethod]);

  function submit(event) {
    event.preventDefault();
    // TODO: Integrate with Stripe, Mercado Pago or another PSP and create a server-side checkout session.
    setStatus(`Checkout preparado para o plano ${plan.name}.`);
  }

  return (
    <section className="work-area payment-page">
      <header className="section-header">
        <div>
          <h2>Pagamento</h2>
          <p>Plano, dados de faturamento e método de pagamento da empresa.</p>
        </div>
        <div className="trust-strip">
          <span><ShieldCheck size={16} /> Dados protegidos</span>
          <span><Receipt size={16} /> Nota fiscal</span>
        </div>
      </header>

      <div className="billing-grid">
        <section className="panel plan-panel">
          <div className="panel-title">
            <div>
              <h3>Escolha do plano</h3>
              <p>Ciclo e limites para a operação atual.</p>
            </div>
            <div className="segmented compact">
              <button type="button" className={billingCycle === 'monthly' ? 'active' : ''} onClick={() => setBillingCycle('monthly')}>
                Mensal
              </button>
              <button type="button" className={billingCycle === 'yearly' ? 'active' : ''} onClick={() => setBillingCycle('yearly')}>
                Anual
              </button>
            </div>
          </div>

          <div className="plan-grid">
            {plans.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`plan-card ${selectedPlan === item.id ? 'selected' : ''} ${item.featured ? 'featured' : ''}`}
                onClick={() => setSelectedPlan(item.id)}
              >
                <span className="plan-topline">
                  <strong>{item.name}</strong>
                  {item.featured && <small><Sparkles size={14} /> Mais usado</small>}
                </span>
                <span className="plan-price">
                  {money(billingCycle === 'yearly' ? item.monthly * 10 : item.monthly)}
                  <small>{billingCycle === 'yearly' ? '/ano' : '/mes'}</small>
                </span>
                <span className="plan-description">{item.description}</span>
                <span className="plan-limits">
                  {item.limits.map((limit) => (
                    <em key={limit}><BadgeCheck size={15} /> {limit}</em>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </section>

        <form className="panel checkout-panel" onSubmit={submit}>
          <div className="panel-title">
            <div>
              <h3>Checkout</h3>
              <p>{completion}% dos dados preenchidos.</p>
            </div>
            <LockKeyhole size={20} />
          </div>

          <div className="method-grid" role="radiogroup" aria-label="Método de pagamento">
            {[
              ['card', CreditCard, 'Cartão'],
              ['pix', Banknote, 'Pix'],
              ['invoice', FileText, 'Boleto']
            ].map(([id, Icon, label]) => (
              <button
                type="button"
                key={id}
                className={paymentMethod === id ? 'active' : ''}
                onClick={() => setPaymentMethod(id)}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>

          <div className="form-grid tight">
            <label className="wide-field">
              Empresa
              <input value={billing.company} onChange={(event) => setBilling({ ...billing, company: event.target.value })} />
            </label>
            <label>
              CNPJ/CPF
              <input value={billing.document} onChange={(event) => setBilling({ ...billing, document: event.target.value })} />
            </label>
            <label>
              Email fiscal
              <input type="email" value={billing.email} onChange={(event) => setBilling({ ...billing, email: event.target.value })} />
            </label>

            {paymentMethod === 'card' && (
              <>
                <label className="wide-field">
                  Nome no cartão
                  <input value={billing.cardName} onChange={(event) => setBilling({ ...billing, cardName: event.target.value })} />
                </label>
                <label className="wide-field">
                  Número do cartão
                  <input inputMode="numeric" value={billing.cardNumber} onChange={(event) => setBilling({ ...billing, cardNumber: event.target.value })} />
                </label>
                <label>
                  Validade
                  <input placeholder="MM/AA" value={billing.expiry} onChange={(event) => setBilling({ ...billing, expiry: event.target.value })} />
                </label>
                <label>
                  CVV
                  <input inputMode="numeric" value={billing.cvv} onChange={(event) => setBilling({ ...billing, cvv: event.target.value })} />
                </label>
              </>
            )}
          </div>

          {paymentMethod !== 'card' && (
            <div className="payment-note">
              <Building2 size={18} />
              <span>{paymentMethod === 'pix' ? 'O QR Code será gerado pelo provedor de pagamento.' : 'O boleto será emitido com vencimento configurável.'}</span>
            </div>
          )}

          <div className="summary-box">
            <div>
              <span>Plano</span>
              <strong>{plan.name}</strong>
            </div>
            <div>
              <span>Desconto</span>
              <strong>{discount ? money(discount) : '-'}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
          </div>

          <button className="primary-action" type="submit">
            <CreditCard size={18} />
            Preparar checkout
          </button>
        </form>
      </div>
    </section>
  );
}

