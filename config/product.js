const PRODUCT_NAME =
  process.env.PRODUCT_NAME ||
  process.env.DEFAULT_PRODUCT_NAME ||
  process.env.VITE_PRODUCT_NAME ||
  'ZapBot';

const PRODUCT_SLUG = String(PRODUCT_NAME)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'platform';

module.exports = {
  PRODUCT_NAME,
  PRODUCT_SLUG
};
