const { DataTypes } = require('sequelize');
const { createSqliteSequelize } = require('../_shared/sqlite');
require('dotenv').config();

const sequelize = createSqliteSequelize('LIVECHAT_DATABASE_URL', 'livechat.sqlite');

const Conversation = sequelize.define('Conversation', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  contactId: DataTypes.INTEGER,
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'open' },
  managerId: DataTypes.INTEGER,
  assignedTo: DataTypes.STRING,
  priority: { type: DataTypes.STRING, allowNull: false, defaultValue: 'normal' },
  queue: { type: DataTypes.STRING, allowNull: false, defaultValue: 'default' },
  lastMessageAt: DataTypes.DATE,
  closedAt: DataTypes.DATE
});

const ConversationNote = sequelize.define('ConversationNote', {
  orgId: { type: DataTypes.STRING, allowNull: false },
  conversationId: { type: DataTypes.INTEGER, allowNull: false },
  author: DataTypes.STRING,
  body: { type: DataTypes.TEXT, allowNull: false }
});

Conversation.hasMany(ConversationNote, { foreignKey: 'conversationId' });
ConversationNote.belongsTo(Conversation, { foreignKey: 'conversationId' });

async function initDb() {
  await sequelize.sync();
}

module.exports = { initDb, Conversation, ConversationNote };
