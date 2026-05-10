const { DataTypes } = require('sequelize');
const { createSqliteSequelize } = require('../_shared/sqlite');
require('dotenv').config();

const sequelize = createSqliteSequelize('BILLING_DATABASE_URL', 'billing.sqlite');

const Plan = sequelize.define('Plan', {
  planId: { type: DataTypes.STRING, allowNull: false, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
  priceCents: { type: DataTypes.INTEGER, allowNull: false },
  currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'BRL' },
  limits: { type: DataTypes.JSON, allowNull: false }
});

const Subscription = sequelize.define('Subscription', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  planId: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'trialing' },
  provider: { type: DataTypes.STRING, allowNull: false, defaultValue: 'mock' },
  providerCustomerId: DataTypes.STRING,
  providerSubscriptionId: DataTypes.STRING,
  currentPeriodEndsAt: DataTypes.DATE
});

const PaymentEvent = sequelize.define('PaymentEvent', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  provider: { type: DataTypes.STRING, allowNull: false },
  eventType: { type: DataTypes.STRING, allowNull: false },
  payload: { type: DataTypes.JSON, allowNull: false }
});

async function initDb() {
  await sequelize.sync();
}

module.exports = {
  initDb,
  Plan,
  Subscription,
  PaymentEvent
};
