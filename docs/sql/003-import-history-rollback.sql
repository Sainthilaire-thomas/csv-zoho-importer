-- ============================================
-- @file docs/sql/003-import-history-rollback.sql
-- Migration: Enrichir import_logs pour rollback différé
-- Mission 013 - Historique des Imports & Rollback Différé
-- ============================================

-- ============================================
-- PARTIE 1: Nouvelles colonnes pour rollback
-- ============================================

-- Colonnes d'identification Zoho
ALTER TABLE csv_importer.import_logs 
ADD COLUMN IF NOT EXISTS workspace_id TEXT,
ADD COLUMN IF NOT EXISTS table_name TEXT;

-- Colonnes pour rollback par RowID
ALTER TABLE csv_importer.import_logs 
ADD COLUMN IF NOT EXISTS row_id_before BIGINT,
ADD COLUMN IF NOT EXISTS row_id_after BIGINT;

-- Colonne de matching (pour modes UPDATE*)
ALTER TABLE csv_importer.import_logs 
ADD COLUMN IF NOT EXISTS matching_column TEXT;

-- Nombre de chunks (pour imports volumineux)
ALTER TABLE csv_importer.import_logs 
ADD COLUMN IF NOT EXISTS chunks_count INTEGER DEFAULT 1;

-- Colonnes de rollback
ALTER TABLE csv_importer.import_logs 
ADD COLUMN IF NOT EXISTS rolled_back BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rolled_back_by UUID REFERENCES auth.users(id);

-- Lien vers profil d'import (optionnel)
ALTER TABLE csv_importer.import_logs 
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES csv_importer.import_profiles(id) ON DELETE SET NULL;

-- ============================================
-- PARTIE 2: Index pour performances
-- ============================================

-- Index pour requêtes par utilisateur (liste historique)
CREATE INDEX IF NOT EXISTS idx_import_logs_user_id 
  ON csv_importer.import_logs(user_id);

-- Index pour requêtes par table Zoho (contrainte LIFO)
CREATE INDEX IF NOT EXISTS idx_import_logs_zoho_table_id 
  ON csv_importer.import_logs(zoho_table_id);

-- Index pour tri chronologique (historique récent)
CREATE INDEX IF NOT EXISTS idx_import_logs_created_at 
  ON csv_importer.import_logs(created_at DESC);

-- Index composite pour LIFO (table + date + non-rollback)
CREATE INDEX IF NOT EXISTS idx_import_logs_lifo 
  ON csv_importer.import_logs(zoho_table_id, created_at DESC) 
  WHERE rolled_back = FALSE;

-- ============================================
-- PARTIE 3: Commentaires documentation
-- ============================================

COMMENT ON COLUMN csv_importer.import_logs.workspace_id IS 'ID du workspace Zoho Analytics';
COMMENT ON COLUMN csv_importer.import_logs.table_name IS 'Nom de la table Zoho (pour affichage)';
COMMENT ON COLUMN csv_importer.import_logs.row_id_before IS 'MAX(RowID) AVANT import - pour rollback';
COMMENT ON COLUMN csv_importer.import_logs.row_id_after IS 'MAX(RowID) APRÈS import - pour rollback';
COMMENT ON COLUMN csv_importer.import_logs.matching_column IS 'Colonne de matching pour modes UPDATE*';
COMMENT ON COLUMN csv_importer.import_logs.chunks_count IS 'Nombre de chunks pour imports volumineux';
COMMENT ON COLUMN csv_importer.import_logs.rolled_back IS 'TRUE si import annulé';
COMMENT ON COLUMN csv_importer.import_logs.rolled_back_at IS 'Date/heure du rollback';
COMMENT ON COLUMN csv_importer.import_logs.rolled_back_by IS 'Utilisateur ayant effectué le rollback';
COMMENT ON COLUMN csv_importer.import_logs.profile_id IS 'Profil d''import utilisé (optionnel)';

-- ============================================
-- PARTIE 4: RLS (Row Level Security)
-- ============================================

-- Activer RLS si pas déjà fait
ALTER TABLE csv_importer.import_logs ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies existantes si elles existent
DROP POLICY IF EXISTS "Users can view their own import logs" 
  ON csv_importer.import_logs;
DROP POLICY IF EXISTS "Users can insert their own import logs" 
  ON csv_importer.import_logs;
DROP POLICY IF EXISTS "Users can update their own import logs" 
  ON csv_importer.import_logs;

-- Policy SELECT : Users peuvent voir leurs propres logs
CREATE POLICY "Users can view their own import logs"
  ON csv_importer.import_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy INSERT : Users peuvent créer leurs propres logs
CREATE POLICY "Users can insert their own import logs"
  ON csv_importer.import_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy UPDATE : Users peuvent modifier leurs propres logs (pour rollback)
CREATE POLICY "Users can update their own import logs"
  ON csv_importer.import_logs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- PARTIE 5: Permissions
-- ============================================

GRANT SELECT, INSERT, UPDATE 
  ON csv_importer.import_logs 
  TO authenticated;

-- ============================================
-- Instructions pour exécuter ce script :
-- 1. Aller dans Supabase Dashboard > SQL Editor
-- 2. Coller ce script
-- 3. Exécuter
-- 4. Vérifier avec: SELECT * FROM csv_importer.import_logs LIMIT 1;
-- ============================================
