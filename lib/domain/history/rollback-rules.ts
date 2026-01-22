// ============================================
// @file lib/domain/history/rollback-rules.ts
// Règles de rollback par mode d'import
// Mission 013
// ============================================

import type { ImportMode } from '@/types/imports';

export type CorrectionMethod = 'rollback' | 'reimport_month' | 'reimport_full';
export type Severity = 'info' | 'warning' | 'error' | null;

/**
 * Informations de rollback pour un mode d'import
 */
export interface RollbackInfo {
  /** Le rollback automatique est-il possible ? */
  canRollback: boolean;
  /** Message à afficher si rollback impossible */
  message: string | null;
  /** Niveau de sévérité du message */
  severity: Severity;
  /** Méthode de correction recommandée */
  correctionMethod: CorrectionMethod;
  /** Icône à afficher */
  icon: 'undo' | 'info' | 'alert-triangle' | 'alert-circle';
}

/**
 * Modes permettant le rollback automatique
 */
export const ROLLBACKABLE_MODES: ImportMode[] = ['append', 'onlyadd'];

/**
 * Vérifie si un mode permet le rollback automatique
 */
export const isRollbackable = (mode: ImportMode): boolean => {
  return ROLLBACKABLE_MODES.includes(mode);
};

/**
 * Obtient les informations de rollback pour un mode d'import
 */
export const getRollbackInfo = (mode: ImportMode): RollbackInfo => {
  switch (mode) {
    case 'append':
    case 'onlyadd':
      return {
        canRollback: true,
        message: null,
        severity: null,
        correctionMethod: 'rollback',
        icon: 'undo',
      };

    case 'updateadd':
      return {
        canRollback: false,
        message: 'Pour corriger, réimportez le fichier du mois avec les valeurs correctes.',
        severity: 'info',
        correctionMethod: 'reimport_month',
        icon: 'info',
      };

    case 'truncateadd':
      return {
        canRollback: false,
        message: 'Pour corriger, vous devez réimporter la TABLE COMPLÈTE (tout l\'historique).',
        severity: 'warning',
        correctionMethod: 'reimport_full',
        icon: 'alert-triangle',
      };

    case 'deleteupsert':
      return {
        canRollback: false,
        message: 'Pour corriger, vous devez réimporter la TABLE COMPLÈTE. Les lignes supprimées ne peuvent pas être récupérées.',
        severity: 'error',
        correctionMethod: 'reimport_full',
        icon: 'alert-circle',
      };

    default:
      // Fallback sécurisé
      return {
        canRollback: false,
        message: 'Mode d\'import non reconnu. Contactez le support.',
        severity: 'error',
        correctionMethod: 'reimport_full',
        icon: 'alert-circle',
      };
  }
};

/**
 * Labels français pour les modes d'import
 */
export const IMPORT_MODE_LABELS: Record<ImportMode, string> = {
  append: 'Ajout simple',
  onlyadd: 'Ajout des nouveaux',
  updateadd: 'Mise à jour + Ajout',
  truncateadd: 'Remplacement complet',
  deleteupsert: 'Synchronisation totale',
};

/**
 * Descriptions courtes des modes d'import
 */
export const IMPORT_MODE_DESCRIPTIONS: Record<ImportMode, string> = {
  append: 'Ajoute toutes les lignes à la fin de la table',
  onlyadd: 'Ajoute uniquement les lignes dont la clé n\'existe pas',
  updateadd: 'Met à jour si la clé existe, ajoute sinon',
  truncateadd: 'Vide la table puis importe les nouvelles données',
  deleteupsert: 'Supprime les absents, met à jour/ajoute les présents',
};

/**
 * Vérifie si le rollback est possible pour un import donné
 * (mode + présence des RowID)
 */
export const canRollbackImport = (
  mode: ImportMode,
  rowIdBefore: number | null,
  rowIdAfter: number | null
): { canRollback: boolean; reason?: string } => {
  // Vérifier le mode
  if (!isRollbackable(mode)) {
    const info = getRollbackInfo(mode);
    return {
      canRollback: false,
      reason: info.message || 'Ce mode ne permet pas l\'annulation automatique',
    };
  }

  // Vérifier les RowID
  if (rowIdBefore === null || rowIdAfter === null) {
    return {
      canRollback: false,
      reason: 'Informations de rollback non disponibles (RowID manquants)',
    };
  }

  // Vérifier qu'il y a bien des lignes à supprimer
  if (rowIdAfter <= rowIdBefore) {
    return {
      canRollback: false,
      reason: 'Aucune ligne à supprimer (RowID identiques)',
    };
  }

  return { canRollback: true };
};
