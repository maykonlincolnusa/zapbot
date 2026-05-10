const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizePhone } = require('../../services/_shared/phone');
const { requestOrgId } = require('../../services/_shared/tenant');

test('normalizePhone removes non-digit characters', () => {
  assert.equal(normalizePhone('+55 (11) 99999-0000'), '5511999990000');
  assert.equal(normalizePhone(''), '');
  assert.equal(normalizePhone(null), '');
});

test('requestOrgId prefers authenticated user then service header then default', () => {
  assert.equal(requestOrgId({ user: { orgId: 42 }, headers: { 'x-org-id': '99' } }), '42');
  assert.equal(requestOrgId({ headers: { 'x-org-id': '99' } }), '99');

  const previous = process.env.DEFAULT_ORG_ID;
  process.env.DEFAULT_ORG_ID = '7';
  assert.equal(requestOrgId({ headers: {} }), '7');
  if (previous === undefined) {
    delete process.env.DEFAULT_ORG_ID;
  } else {
    process.env.DEFAULT_ORG_ID = previous;
  }
});
