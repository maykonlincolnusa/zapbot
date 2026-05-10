const cron = require('node-cron');
const { Op } = require('sequelize');
const {
  Sequence,
  SequenceStep,
  SequenceEnrollment,
  Contact,
  Flow,
  FlowSession
} = require('../models');
const { startFlow } = require('../flowEngine');
const { sendAndRecordText } = require('./messaging');
const { PRODUCT_NAME } = require('../config/product');

function nextStepFor(sequence, currentStepOrder) {
  return [...(sequence.steps || [])]
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .find((step) => step.stepOrder > currentStepOrder);
}

async function sendSequenceStep(enrollment, step) {
  const contact = enrollment.Contact;

  if (step.flowId) {
    const flow = await Flow.findOne({ where: { id: step.flowId, workspaceId: enrollment.workspaceId } });
    if (!flow) throw new Error(`Flow ${step.flowId} not found for sequence step`);

    const result = await startFlow({
      models: { FlowSession },
      workspaceId: enrollment.workspaceId,
      contactId: contact.id,
      flow
    });

    await sendAndRecordText(contact, result.reply, {
      source: 'sequence',
      sequenceId: enrollment.SequenceId,
      stepOrder: step.stepOrder,
      flowId: flow.id
    });
    return;
  }

  await sendAndRecordText(contact, step.messageText, {
    source: 'sequence',
    sequenceId: enrollment.SequenceId,
    stepOrder: step.stepOrder
  });
}

async function processDueSequenceSteps() {
  const now = new Date();
  const dueEnrollments = await SequenceEnrollment.findAll({
    where: {
      workspaceId: { [Op.ne]: null },
      status: 'active',
      nextRunAt: { [Op.lte]: now }
    },
    include: [
      Contact,
      {
        model: Sequence,
        include: [{ model: SequenceStep, as: 'steps' }]
      }
    ],
    limit: Number(process.env.SEQUENCE_BATCH_SIZE || 50)
  });

  for (const enrollment of dueEnrollments) {
    const sequence = enrollment.Sequence;

    if (!sequence || !sequence.active) {
      await enrollment.update({ status: 'paused' });
      continue;
    }

    const step = nextStepFor(sequence, enrollment.currentStepOrder);
    if (!step) {
      await enrollment.update({ status: 'completed', nextRunAt: null });
      continue;
    }

    try {
      await sendSequenceStep(enrollment, step);

      const nextStep = nextStepFor(sequence, step.stepOrder);
      await enrollment.update({
        currentStepOrder: step.stepOrder,
        lastStepSentAt: now,
        status: nextStep ? 'active' : 'completed',
        nextRunAt: nextStep ? new Date(Date.now() + nextStep.delayMinutes * 60 * 1000) : null
      });
    } catch (error) {
      await enrollment.update({
        status: 'error',
        nextRunAt: null
      });
      console.error(`[${PRODUCT_NAME}] Sequence step failed`, {
        enrollmentId: enrollment.id,
        error: error.message
      });
    }
  }

  return dueEnrollments.length;
}

function startSequenceScheduler() {
  if (process.env.DISABLE_CRON === 'true') return null;

  return cron.schedule(process.env.SEQUENCE_CRON || '* * * * *', () => {
    processDueSequenceSteps().catch((error) => {
      console.error(`[${PRODUCT_NAME}] Sequence scheduler failed`, error);
    });
  });
}

module.exports = {
  startSequenceScheduler,
  processDueSequenceSteps
};
