// lib/domain/profile/index.ts
// Exports du module de gestion des profils

export { 
  ProfileManager, 
  profileManager,
  profileNeedsConfirmation,
  getColumnsNeedingConfirmation,
  getNewColumns,
  getMissingColumns,
  getMatchPercentage,
} from './profile-manager';

export type { ZohoColumnInfo } from './profile-manager';
