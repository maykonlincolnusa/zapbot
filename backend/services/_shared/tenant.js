function requestOrgId(req) {
  return String(req.user?.orgId || req.headers['x-org-id'] || process.env.DEFAULT_ORG_ID || '1');
}

module.exports = {
  requestOrgId
};
