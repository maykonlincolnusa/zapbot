function parseDefinition(flow) {
  const definition = typeof flow.definition === 'string' ? JSON.parse(flow.definition) : flow.definition;
  return {
    start: definition.start || definition.startStepId || Object.keys(definition.steps || {})[0],
    steps: definition.steps || {}
  };
}

function getStep(definition, stepId) {
  if (!stepId || !definition.steps[stepId]) {
    return null;
  }
  return definition.steps[stepId];
}

function stepMessage(step) {
  return step.message || step.prompt || step.text || '';
}

function stepOptions(step) {
  return step.options || step.buttons || [];
}

function renderStep(step) {
  const options = stepOptions(step);
  const text = stepMessage(step);

  if (!options.length) return text;

  const renderedOptions = options.map((option, index) => `${index + 1}. ${option.label || option.title || option.value}`);
  return `${text}\n\n${renderedOptions.join('\n')}`;
}

function resolveNextStep(step, userMessage) {
  const normalized = String(userMessage || '').trim().toLowerCase();
  const options = stepOptions(step);

  if (!options.length) {
    return step.nextStepId || step.next || null;
  }

  const numericIndex = Number(normalized);
  if (Number.isInteger(numericIndex) && numericIndex >= 1 && numericIndex <= options.length) {
    return options[numericIndex - 1].nextStepId || options[numericIndex - 1].next || null;
  }

  const selected = options.find((option) => {
    const label = String(option.label || option.title || '').trim().toLowerCase();
    const value = String(option.value || option.id || '').trim().toLowerCase();
    return normalized === label || normalized === value;
  });

  return selected ? selected.nextStepId || selected.next || null : step.fallbackStepId || step.nextStepId || null;
}

async function startFlow({ models, workspaceId, contactId, flow }) {
  const definition = parseDefinition(flow);
  const startStep = getStep(definition, definition.start);

  if (!startStep) {
    throw new Error('Flow has no valid start step');
  }

  await models.FlowSession.update(
    { active: false, completedAt: new Date() },
    { where: { workspaceId: workspaceId || flow.workspaceId, ContactId: contactId, active: true } }
  );

  await models.FlowSession.create({
    workspaceId: workspaceId || flow.workspaceId,
    ContactId: contactId,
    FlowId: flow.id,
    currentStepId: definition.start,
    state: {},
    active: true
  });

  return {
    reply: renderStep(startStep),
    currentStepId: definition.start,
    completed: false
  };
}

async function processFlowMessage({ models, session, userMessage }) {
  const flow = await models.Flow.findOne({
    where: {
      id: session.FlowId,
      workspaceId: session.workspaceId
    }
  });
  if (!flow || !flow.active) {
    await session.update({ active: false, completedAt: new Date() });
    return { handled: false };
  }

  const definition = parseDefinition(flow);
  const currentStep = getStep(definition, session.currentStepId);

  if (!currentStep) {
    await session.update({ active: false, completedAt: new Date() });
    return { handled: false };
  }

  const nextStepId = resolveNextStep(currentStep, userMessage);

  if (!nextStepId) {
    await session.update({ active: false, completedAt: new Date() });
    return {
      handled: true,
      completed: true,
      reply: currentStep.completionMessage || 'Obrigado. Encerramos este fluxo por enquanto.'
    };
  }

  const nextStep = getStep(definition, nextStepId);
  if (!nextStep) {
    await session.update({ active: false, completedAt: new Date() });
    return {
      handled: true,
      completed: true,
      reply: 'Nao encontrei o proximo passo desse fluxo. Um atendente pode continuar daqui.'
    };
  }

  await session.update({
    currentStepId: nextStepId,
    state: {
      ...session.state,
      lastInput: userMessage,
      previousStepId: session.currentStepId
    }
  });

  return {
    handled: true,
    completed: false,
    reply: renderStep(nextStep),
    currentStepId: nextStepId
  };
}

module.exports = {
  parseDefinition,
  renderStep,
  startFlow,
  processFlowMessage
};
