const { Chat, Message } = require('../models');
const { sendMediaMessage, sendTemplateMessage, sendTextMessage } = require('../whatsapp');

async function findOrCreateOpenChat(contact) {
  const [chat] = await Chat.findOrCreate({
    where: {
      workspaceId: contact.workspaceId,
      ContactId: contact.id,
      status: 'open'
    },
    defaults: {
      workspaceId: contact.workspaceId,
      ContactId: contact.id,
      status: 'open',
      lastMessageAt: new Date()
    }
  });

  return chat;
}

async function sendAndRecordText(contact, body, metadata = {}) {
  const chat = await findOrCreateOpenChat(contact);
  const whatsappResponse = await sendTextMessage(contact.phone, body);

  const message = await Message.create({
    ChatId: chat.id,
    ContactId: contact.id,
    workspaceId: contact.workspaceId,
    direction: 'outbound',
    body,
    whatsappMessageId: whatsappResponse?.messages?.[0]?.id || whatsappResponse?.id,
    status: whatsappResponse?.skipped ? 'skipped' : 'sent',
    metadata
  });

  await chat.update({ lastMessageAt: new Date() });

  return message;
}

async function sendAndRecordTemplate(contact, templateName, options = {}, metadata = {}) {
  const chat = await findOrCreateOpenChat(contact);
  const whatsappResponse = await sendTemplateMessage(
    contact.phone,
    templateName,
    options.languageCode || 'pt_BR',
    options.components || []
  );

  const message = await Message.create({
    ChatId: chat.id,
    ContactId: contact.id,
    workspaceId: contact.workspaceId,
    direction: 'outbound',
    body: `[template:${templateName}]`,
    whatsappMessageId: whatsappResponse?.messages?.[0]?.id || whatsappResponse?.id,
    status: whatsappResponse?.skipped ? 'skipped' : 'sent',
    metadata: {
      ...metadata,
      templateName,
      languageCode: options.languageCode || 'pt_BR'
    }
  });

  await chat.update({ lastMessageAt: new Date() });
  return message;
}

async function sendAndRecordMedia(contact, media, metadata = {}) {
  const chat = await findOrCreateOpenChat(contact);
  const whatsappResponse = await sendMediaMessage(contact.phone, media);
  const mediaType = media.type || media.mediaType || 'document';

  const message = await Message.create({
    ChatId: chat.id,
    ContactId: contact.id,
    workspaceId: contact.workspaceId,
    direction: 'outbound',
    body: media.caption || media.filename || `[${mediaType}]`,
    whatsappMessageId: whatsappResponse?.messages?.[0]?.id || whatsappResponse?.id,
    status: whatsappResponse?.skipped ? 'skipped' : 'sent',
    metadata: {
      ...metadata,
      mediaType,
      mediaUrl: media.url || media.mediaUrl,
      filename: media.filename || null
    }
  });

  await chat.update({ lastMessageAt: new Date() });
  return message;
}

module.exports = {
  findOrCreateOpenChat,
  sendAndRecordText,
  sendAndRecordTemplate,
  sendAndRecordMedia
};
