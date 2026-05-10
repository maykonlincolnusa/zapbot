const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const { PRODUCT_NAME } = require('../config/product');

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
const dialect = databaseUrl ? 'postgres' : 'sqlite';
const storage = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'zapbot-ai.sqlite');
const logging = process.env.SQL_LOGGING === 'true' ? console.log : false;

const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, {
      dialect: 'postgres',
      logging,
      dialectOptions: {
        ssl:
          process.env.DB_SSL === 'false'
            ? false
            : {
                require: true,
                rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
              }
      },
      pool: {
        max: Number(process.env.DB_POOL_MAX || 10),
        min: Number(process.env.DB_POOL_MIN || 0),
        acquire: Number(process.env.DB_POOL_ACQUIRE_MS || 30000),
        idle: Number(process.env.DB_POOL_IDLE_MS || 10000)
      }
    })
  : new Sequelize({
      dialect: 'sqlite',
      storage,
      logging
    });

const isPostgres = dialect === 'postgres';
const jsonType = isPostgres ? DataTypes.JSONB : DataTypes.TEXT;

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function stringifyJson(value, fallback) {
  const normalized = value === undefined ? fallback : value;
  return isPostgres ? normalized : JSON.stringify(normalized);
}

function jsonColumn(fieldName, defaultValue) {
  return {
    type: jsonType,
    allowNull: false,
    defaultValue: stringifyJson(defaultValue, defaultValue),
    get() {
      return parseJson(this.getDataValue(fieldName), defaultValue);
    },
    set(value) {
      this.setDataValue(fieldName, stringifyJson(value, defaultValue));
    }
  };
}

const tenantReference = {
  type: DataTypes.INTEGER,
  allowNull: true
};

const Workspace = sequelize.define('Workspace', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  plan: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'starter'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'active'
  },
  settings: jsonColumn('settings', {})
});

const Contact = sequelize.define(
  'Contact',
  {
    workspaceId: tenantReference,
    name: DataTypes.STRING,
    phone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: DataTypes.STRING,
    tags: jsonColumn('tags', []),
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active'
    },
    metadata: jsonColumn('metadata', {})
  },
  {
    indexes: [
      { fields: ['workspaceId', 'phone'], unique: true },
      { fields: ['workspaceId', 'status'] }
    ]
  }
);

const Flow = sequelize.define(
  'Flow',
  {
    workspaceId: tenantReference,
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    trigger: DataTypes.STRING,
    definition: jsonColumn('definition', {}),
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    indexes: [{ fields: ['workspaceId', 'active'] }]
  }
);

const FlowSession = sequelize.define(
  'FlowSession',
  {
    workspaceId: tenantReference,
    currentStepId: DataTypes.STRING,
    state: jsonColumn('state', {}),
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    completedAt: DataTypes.DATE
  },
  {
    indexes: [{ fields: ['workspaceId', 'active'] }]
  }
);

const Sequence = sequelize.define(
  'Sequence',
  {
    workspaceId: tenantReference,
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: DataTypes.TEXT,
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    indexes: [{ fields: ['workspaceId', 'active'] }]
  }
);

const SequenceStep = sequelize.define('SequenceStep', {
  workspaceId: tenantReference,
  stepOrder: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  delayMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  messageText: DataTypes.TEXT,
  flowId: DataTypes.INTEGER
});

const SequenceEnrollment = sequelize.define(
  'SequenceEnrollment',
  {
    workspaceId: tenantReference,
    currentStepOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active'
    },
    nextRunAt: DataTypes.DATE,
    lastStepSentAt: DataTypes.DATE
  },
  {
    indexes: [{ fields: ['workspaceId', 'status', 'nextRunAt'] }]
  }
);

const Broadcast = sequelize.define(
  'Broadcast',
  {
    workspaceId: tenantReference,
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    messageText: DataTypes.TEXT,
    flowId: DataTypes.INTEGER,
    targetTags: jsonColumn('targetTags', []),
    delayType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'smart'
    },
    delayMinSeconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    delayMaxSeconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'draft'
    },
    startedAt: DataTypes.DATE,
    completedAt: DataTypes.DATE
  },
  {
    indexes: [{ fields: ['workspaceId', 'status'] }]
  }
);

const BroadcastRecipient = sequelize.define(
  'BroadcastRecipient',
  {
    workspaceId: tenantReference,
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending'
    },
    scheduledAt: DataTypes.DATE,
    sentAt: DataTypes.DATE,
    error: DataTypes.TEXT
  },
  {
    indexes: [{ fields: ['workspaceId', 'status', 'scheduledAt'] }]
  }
);

const Attendant = sequelize.define(
  'Attendant',
  {
    workspaceId: tenantReference,
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'attendant'
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    indexes: [
      { fields: ['workspaceId', 'email'], unique: true },
      { fields: ['email'] }
    ]
  }
);

const Chat = sequelize.define(
  'Chat',
  {
    workspaceId: tenantReference,
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'open'
    },
    lastMessageAt: DataTypes.DATE
  },
  {
    indexes: [{ fields: ['workspaceId', 'status', 'lastMessageAt'] }]
  }
);

const Message = sequelize.define(
  'Message',
  {
    workspaceId: tenantReference,
    direction: {
      type: DataTypes.STRING,
      allowNull: false
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    whatsappMessageId: DataTypes.STRING,
    status: DataTypes.STRING,
    metadata: jsonColumn('metadata', {})
  },
  {
    indexes: [
      { fields: ['workspaceId', 'createdAt'] },
      { fields: ['workspaceId', 'whatsappMessageId'] }
    ]
  }
);

const WebhookEvent = sequelize.define(
  'WebhookEvent',
  {
    workspaceId: tenantReference,
    eventType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    whatsappMessageId: DataTypes.STRING,
    contactPhone: DataTypes.STRING,
    status: DataTypes.STRING,
    payload: jsonColumn('payload', {}),
    processedAt: DataTypes.DATE
  },
  {
    indexes: [
      { fields: ['workspaceId', 'eventType', 'createdAt'] },
      { fields: ['workspaceId', 'whatsappMessageId'] }
    ]
  }
);

const RagDocument = sequelize.define(
  'RagDocument',
  {
    workspaceId: tenantReference,
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    source: DataTypes.STRING,
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'uploaded'
    }
  },
  {
    indexes: [{ fields: ['workspaceId', 'status'] }]
  }
);

const RagChunk = sequelize.define('RagChunk', {
  workspaceId: tenantReference,
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  vectorId: DataTypes.STRING,
  metadata: jsonColumn('metadata', {})
});

const AiAgent = sequelize.define(
  'AiAgent',
  {
    workspaceId: tenantReference,
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'openrouter'
    },
    model: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'openai/gpt-4o-mini'
    },
    systemPrompt: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'Você é um atendente comercial objetivo, cordial e útil no WhatsApp.'
    },
    temperature: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.4
    },
    fallbackText: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'Recebi sua mensagem. Um atendente vai continuar o atendimento por aqui.'
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    metadata: jsonColumn('metadata', {})
  },
  {
    indexes: [
      { fields: ['workspaceId', 'active'] },
      { fields: ['workspaceId', 'isDefault'] }
    ]
  }
);

const IntegrationServer = sequelize.define(
  'IntegrationServer',
  {
    workspaceId: tenantReference,
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'custom'
    },
    endpointUrl: {
      type: DataTypes.STRING,
      allowNull: false
    },
    authType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'bearer'
    },
    authToken: DataTypes.TEXT,
    availableTools: jsonColumn('availableTools', []),
    eventMappings: jsonColumn('eventMappings', []),
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    lastDiscoveredAt: DataTypes.DATE,
    metadata: jsonColumn('metadata', {})
  },
  {
    indexes: [
      { fields: ['workspaceId', 'active'] },
      { fields: ['workspaceId', 'provider'] }
    ]
  }
);

Workspace.hasMany(Contact, { foreignKey: 'workspaceId' });
Contact.belongsTo(Workspace, { foreignKey: 'workspaceId' });

Workspace.hasMany(Attendant, { foreignKey: 'workspaceId' });
Attendant.belongsTo(Workspace, { foreignKey: 'workspaceId' });

Workspace.hasMany(Flow, { foreignKey: 'workspaceId' });
Flow.belongsTo(Workspace, { foreignKey: 'workspaceId' });

Workspace.hasMany(Sequence, { foreignKey: 'workspaceId' });
Sequence.belongsTo(Workspace, { foreignKey: 'workspaceId' });

Workspace.hasMany(Broadcast, { foreignKey: 'workspaceId' });
Broadcast.belongsTo(Workspace, { foreignKey: 'workspaceId' });

Workspace.hasMany(Chat, { foreignKey: 'workspaceId' });
Chat.belongsTo(Workspace, { foreignKey: 'workspaceId' });

Workspace.hasMany(Message, { foreignKey: 'workspaceId' });
Message.belongsTo(Workspace, { foreignKey: 'workspaceId' });

Workspace.hasMany(WebhookEvent, { foreignKey: 'workspaceId' });
WebhookEvent.belongsTo(Workspace, { foreignKey: 'workspaceId' });

Workspace.hasMany(AiAgent, { foreignKey: 'workspaceId' });
AiAgent.belongsTo(Workspace, { foreignKey: 'workspaceId' });

Workspace.hasMany(RagDocument, { foreignKey: 'workspaceId' });
RagDocument.belongsTo(Workspace, { foreignKey: 'workspaceId' });

Workspace.hasMany(IntegrationServer, { foreignKey: 'workspaceId' });
IntegrationServer.belongsTo(Workspace, { foreignKey: 'workspaceId' });

Contact.hasMany(Chat, { foreignKey: 'ContactId' });
Chat.belongsTo(Contact, { foreignKey: 'ContactId' });

Attendant.hasMany(Chat, { foreignKey: 'assignedAttendantId' });
Chat.belongsTo(Attendant, { as: 'assignedAttendant', foreignKey: 'assignedAttendantId' });

Contact.hasMany(Message, { foreignKey: 'ContactId' });
Message.belongsTo(Contact, { foreignKey: 'ContactId' });
Chat.hasMany(Message, { foreignKey: 'ChatId' });
Message.belongsTo(Chat, { foreignKey: 'ChatId' });

Flow.hasMany(FlowSession, { foreignKey: 'FlowId' });
FlowSession.belongsTo(Flow, { foreignKey: 'FlowId' });
Contact.hasMany(FlowSession, { foreignKey: 'ContactId' });
FlowSession.belongsTo(Contact, { foreignKey: 'ContactId' });

Sequence.hasMany(SequenceStep, { as: 'steps', foreignKey: 'SequenceId', onDelete: 'CASCADE' });
SequenceStep.belongsTo(Sequence, { foreignKey: 'SequenceId' });
Sequence.hasMany(SequenceEnrollment, { as: 'enrollments', foreignKey: 'SequenceId', onDelete: 'CASCADE' });
SequenceEnrollment.belongsTo(Sequence, { foreignKey: 'SequenceId' });
Contact.hasMany(SequenceEnrollment, { foreignKey: 'ContactId' });
SequenceEnrollment.belongsTo(Contact, { foreignKey: 'ContactId' });

Broadcast.hasMany(BroadcastRecipient, { as: 'recipients', foreignKey: 'BroadcastId', onDelete: 'CASCADE' });
BroadcastRecipient.belongsTo(Broadcast, { foreignKey: 'BroadcastId' });
Contact.hasMany(BroadcastRecipient, { foreignKey: 'ContactId' });
BroadcastRecipient.belongsTo(Contact, { foreignKey: 'ContactId' });

RagDocument.hasMany(RagChunk, { as: 'chunks', foreignKey: 'RagDocumentId', onDelete: 'CASCADE' });
RagChunk.belongsTo(RagDocument, { foreignKey: 'RagDocumentId' });

function slugify(value) {
  return String(value || 'workspace')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'workspace';
}

async function getDefaultWorkspace() {
  const [workspace] = await Workspace.findOrCreate({
    where: { slug: process.env.DEFAULT_WORKSPACE_SLUG || 'default' },
    defaults: {
      name: process.env.DEFAULT_WORKSPACE_NAME || `${PRODUCT_NAME} Demo`,
      slug: process.env.DEFAULT_WORKSPACE_SLUG || 'default',
      plan: 'starter',
      status: 'active',
      settings: {}
    }
  });

  return workspace;
}

async function initDatabase() {
  const alter = process.env.DB_SYNC_ALTER === 'true';
  await sequelize.sync({ alter });
  const workspace = await getDefaultWorkspace();

  for (const model of [
    Contact,
    Flow,
    FlowSession,
    Sequence,
    SequenceStep,
    SequenceEnrollment,
    Broadcast,
    BroadcastRecipient,
    Attendant,
    Chat,
    Message,
    WebhookEvent,
    RagDocument,
    RagChunk,
    AiAgent,
    IntegrationServer
  ]) {
    await model.update(
      { workspaceId: workspace.id },
      { where: { workspaceId: null } }
    );
  }
}

module.exports = {
  sequelize,
  initDatabase,
  parseJson,
  slugify,
  getDefaultWorkspace,
  dialect,
  Workspace,
  Contact,
  Flow,
  FlowSession,
  Sequence,
  SequenceStep,
  SequenceEnrollment,
  Broadcast,
  BroadcastRecipient,
  Attendant,
  Chat,
  Message,
  WebhookEvent,
  RagDocument,
  RagChunk,
  AiAgent,
  IntegrationServer
};
