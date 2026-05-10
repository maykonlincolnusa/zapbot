const { DataTypes } = require('sequelize');
const { createSqliteSequelize } = require('../_shared/sqlite');
require('dotenv').config();

const sequelize = createSqliteSequelize('AUTOMATION_DATABASE_URL', 'automation.sqlite');

const Flow = sequelize.define('Flow', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  flowId: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  trigger: DataTypes.STRING,
  type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'keyword' },
  definition: { type: DataTypes.JSON, allowNull: false },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
});

const ContactAutomationState = sequelize.define('ContactAutomationState', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  activeFlowId: DataTypes.STRING,
  activeStepId: DataTypes.STRING,
  sequenceId: DataTypes.STRING,
  campaignId: DataTypes.STRING
});

const Sequence = sequelize.define('Sequence', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  sequenceId: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  steps: { type: DataTypes.JSON, allowNull: false },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
});

const Campaign = sequelize.define('Campaign', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  campaignId: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  triggerText: DataTypes.STRING,
  actions: { type: DataTypes.JSON, allowNull: false },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
});

const RobotField = sequelize.define('RobotField', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  key: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  value: DataTypes.TEXT
});

const SubscriberSequence = sequelize.define('SubscriberSequence', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  sequenceId: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' }
});

const SubscriberCampaign = sequelize.define('SubscriberCampaign', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  campaignId: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' }
});

async function initDb() {
  await sequelize.sync();
}

module.exports = {
  initDb,
  Flow,
  ContactAutomationState,
  Sequence,
  Campaign,
  RobotField,
  SubscriberSequence,
  SubscriberCampaign
};
