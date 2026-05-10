const roleAliases = {
  support: 'attendant',
  marketer: 'manager'
};

const roleRank = {
  owner: 50,
  admin: 40,
  manager: 30,
  attendant: 20,
  viewer: 10
};

const featureMinimumRole = {
  dashboard: 'attendant',
  contacts: 'attendant',
  livechat: 'attendant',
  flows: 'manager',
  sequences: 'manager',
  broadcasts: 'manager',
  integrations: 'admin',
  health: 'manager',
  payment: 'admin',
  settings: 'admin',
  ai: 'manager',
  team: 'admin',
  advanced: 'admin',
  billing: 'owner',
  security: 'owner'
};

const actionMinimumRole = {
  createContact: 'attendant',
  importContacts: 'manager',
  manageAutomation: 'manager',
  manageIntegrations: 'admin',
  manageSettings: 'admin',
  manageTeam: 'admin',
  viewTechnicalDetails: 'admin',
  manageBilling: 'owner',
  manageSecurity: 'owner'
};

export function normalizeRole(role) {
  const normalized = roleAliases[role] || role;
  return roleRank[normalized] ? normalized : 'viewer';
}

export function roleAtLeast(role, minimumRole) {
  return (roleRank[normalizeRole(role)] || 0) >= (roleRank[normalizeRole(minimumRole)] || 0);
}

export function canView(sessionOrUser, feature) {
  const role = normalizeRole(sessionOrUser?.user?.role || sessionOrUser?.role);
  const permissions = sessionOrUser?.permissions || {};

  if (feature === 'settings' && permissions.canManageSettings !== undefined) {
    return Boolean(permissions.canManageSettings);
  }
  if (feature === 'team' && permissions.canManageTeam !== undefined) {
    return Boolean(permissions.canManageTeam);
  }
  if (['flows', 'sequences', 'broadcasts'].includes(feature) && permissions.canManageAutomation !== undefined) {
    return Boolean(permissions.canManageAutomation);
  }
  if (feature === 'health' && permissions.canViewHealth !== undefined) {
    return Boolean(permissions.canViewHealth);
  }

  return roleAtLeast(role, featureMinimumRole[feature] || 'viewer');
}

export function canEdit(sessionOrUser, feature) {
  if (feature === 'contacts') return canView(sessionOrUser, 'contacts');
  if (feature === 'settings') return canPerform(sessionOrUser, 'manageSettings');
  if (feature === 'team') return canPerform(sessionOrUser, 'manageTeam');
  if (feature === 'integrations') return canPerform(sessionOrUser, 'manageIntegrations');
  if (['flows', 'sequences', 'broadcasts', 'ai'].includes(feature)) return canPerform(sessionOrUser, 'manageAutomation');
  return canView(sessionOrUser, feature);
}

export function canPerform(sessionOrUser, action) {
  const role = normalizeRole(sessionOrUser?.user?.role || sessionOrUser?.role);
  return roleAtLeast(role, actionMinimumRole[action] || 'viewer');
}
