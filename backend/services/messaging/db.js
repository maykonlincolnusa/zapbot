const { DataTypes } = require('sequelize');
const { createSqliteSequelize } = require('../_shared/sqlite');
require('dotenv').config();

const sequelize = createSqliteSequelize('MESSAGING_DATABASE_URL', 'messaging.sqlite');

const Message = sequelize.define('Message', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  direction: { type: DataTypes.ENUM('inbound', 'outbound'), allowNull: false },
  channel: { type: DataTypes.STRING, allowNull: false, defaultValue: 'whatsapp' },
  type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'text' },
  body: { type: DataTypes.TEXT, allowNull: false },
  providerMessageId: DataTypes.STRING,
  rawPayload: DataTypes.JSON
});

async function initDb() {
  await sequelize.sync();
}

module.exports = {
  initDb,
  Message
};
