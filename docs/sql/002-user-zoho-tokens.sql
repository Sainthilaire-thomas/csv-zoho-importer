-- ============================================
-- @file docs/sql/002-user-zoho-tokens.sql
-- Table user_zoho_tokens
-- Stockage securise des tokens OAuth2 Zoho
-- ============================================

-- S assurer que la fonction update_updated_at_column existe
CREATE OR REPLACE FUNCTION csv_importer.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table pour stocker les tokens Zoho chiffres par utilisateur
CREATE TABLE IF NOT EXISTS csv_importer.user_zoho_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tokens chiffres (AES-256-GCM)
  -- Format: iv:authTag:encryptedData (tout en base64)
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  
  -- Metadonnees (non chiffrees)
  token_type TEXT DEFAULT 'Zoho-oauthtoken',
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  api_domain TEXT DEFAULT 'https://analyticsapi.zoho.com',
  accounts_domain TEXT DEFAULT 'https://accounts.zoho.com',
  
  -- Infos Zoho user (pour affichage)
  zoho_user_id TEXT,
  zoho_email TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Un seul token par user
  UNIQUE(user_id)
);

-- Commentaires
COMMENT ON TABLE csv_importer.user_zoho_tokens IS 'Tokens OAuth2 Zoho chiffres par utilisateur';
COMMENT ON COLUMN csv_importer.user_zoho_tokens.access_token_encrypted IS 'Access token chiffre AES-256-GCM (iv:authTag:data en base64)';
COMMENT ON COLUMN csv_importer.user_zoho_tokens.refresh_token_encrypted IS 'Refresh token chiffre AES-256-GCM (iv:authTag:data en base64)';
COMMENT ON COLUMN csv_importer.user_zoho_tokens.expires_at IS 'Date d expiration de l access token';
COMMENT ON COLUMN csv_importer.user_zoho_tokens.api_domain IS 'Domaine API Zoho Analytics (varie selon region)';
COMMENT ON COLUMN csv_importer.user_zoho_tokens.accounts_domain IS 'Domaine OAuth Zoho (varie selon region)';

-- Index pour optimiser les requetes
CREATE INDEX IF NOT EXISTS idx_user_zoho_tokens_user_id 
  ON csv_importer.user_zoho_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_zoho_tokens_expires_at 
  ON csv_importer.user_zoho_tokens(expires_at);

-- RLS (Row Level Security)
ALTER TABLE csv_importer.user_zoho_tokens ENABLE ROW LEVEL SECURITY;

-- Supprimer la policy si elle existe deja
DROP POLICY IF EXISTS "Users can manage their own Zoho tokens" 
  ON csv_importer.user_zoho_tokens;

-- Policy : Users ne peuvent voir/modifier que leurs propres tokens
CREATE POLICY "Users can manage their own Zoho tokens"
  ON csv_importer.user_zoho_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_user_zoho_tokens_updated_at 
  ON csv_importer.user_zoho_tokens;

CREATE TRIGGER update_user_zoho_tokens_updated_at
  BEFORE UPDATE ON csv_importer.user_zoho_tokens
  FOR EACH ROW
  EXECUTE FUNCTION csv_importer.update_updated_at_column();

-- Accorder les permissions
GRANT SELECT, INSERT, UPDATE, DELETE 
  ON csv_importer.user_zoho_tokens 
  TO authenticated;

-- ============================================
-- Instructions pour executer ce script :
-- 1. Aller dans Supabase Dashboard > SQL Editor
-- 2. Coller ce script
-- 3. Executer
-- ============================================
