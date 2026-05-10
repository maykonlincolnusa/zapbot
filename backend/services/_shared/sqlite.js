const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

function ensureDataDir() {
  fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
}

function createSqliteSequelize(envKey, fallbackFile) {
  ensureDataDir();

  return new Sequelize(process.env[envKey] || `sqlite:./data/${fallbackFile}`, {
    logging: false,
    retry: {
      match: [/SQLITE_BUSY/],
      max: 5
    }
  });
}

module.exports = {
  createSqliteSequelize,
  ensureDataDir
};
