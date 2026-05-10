export const PRODUCT_NAME =
  import.meta.env.VITE_PRODUCT_NAME ||
  import.meta.env.VITE_PROJECT_NAME ||
  'ZapBot';

export const PRODUCT_SLUG = PRODUCT_NAME
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'platform';
