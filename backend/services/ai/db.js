const { DataTypes } = require('sequelize');
const { createSqliteSequelize } = require('../_shared/sqlite');
require('dotenv').config();

const sequelize = createSqliteSequelize('AI_DATABASE_URL', 'ai.sqlite');

const AiAgent = sequelize.define('AiAgent', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  systemPrompt: { type: DataTypes.TEXT, allowNull: false },
  temperature: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0.4 },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
});

const AiRoutingSettings = sequelize.define('AiRoutingSettings', {
  orgId: { type: DataTypes.STRING, allowNull: false, unique: true },
  defaultProvider: { type: DataTypes.STRING, allowNull: false, defaultValue: 'gpt' },
  defaultModel: { type: DataTypes.STRING, allowNull: false, defaultValue: 'gpt-4o-mini' },
  fallbackProvider: { type: DataTypes.STRING, allowNull: false, defaultValue: 'claude' },
  fallbackModel: { type: DataTypes.STRING, allowNull: false, defaultValue: 'claude-3-5-haiku-latest' },
  salesMode: { type: DataTypes.STRING, allowNull: false, defaultValue: 'consultative' },
  conversionGoal: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: 'Qualificar o lead, responder objeções e conduzir para o próximo passo comercial.'
  }
});

async function initDb() {
  await sequelize.sync();
}

module.exports = {
  initDb,
  AiAgent,
  AiRoutingSettings
};
