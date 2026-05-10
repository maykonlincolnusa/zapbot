const { DataTypes } = require('sequelize');
const { createSqliteSequelize } = require('../_shared/sqlite');
require('dotenv').config();

const sequelize = createSqliteSequelize('TEAM_DATABASE_URL', 'team.sqlite');

const Manager = sequelize.define('Manager', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  fullName: DataTypes.STRING,
  dashboard: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  campaigns: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  audience: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  assignChat: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  automation: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  flows: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  settings: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  liveChat: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  liveChatAll: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  liveChatMyBusy: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  liveChatAllBusy: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  broadcasts: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  addingNewManagers: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  onlineStatus: { type: DataTypes.STRING, allowNull: false, defaultValue: 'offline' }
});

async function initDb() {
  await sequelize.sync();
}

module.exports = { initDb, Manager };
