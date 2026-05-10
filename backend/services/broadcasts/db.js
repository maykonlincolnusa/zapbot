const { DataTypes } = require('sequelize');
const { createSqliteSequelize } = require('../_shared/sqlite');
require('dotenv').config();

const sequelize = createSqliteSequelize('BROADCASTS_DATABASE_URL', 'broadcasts.sqlite');

const Segment = sequelize.define('Segment', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  filters: { type: DataTypes.JSON, allowNull: false, defaultValue: {} }
});

const Broadcast = sequelize.define('Broadcast', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  messageType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'text' },
  body: { type: DataTypes.TEXT, allowNull: false },
  segmentId: DataTypes.INTEGER,
  scheduledAt: DataTypes.DATE,
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'draft' },
  stats: { type: DataTypes.JSON, allowNull: false, defaultValue: { queued: 0, sent: 0, failed: 0 } }
});

const BroadcastJob = sequelize.define('BroadcastJob', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  broadcastId: { type: DataTypes.INTEGER, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'queued' },
  providerMessageId: DataTypes.STRING,
  error: DataTypes.TEXT
});

Segment.hasMany(Broadcast, { foreignKey: 'segmentId' });
Broadcast.belongsTo(Segment, { foreignKey: 'segmentId' });
Broadcast.hasMany(BroadcastJob, { foreignKey: 'broadcastId' });
BroadcastJob.belongsTo(Broadcast, { foreignKey: 'broadcastId' });

async function initDb() {
  await sequelize.sync();
}

module.exports = { initDb, Segment, Broadcast, BroadcastJob };
