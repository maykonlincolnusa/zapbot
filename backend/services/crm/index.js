const { Op } = require('sequelize');
const { createServiceApp, startService } = require('../_shared/app');
const { requireAuthOrService } = require('../_shared/auth');
const { normalizePhone } = require('../_shared/phone');
const { requestOrgId } = require('../_shared/tenant');
const { initDb, Contact, Tag, CustomField, ContactCustomField, Deal, Task } = require('./db');
require('dotenv').config();

const app = createServiceApp('crm-service');
const port = process.env.CRM_PORT || 3002;

app.use(requireAuthOrService);

async function includeContactAssociations(contactId) {
  return Contact.findByPk(contactId, {
    include: [
      { model: Tag },
      { model: CustomField }
    ]
  });
}

async function upsertContact(req, payload) {
  const phone = normalizePhone(payload.phone);
  if (!phone) throw new Error('phone is required');

  const [contact] = await Contact.findOrCreate({
    where: { orgId: requestOrgId(req), phone },
    defaults: {
      orgId: requestOrgId(req),
      phone,
      name: payload.name,
      email: payload.email,
      stage: payload.stage || 'Novo lead',
      metadata: payload.metadata || {}
    }
  });

  await contact.update({
    name: payload.name ?? contact.name,
    email: payload.email ?? contact.email,
    stage: payload.stage ?? contact.stage,
    assignedTo: payload.assignedTo ?? contact.assignedTo,
    notes: payload.notes ?? contact.notes,
    metadata: { ...(contact.metadata || {}), ...(payload.metadata || {}) }
  });

  if (payload.tags?.length) {
    const tags = [];
    for (const name of payload.tags) {
      const [tag] = await Tag.findOrCreate({
        where: { orgId: requestOrgId(req), name: String(name).trim() },
        defaults: { orgId: requestOrgId(req), name: String(name).trim() }
      });
      tags.push(tag);
    }
    await contact.addTags(tags);
  }

  return includeContactAssociations(contact.id);
}

app.get('/contacts', async (req, res, next) => {
  try {
    const where = { orgId: requestOrgId(req) };
    if (req.query.q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${req.query.q}%` } },
        { phone: { [Op.like]: `%${req.query.q}%` } },
        { email: { [Op.like]: `%${req.query.q}%` } }
      ];
    }

    const contacts = await Contact.findAll({
      where,
      include: [Tag, CustomField],
      order: [['updatedAt', 'DESC']]
    });
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

app.post('/contacts', async (req, res, next) => {
  try {
    const contact = await upsertContact(req, req.body);
    res.status(201).json(contact);
  } catch (error) {
    next(error);
  }
});

app.get('/contacts/by-phone/:phone', async (req, res, next) => {
  try {
    const contact = await Contact.findOne({
      where: { orgId: requestOrgId(req), phone: normalizePhone(req.params.phone) },
      include: [Tag, CustomField]
    });
    if (!contact) return res.sendStatus(404);
    res.json(contact);
  } catch (error) {
    next(error);
  }
});

app.get('/contacts/:id', async (req, res, next) => {
  try {
    const contact = await Contact.findOne({
      where: { id: req.params.id, orgId: requestOrgId(req) },
      include: [Tag, CustomField]
    });
    if (!contact) return res.sendStatus(404);
    res.json(contact);
  } catch (error) {
    next(error);
  }
});

app.patch('/contacts/:id', async (req, res, next) => {
  try {
    const contact = await Contact.findOne({ where: { id: req.params.id, orgId: requestOrgId(req) } });
    if (!contact) return res.sendStatus(404);

    await contact.update(req.body);
    res.json(await includeContactAssociations(contact.id));
  } catch (error) {
    next(error);
  }
});

app.delete('/contacts/:id', async (req, res, next) => {
  try {
    const deleted = await Contact.destroy({ where: { id: req.params.id, orgId: requestOrgId(req) } });
    res.status(deleted ? 204 : 404).send();
  } catch (error) {
    next(error);
  }
});

app.post('/contacts/:id/tags', async (req, res, next) => {
  try {
    const contact = await Contact.findOne({ where: { id: req.params.id, orgId: requestOrgId(req) } });
    if (!contact) return res.sendStatus(404);

    const tags = [];
    for (const name of req.body.tags || []) {
      const [tag] = await Tag.findOrCreate({
        where: { orgId: requestOrgId(req), name: String(name).trim() },
        defaults: { orgId: requestOrgId(req), name: String(name).trim() }
      });
      tags.push(tag);
    }
    await contact.addTags(tags);
    res.json(await includeContactAssociations(contact.id));
  } catch (error) {
    next(error);
  }
});

app.post('/contacts/:id/custom-fields', async (req, res, next) => {
  try {
    const contact = await Contact.findOne({ where: { id: req.params.id, orgId: requestOrgId(req) } });
    if (!contact) return res.sendStatus(404);

    for (const [key, value] of Object.entries(req.body.fields || {})) {
      const [field] = await CustomField.findOrCreate({
        where: { orgId: requestOrgId(req), key },
        defaults: { orgId: requestOrgId(req), key, label: key, type: 'text' }
      });
      await ContactCustomField.upsert({
        ContactId: contact.id,
        CustomFieldId: field.id,
        value: String(value)
      });
    }

    res.json(await includeContactAssociations(contact.id));
  } catch (error) {
    next(error);
  }
});

app.post('/contacts/:id/custom-fields/:fieldId', async (req, res, next) => {
  try {
    const contact = await Contact.findOne({ where: { id: req.params.id, orgId: requestOrgId(req) } });
    const field = await CustomField.findOne({ where: { id: req.params.fieldId, orgId: requestOrgId(req) } });
    if (!contact || !field) return res.sendStatus(404);

    await ContactCustomField.upsert({
      ContactId: contact.id,
      CustomFieldId: field.id,
      value: String(req.body.value)
    });

    res.json(await includeContactAssociations(contact.id));
  } catch (error) {
    next(error);
  }
});

app.delete('/contacts/:id/custom-fields/:fieldId', async (req, res, next) => {
  try {
    const deleted = await ContactCustomField.destroy({
      where: {
        ContactId: req.params.id,
        CustomFieldId: req.params.fieldId
      }
    });
    res.status(deleted ? 204 : 404).send();
  } catch (error) {
    next(error);
  }
});

app.post('/contacts/:id/assign', async (req, res, next) => {
  try {
    const contact = await Contact.findOne({ where: { id: req.params.id, orgId: requestOrgId(req) } });
    if (!contact) return res.sendStatus(404);

    await contact.update({ assignedTo: req.body.assignedTo || null });
    res.json(await includeContactAssociations(contact.id));
  } catch (error) {
    next(error);
  }
});

app.get('/tags', async (req, res, next) => {
  try {
    res.json(await Tag.findAll({ where: { orgId: requestOrgId(req) }, order: [['name', 'ASC']] }));
  } catch (error) {
    next(error);
  }
});

app.post('/tags', async (req, res, next) => {
  try {
    const tag = await Tag.create({ orgId: requestOrgId(req), name: req.body.name, color: req.body.color });
    res.status(201).json(tag);
  } catch (error) {
    next(error);
  }
});

app.get('/custom-fields', async (req, res, next) => {
  try {
    res.json(await CustomField.findAll({ where: { orgId: requestOrgId(req) }, order: [['label', 'ASC']] }));
  } catch (error) {
    next(error);
  }
});

app.post('/custom-fields', async (req, res, next) => {
  try {
    const field = await CustomField.create({
      orgId: requestOrgId(req),
      key: req.body.key,
      label: req.body.label,
      type: req.body.type || 'text'
    });
    res.status(201).json(field);
  } catch (error) {
    next(error);
  }
});

app.get('/deals', async (req, res, next) => {
  try {
    const where = { orgId: requestOrgId(req) };
    if (req.query.status) where.status = req.query.status;
    if (req.query.stage) where.stage = req.query.stage;

    res.json(
      await Deal.findAll({
        where,
        include: [Contact, Task],
        order: [['updatedAt', 'DESC']]
      })
    );
  } catch (error) {
    next(error);
  }
});

app.post('/deals', async (req, res, next) => {
  try {
    const contact = await Contact.findOne({
      where: { id: req.body.contactId, orgId: requestOrgId(req) }
    });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const deal = await Deal.create({
      orgId: requestOrgId(req),
      contactId: contact.id,
      title: req.body.title,
      stage: req.body.stage || 'Novo',
      valueCents: req.body.valueCents || 0,
      currency: req.body.currency || 'BRL',
      probability: req.body.probability ?? 25,
      status: req.body.status || 'open',
      expectedCloseAt: req.body.expectedCloseAt,
      metadata: req.body.metadata || {}
    });

    res.status(201).json(await Deal.findByPk(deal.id, { include: [Contact, Task] }));
  } catch (error) {
    next(error);
  }
});

app.patch('/deals/:id', async (req, res, next) => {
  try {
    const deal = await Deal.findOne({ where: { id: req.params.id, orgId: requestOrgId(req) } });
    if (!deal) return res.sendStatus(404);

    await deal.update({
      title: req.body.title ?? deal.title,
      stage: req.body.stage ?? deal.stage,
      valueCents: req.body.valueCents ?? deal.valueCents,
      currency: req.body.currency ?? deal.currency,
      probability: req.body.probability ?? deal.probability,
      status: req.body.status ?? deal.status,
      expectedCloseAt: req.body.expectedCloseAt ?? deal.expectedCloseAt,
      metadata: req.body.metadata ?? deal.metadata
    });

    res.json(await Deal.findByPk(deal.id, { include: [Contact, Task] }));
  } catch (error) {
    next(error);
  }
});

app.get('/tasks', async (req, res, next) => {
  try {
    const where = { orgId: requestOrgId(req) };
    if (req.query.status) where.status = req.query.status;
    if (req.query.assignedTo) where.assignedTo = req.query.assignedTo;

    res.json(
      await Task.findAll({
        where,
        include: [Contact, Deal],
        order: [
          ['dueAt', 'ASC'],
          ['createdAt', 'DESC']
        ]
      })
    );
  } catch (error) {
    next(error);
  }
});

app.post('/tasks', async (req, res, next) => {
  try {
    if (req.body.contactId) {
      const contact = await Contact.findOne({
        where: { id: req.body.contactId, orgId: requestOrgId(req) }
      });
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
    }

    if (req.body.dealId) {
      const deal = await Deal.findOne({ where: { id: req.body.dealId, orgId: requestOrgId(req) } });
      if (!deal) return res.status(404).json({ error: 'Deal not found' });
    }

    const task = await Task.create({
      orgId: requestOrgId(req),
      contactId: req.body.contactId || null,
      dealId: req.body.dealId || null,
      title: req.body.title,
      type: req.body.type || 'follow_up',
      status: req.body.status || 'open',
      assignedTo: req.body.assignedTo,
      dueAt: req.body.dueAt,
      notes: req.body.notes
    });

    res.status(201).json(await Task.findByPk(task.id, { include: [Contact, Deal] }));
  } catch (error) {
    next(error);
  }
});

app.patch('/tasks/:id', async (req, res, next) => {
  try {
    const task = await Task.findOne({ where: { id: req.params.id, orgId: requestOrgId(req) } });
    if (!task) return res.sendStatus(404);

    await task.update({
      title: req.body.title ?? task.title,
      type: req.body.type ?? task.type,
      status: req.body.status ?? task.status,
      assignedTo: req.body.assignedTo ?? task.assignedTo,
      dueAt: req.body.dueAt ?? task.dueAt,
      notes: req.body.notes ?? task.notes
    });

    res.json(await Task.findByPk(task.id, { include: [Contact, Deal] }));
  } catch (error) {
    next(error);
  }
});

initDb()
  .then(() => startService(app, 'crm-service', port))
  .catch((error) => {
    console.error('crm-service failed to start', error);
    process.exit(1);
  });
