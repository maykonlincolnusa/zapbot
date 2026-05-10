const { DataTypes } = require('sequelize');
const { createSqliteSequelize } = require('../_shared/sqlite');
require('dotenv').config();

const sequelize = createSqliteSequelize('INTEGRATIONS_DATABASE_URL', 'integrations.sqlite');

const Integration = sequelize.define('Integration', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'outbound_webhook' },
  url: DataTypes.STRING,
  secret: DataTypes.STRING,
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  mapping: { type: DataTypes.JSON, allowNull: false, defaultValue: {} }
});

const IntegrationEvent = sequelize.define('IntegrationEvent', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  integrationId: DataTypes.INTEGER,
  direction: { type: DataTypes.STRING, allowNull: false },
  eventType: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'received' },
  payload: { type: DataTypes.JSON, allowNull: false },
  response: DataTypes.JSON,
  error: DataTypes.TEXT
});

Integration.hasMany(IntegrationEvent, { foreignKey: 'integrationId' });
IntegrationEvent.belongsTo(Integration, { foreignKey: 'integrationId' });

async function initDb() {
  await sequelize.sync();
}

module.exports = { initDb, Integration, IntegrationEvent };
