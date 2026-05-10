const cron = require('node-cron');
const { Op } = require('sequelize');
const {
  Broadcast,
  BroadcastRecipient,
  Contact,
  Flow,
  FlowSession
} = require('../models');
const { startFlow } = require('../flowEngine');
const { sendAndRecordText } = require('./messaging');
const { PRODUCT_NAME } = require('../config/product');

async function sendBroadcastRecipient(recipient) {
  const broadcast = recipient.Broadcast;
  const contact = recipient.Contact;

  if (broadcast.flowId) {
    const flow = await Flow.findOne({ where: { id: broadcast.flowId, workspaceId: broadcast.workspaceId } });
    if (!flow) throw new Error(`Flow ${broadcast.flowId} not found for broadcast`);

    const result = await startFlow({
      models: { FlowSession },
      workspaceId: broadcast.workspaceId,
      contactId: contact.id,
      flow
    });

    await sendAndRecordText(contact, result.reply, {
      source: 'broadcast',
      broadcastId: broadcast.id,
      flowId: flow.id
    });
    return;
  }

  await sendAndRecordText(contact, broadcast.messageText, {
    source: 'broadcast',
    broadcastId: broadcast.id
  });
}

async function markCompletedBroadcasts() {
  const activeBroadcasts = await Broadcast.findAll({
    where: {
      status: { [Op.in]: ['scheduled', 'sending'] }
    }
  });

  for (const broadcast of activeBroadcasts) {
    const pending = await BroadcastRecipient.count({
      where: {
        BroadcastId: broadcast.id,
        status: { [Op.in]: ['pending', 'sending'] }
      }
    });

    if (pending === 0) {
      await broadcast.update({
        status: 'completed',
        completedAt: new Date()
      });
    }
  }
}

async function processDueBroadcastRecipients() {
  const now = new Date();
  const recipients = await BroadcastRecipient.findAll({
    where: {
      status: 'pending',
      scheduledAt: { [Op.lte]: now }
    },
    include: [Contact, Broadcast],
    limit: Number(process.env.BROADCAST_BATCH_SIZE || 25),
    order: [['scheduledAt', 'ASC']]
  });

  for (const recipient of recipients) {
    try {
      await recipient.update({ status: 'sending' });
      await recipient.Broadcast.update({ status: 'sending' });
      await sendBroadcastRecipient(recipient);
      await recipient.update({ status: 'sent', sentAt: new Date(), error: null });
    } catch (error) {
      await recipient.update({ status: 'failed', error: error.message });
      console.error(`[${PRODUCT_NAME}] Broadcast recipient failed`, {
        recipientId: recipient.id,
        error: error.message
      });
    }
  }

  await markCompletedBroadcasts();
  return recipients.length;
}

function startBroadcastScheduler() {
  if (process.env.DISABLE_CRON === 'true') return null;

  // Best practice: avoid blasting the full base at once. Use smaller filtered segments,
  // smart delays and multiple sending windows to protect deliverability and user trust.
  return cron.schedule(process.env.BROADCAST_CRON || '*/10 * * * * *', () => {
    processDueBroadcastRecipients().catch((error) => {
      console.error(`[${PRODUCT_NAME}] Broadcast scheduler failed`, error);
    });
  });
}

module.exports = {
  startBroadcastScheduler,
  processDueBroadcastRecipients
};
