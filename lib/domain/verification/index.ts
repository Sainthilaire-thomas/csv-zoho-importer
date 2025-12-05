/**
 * @file lib/domain/verification/index.ts
 * @description Module de vérification post-import
 * 
 * Exporte toutes les fonctions et types nécessaires pour la vérification
 */

// Types
export type {
  VerificationConfig,
  SentRow,
  VerificationResult,
  Anomaly,
  AnomalyType,
  AnomalyLevel,
  ComparedRow,
  ComparedColumn,
} from './types';

// Constantes et helpers
export {
  EMPTY_VERIFICATION_RESULT,
  createAnomaly,
  getAnomalyLevel,
  getAnomalyMessage,
} from './types';

// Fonctions principales
export { verifyImport, buildInCriteria } from './compare';
