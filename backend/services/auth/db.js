const { DataTypes } = require('sequelize');
const { createSqliteSequelize } = require('../_shared/sqlite');
require('dotenv').config();

const sequelize = createSqliteSequelize('AUTH_DATABASE_URL', 'auth.sqlite');

const Organization = sequelize.define('Organization', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  plan: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'trial'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'active'
  }
});

const User = sequelize.define('User', {
  orgId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'admin'
  }
});

Organization.hasMany(User, { foreignKey: 'orgId' });
User.belongsTo(Organization, { foreignKey: 'orgId' });

async function initDb() {
  await sequelize.sync();
}

module.exports = {
  initDb,
  Organization,
  User
};
