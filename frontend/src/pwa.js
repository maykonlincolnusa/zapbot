import { PRODUCT_NAME } from './config';

export function registerPwa() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn(`[${PRODUCT_NAME}] Service worker registration failed`, error);
    });
  });
}
