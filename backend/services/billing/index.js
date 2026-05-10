const { createServiceApp, startService } = require('../_shared/app');
const { requireAuthOrService } = require('../_shared/auth');
const { requestOrgId } = require('../_shared/tenant');
const { initDb, Plan, Subscription, PaymentEvent } = require('./db');
require('dotenv').config();

const app = createServiceApp('billing-service');
const port = process.env.BILLING_PORT || 3006;

async function seedPlans() {
  const count = await Plan.count();
  if (count > 0) return;

  await Plan.bulkCreate([
    {
      planId: 'starter',
      name: 'Starter',
      priceCents: 9700,
      currency: 'BRL',
      limits: { contacts: 1000, agents: 2, monthlyMessages: 5000 }
    },
    {
      planId: 'pro',
      name: 'Pro',
      priceCents: 19700,
      currency: 'BRL',
      limits: { contacts: 10000, agents: 10, monthlyMessages: 50000 }
    }
  ]);
}

app.get('/plans', async (req, res, next) => {
  try {
    res.json(await Plan.findAll({ order: [['priceCents', 'ASC']] }));
  } catch (error) {
    next(error);
  }
});

app.use(requireAuthOrService);

app.get('/subscription', async (req, res, next) => {
  try {
    const [subscription] = await Subscription.findOrCreate({
      where: { orgId: requestOrgId(req) },
      defaults: {
        orgId: requestOrgId(req),
        planId: 'starter',
        status: 'trialing',
        currentPeriodEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
    res.json(subscription);
  } catch (error) {
    next(error);
  }
});

app.post('/checkout', async (req, res, next) => {
  try {
    const plan = await Plan.findOne({ where: { planId: req.body.planId } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const [subscription] = await Subscription.findOrCreate({
      where: { orgId: requestOrgId(req) },
      defaults: {
        orgId: requestOrgId(req),
        planId: plan.planId,
        status: 'pending',
        provider: process.env.PAYMENT_PROVIDER || 'mock'
      }
    });

    await subscription.update({ planId: plan.planId, status: 'pending' });

    // TODO: create a real checkout session with Stripe, Mercado Pago or another PSP.
    res.json({
      provider: process.env.PAYMENT_PROVIDER || 'mock',
      checkoutUrl: `${process.env.PUBLIC_APP_URL || 'http://localhost:5173'}/payment/success?plan=${plan.planId}`,
      subscription
    });
  } catch (error) {
    next(error);
  }
});

app.post('/webhook', async (req, res, next) => {
  try {
    await PaymentEvent.create({
      orgId: req.body.orgId || 'unknown',
      provider: req.headers['x-payment-provider'] || process.env.PAYMENT_PROVIDER || 'mock',
      eventType: req.body.type || 'unknown',
      payload: req.body
    });
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

initDb()
  .then(seedPlans)
  .then(() => startService(app, 'billing-service', port))
  .catch((error) => {
    console.error('billing-service failed to start', error);
    process.exit(1);
  });
