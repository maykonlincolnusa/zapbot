function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d]/g, '');
}

module.exports = {
  normalizePhone
};
