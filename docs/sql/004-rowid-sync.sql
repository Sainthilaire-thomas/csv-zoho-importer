-- ============================================================================
-- Mission 013 : Synchronisation RowID pour rollback
-- Date : 2026-01-22
-- ============================================================================

-- Table pour tracker le dernier RowID connu par table Zoho
-- Permet de calculer le rowid_debut pour les prochains imports
CREATE TABLE IF NOT EXISTS csv_importer.table_rowid_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifiants Zoho
  zoho_table_id TEXT NOT NULL,          -- viewId de la table
  table_name TEXT NOT NULL,             -- Nom de la table (pour affichage)
  workspace_id TEXT NOT NULL,           -- workspaceId
  
  -- Dernier RowID connu
  last_known_rowid BIGINT NOT NULL,     -- Dernier RowID après import
  
  -- Métadonnées
  source TEXT NOT NULL DEFAULT 'import', -- 'import', 'manual', 'resync'
  last_import_id UUID,                   -- Référence vers import_logs
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Contrainte unique : une seule entrée par table Zoho
  CONSTRAINT unique_table_sync UNIQUE (zoho_table_id)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_table_rowid_sync_table_id 
  ON csv_importer.table_rowid_sync(zoho_table_id);

CREATE INDEX IF NOT EXISTS idx_table_rowid_sync_workspace 
  ON csv_importer.table_rowid_sync(workspace_id);

-- Modifier import_logs pour ajouter rowid_debut et rowid_fin
-- (remplace row_id_before/row_id_after qui étaient pour l'ancienne stratégie)
ALTER TABLE csv_importer.import_logs 
  ADD COLUMN IF NOT EXISTS rowid_debut BIGINT,
  ADD COLUMN IF NOT EXISTS rowid_fin BIGINT;

-- Commentaires
COMMENT ON TABLE csv_importer.table_rowid_sync IS 
  'Tracking du dernier RowID connu par table Zoho pour calcul des imports suivants';

COMMENT ON COLUMN csv_importer.table_rowid_sync.last_known_rowid IS 
  'Dernier RowID après le dernier import réussi sur cette table';

COMMENT ON COLUMN csv_importer.table_rowid_sync.source IS 
  'Source de la valeur : import (automatique), manual (saisie utilisateur), resync (resynchronisation)';

COMMENT ON COLUMN csv_importer.import_logs.rowid_debut IS 
  'Premier RowID de cet import (pour rollback)';

COMMENT ON COLUMN csv_importer.import_logs.rowid_fin IS 
  'Dernier RowID de cet import (pour rollback)';

-- RLS Policies
ALTER TABLE csv_importer.table_rowid_sync ENABLE ROW LEVEL SECURITY;

-- Politique SELECT : tous les utilisateurs authentifiés peuvent lire
CREATE POLICY "Users can view all rowid sync" 
  ON csv_importer.table_rowid_sync
  FOR SELECT
  TO authenticated
  USING (true);

-- Politique INSERT : tous les utilisateurs authentifiés peuvent créer
CREATE POLICY "Users can insert rowid sync" 
  ON csv_importer.table_rowid_sync
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politique UPDATE : tous les utilisateurs authentifiés peuvent modifier
CREATE POLICY "Users can update rowid sync" 
  ON csv_importer.table_rowid_sync
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION csv_importer.update_rowid_sync_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_update_rowid_sync_timestamp 
  ON csv_importer.table_rowid_sync;

CREATE TRIGGER trigger_update_rowid_sync_timestamp
  BEFORE UPDATE ON csv_importer.table_rowid_sync
  FOR EACH ROW
  EXECUTE FUNCTION csv_importer.update_rowid_sync_timestamp();
