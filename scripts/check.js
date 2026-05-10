const { readdirSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const files = [
  'server.js',
  'whatsapp.js',
  'openai.js',
  'openrouter.js',
  'flowEngine.js',
  'rag.js',
  'webhookHandler.js',
  'models/index.js',
  'middleware/auth.js',
  ...readdirSync('ai').filter((file) => file.endsWith('.js')).map((file) => join('ai', file)),
  ...readdirSync('integrations').filter((file) => file.endsWith('.js')).map((file) => join('integrations', file)),
  ...readdirSync('routes').filter((file) => file.endsWith('.js')).map((file) => join('routes', file)),
  ...readdirSync('tasks').filter((file) => file.endsWith('.js')).map((file) => join('tasks', file))
];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status);
  }
}

console.log(`Checked ${files.length} JavaScript files.`);
