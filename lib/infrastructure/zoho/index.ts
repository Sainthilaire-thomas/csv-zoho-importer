/**
 * @file lib/infrastructure/zoho/index.ts
 * @description Exports publics du module Zoho Analytics
 */

// Types
export * from './types';

// Authentification
export {
  generateAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  storeTokens,
  getTokens,
  getConnectionStatus,
  deleteTokens,
  updateZohoUserInfo,
  validateAccessToken,
} from './auth';

// Client API
export { ZohoAnalyticsClient, getZohoImportType } from './client';

// Chiffrement (usage interne principalement)
export { encrypt, decrypt, isEncryptedFormat, generateEncryptionKey } from './encryption';
