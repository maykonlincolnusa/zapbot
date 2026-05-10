import test from 'node:test';
import assert from 'node:assert/strict';
import { canPerform, canView, normalizeRole } from './permissions.js';

test('normalizeRole falls back to viewer', () => {
  assert.equal(normalizeRole('support'), 'attendant');
  assert.equal(normalizeRole('marketer'), 'manager');
  assert.equal(normalizeRole('unknown'), 'viewer');
});

test('canView applies feature hierarchy', () => {
  assert.equal(canView({ role: 'attendant' }, 'contacts'), true);
  assert.equal(canView({ role: 'attendant' }, 'integrations'), false);
  assert.equal(canView({ role: 'manager' }, 'flows'), true);
  assert.equal(canView({ role: 'owner' }, 'settings'), true);
});

test('canPerform restricts advanced actions', () => {
  assert.equal(canPerform({ role: 'manager' }, 'importContacts'), true);
  assert.equal(canPerform({ role: 'manager' }, 'viewTechnicalDetails'), false);
  assert.equal(canPerform({ role: 'admin' }, 'viewTechnicalDetails'), true);
  assert.equal(canPerform({ role: 'owner' }, 'manageSecurity'), true);
});

test('canView honors server-provided permissions when present', () => {
  const session = {
    user: { role: 'admin' },
    permissions: { canManageSettings: false }
  };

  assert.equal(canView(session, 'settings'), false);
});
