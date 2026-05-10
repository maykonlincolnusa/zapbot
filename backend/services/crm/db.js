const { DataTypes } = require('sequelize');
const { createSqliteSequelize } = require('../_shared/sqlite');
require('dotenv').config();

const sequelize = createSqliteSequelize('CRM_DATABASE_URL', 'crm.sqlite');

const Contact = sequelize.define('Contact', {
  orgId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  stage: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Novo lead'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'open'
  },
  assignedTo: DataTypes.STRING,
  notes: DataTypes.TEXT,
  metadata: DataTypes.JSON
});

const Tag = sequelize.define('Tag', {
  orgId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  color: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '#0f766e'
  }
});

const CustomField = sequelize.define('CustomField', {
  orgId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false
  },
  label: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'text'
  }
});

const ContactCustomField = sequelize.define('ContactCustomField', {
  value: DataTypes.TEXT
});

const Deal = sequelize.define('Deal', {
  orgId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  contactId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  stage: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Novo'
  },
  valueCents: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  currency: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'BRL'
  },
  probability: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 25
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'open'
  },
  expectedCloseAt: DataTypes.DATE,
  metadata: DataTypes.JSON
});

const Task = sequelize.define('Task', {
  orgId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  contactId: DataTypes.INTEGER,
  dealId: DataTypes.INTEGER,
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'follow_up'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'open'
  },
  assignedTo: DataTypes.STRING,
  dueAt: DataTypes.DATE,
  notes: DataTypes.TEXT
});

Contact.belongsToMany(Tag, { through: 'ContactTags' });
Tag.belongsToMany(Contact, { through: 'ContactTags' });
Contact.belongsToMany(CustomField, { through: ContactCustomField });
CustomField.belongsToMany(Contact, { through: ContactCustomField });
Contact.hasMany(Deal, { foreignKey: 'contactId' });
Deal.belongsTo(Contact, { foreignKey: 'contactId' });
Contact.hasMany(Task, { foreignKey: 'contactId' });
Task.belongsTo(Contact, { foreignKey: 'contactId' });
Deal.hasMany(Task, { foreignKey: 'dealId' });
Task.belongsTo(Deal, { foreignKey: 'dealId' });

async function initDb() {
  await sequelize.sync();
}

module.exports = {
  initDb,
  Contact,
  Tag,
  CustomField,
  ContactCustomField,
  Deal,
  Task
};
