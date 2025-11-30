/**
 * @file lib/infrastructure/zoho/auth.ts
 * @description Gestion de l'authentification OAuth2 Zoho Analytics
 * 
 * MODIFIÉ : Ajout de la récupération automatique de l'orgId après OAuth
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from './encryption';
import {
  ZohoTokens,
  ZohoTokenResponse,
  ZohoTokenRecord,
  ZohoConnectionStatus,
  ZohoRegion,
  ZOHO_REGIONS,
  ZOHO_SCOPES,
  ZohoAuthError,
} from './types';

// ==================== CONFIGURATION ====================

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID!;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET!;

// Fonction pour obtenir l'URL de l'app de manière fiable
function getAppUrl(): string {
  // Essayer plusieurs sources dans l'ordre de priorité
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    || process.env.APP_URL  // Fallback non-public
    || process.env.VERCEL_URL
    || 'http://localhost:3000';

  // S'assurer que l'URL a un protocole
  if (appUrl.startsWith('http://') || appUrl.startsWith('https://')) {
    return appUrl;
  }

  // Pour Vercel, ajouter https://
  return `https://${appUrl}`;
}

// REDIRECT_URI calculé dynamiquement
function getRedirectUri(): string {
  return `${getAppUrl()}/api/zoho/oauth/callback`;
}

// Domaine par défaut - FORCER Analytics, pas CRM
const DEFAULT_ACCOUNTS_DOMAIN = process.env.ZOHO_ACCOUNTS_DOMAIN || 'https://accounts.zoho.com';
// IMPORTANT : Toujours utiliser analyticsapi, pas zohoapis
const DEFAULT_API_DOMAIN = process.env.ZOHO_API_DOMAIN || 'https://analyticsapi.zoho.com';

// ==================== HELPERS ====================

/**
 * Crée un client Supabase avec la clé service role
 */
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: 'csv_importer' }
  });
}

/**
 * Détermine le domaine accounts en fonction de la région
 */
function getAccountsDomain(region: ZohoRegion = 'us'): string {
  return ZOHO_REGIONS[region]?.accountsDomain || DEFAULT_ACCOUNTS_DOMAIN;
}

/**
 * Détermine le domaine API Analytics en fonction de la région
 * IMPORTANT : Utiliser analyticsapi, pas zohoapis (qui est pour CRM)
 */
function getApiDomain(region: ZohoRegion = 'us'): string {
  return ZOHO_REGIONS[region]?.apiDomain || DEFAULT_API_DOMAIN;
}

/**
 * Extrait la région depuis un domaine Zoho
 */
function extractRegionFromDomain(domain: string): ZohoRegion {
  if (domain.includes('.eu')) return 'eu';
  if (domain.includes('.in')) return 'in';
  if (domain.includes('.com.au')) return 'au';
  if (domain.includes('.jp')) return 'jp';
  if (domain.includes('.com.cn')) return 'cn';
  return 'us';
}

/**
 * Convertit le domaine API générique vers le domaine Analytics
 * Zoho renvoie parfois zohoapis.com au lieu de analyticsapi.zoho.com
 */
function convertToAnalyticsDomain(apiDomain: string): string {
  // Si c'est déjà un domaine Analytics, le garder
  if (apiDomain.includes('analyticsapi')) {
    return apiDomain;
  }

  // Extraire la région et retourner le bon domaine Analytics
  const region = extractRegionFromDomain(apiDomain);
  return getApiDomain(region);
}

// ==================== OAUTH FLOW ====================

/**
 * Génère l'URL d'autorisation OAuth Zoho
 */
export function generateAuthorizationUrl(state: string, region: ZohoRegion = 'us'): string {
  const accountsDomain = getAccountsDomain(region);
  const scopes = ZOHO_SCOPES.join(',');
  const redirectUri = getRedirectUri();

  // Debug log
  console.log('generateAuthorizationUrl - redirect_uri:', redirectUri);

  const params = new URLSearchParams({
    client_id: ZOHO_CLIENT_ID,
    response_type: 'code',
    scope: scopes,
    redirect_uri: redirectUri,
    access_type: 'offline',
    prompt: 'consent',
    state: state,
  });

  return `${accountsDomain}/oauth/v2/auth?${params.toString()}`;
}

/**
 * Échange le code d'autorisation contre des tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  region: ZohoRegion = 'us'
): Promise<ZohoTokenResponse> {
  const accountsDomain = getAccountsDomain(region);
  const redirectUri = getRedirectUri();

  // Debug log
  console.log('exchangeCodeForTokens - redirect_uri:', redirectUri);

  const response = await fetch(`${accountsDomain}/oauth/v2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      redirect_uri: redirectUri,
      code: code,
    }),
  });

  const data: ZohoTokenResponse = await response.json();

  if (data.error) {
    throw new ZohoAuthError(
      data.error_description || data.error,
      data.error,
      false
    );
  }

  return data;
}

/**
 * Rafraîchit l'access token
 */
export async function refreshAccessToken(
  refreshToken: string,
  accountsDomain: string
): Promise<ZohoTokenResponse> {
  const response = await fetch(`${accountsDomain}/oauth/v2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  const data: ZohoTokenResponse = await response.json();

  if (data.error) {
    throw new ZohoAuthError(
      data.error_description || data.error,
      data.error,
      data.error === 'invalid_grant'
    );
  }

  return data;
}

// ==================== ORG ID FETCH ====================

/**
 * Récupère l'ID de l'organisation Zoho (première org trouvée)
 * NOUVEAU : Cette fonction est appelée après le callback OAuth pour récupérer l'orgId
 */
async function fetchOrgId(accessToken: string, apiDomain: string): Promise<string | null> {
  try {
    console.log('fetchOrgId - Récupération de l\'orgId...');
    
    const response = await fetch(`${apiDomain}/restapi/v2/orgs`, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('fetchOrgId - Erreur HTTP:', response.status);
      return null;
    }

    const data = await response.json();
    
    // La réponse contient data.orgs qui est un tableau d'organisations
    const orgs = data?.data?.orgs || [];
    
    if (orgs.length > 0) {
      const orgId = orgs[0].orgId;
      console.log('fetchOrgId - orgId trouvé:', orgId);
      return orgId;
    }

    console.log('fetchOrgId - Aucune organisation trouvée');
    return null;
  } catch (error) {
    console.error('fetchOrgId - Erreur:', error);
    return null;
  }
}

// ==================== TOKEN STORAGE ====================

/**
 * Stocke les tokens chiffrés en base
 * MODIFIÉ : Récupère et stocke automatiquement l'orgId
 */
export async function storeTokens(
  userId: string,
  tokenResponse: ZohoTokenResponse,
  refreshToken?: string,
  region: ZohoRegion = 'us'
): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Utiliser le refresh token existant si non fourni dans la réponse
  const finalRefreshToken = tokenResponse.refresh_token || refreshToken;

  if (!finalRefreshToken) {
    throw new Error('Refresh token manquant');
  }

  // IMPORTANT : Convertir vers le domaine Analytics
  // Zoho peut renvoyer zohoapis.com qui est pour CRM, pas Analytics
  const rawApiDomain = tokenResponse.api_domain || getApiDomain(region);
  const apiDomain = convertToAnalyticsDomain(rawApiDomain);
  const accountsDomain = getAccountsDomain(region);

  // Debug log
  console.log('storeTokens - apiDomain converti:', apiDomain);

  // NOUVEAU : Récupérer l'orgId immédiatement après avoir les tokens
  const orgId = await fetchOrgId(tokenResponse.access_token, apiDomain);
  console.log('storeTokens - orgId récupéré:', orgId);

  // Calculer la date d'expiration
  const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

  // Chiffrer les tokens
  const accessTokenEncrypted = encrypt(tokenResponse.access_token);
  const refreshTokenEncrypted = encrypt(finalRefreshToken);

  // Upsert dans la base
  const { error } = await supabase
    .from('user_zoho_tokens')
    .upsert({
      user_id: userId,
      access_token_encrypted: accessTokenEncrypted,
      refresh_token_encrypted: refreshTokenEncrypted,
      token_type: tokenResponse.token_type || 'Zoho-oauthtoken',
      expires_at: expiresAt.toISOString(),
      scope: tokenResponse.scope || ZOHO_SCOPES.join(','),
      api_domain: apiDomain,
      accounts_domain: accountsDomain,
      org_id: orgId,  // NOUVEAU : Stocker l'orgId
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('Erreur stockage tokens:', error);
    throw new Error(`Impossible de stocker les tokens : ${error.message}`);
  }
}

/**
 * Récupère et déchiffre les tokens d'un utilisateur
 * Rafraîchit automatiquement si expiré
 * MODIFIÉ : Inclut l'orgId dans les tokens retournés
 */
export async function getTokens(userId: string): Promise<ZohoTokens | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('user_zoho_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  const record = data as ZohoTokenRecord;

  // Déchiffrer les tokens
  let accessToken: string;
  let refreshToken: string;

  try {
    accessToken = decrypt(record.access_token_encrypted);
    refreshToken = decrypt(record.refresh_token_encrypted);
  } catch (decryptError) {
    console.error('Erreur déchiffrement tokens:', decryptError);
    return null;
  }

  const expiresAt = new Date(record.expires_at);

  // Vérifier si le token est expiré (avec 5 minutes de marge)
  const isExpired = expiresAt.getTime() - Date.now() < 5 * 60 * 1000;

  if (isExpired) {
    try {
      // Rafraîchir le token
      const newTokens = await refreshAccessToken(
        refreshToken,
        record.accounts_domain
      );

      // Stocker les nouveaux tokens (cela récupèrera aussi le nouvel orgId si nécessaire)
      const region = extractRegionFromDomain(record.accounts_domain);
      await storeTokens(userId, newTokens, refreshToken, region);

      // S'assurer que le domaine API est celui d'Analytics
      const apiDomain = convertToAnalyticsDomain(
        newTokens.api_domain || record.api_domain
      );

      // Récupérer l'orgId (soit de l'ancien record, soit le refetch)
      const orgId = record.org_id || await fetchOrgId(newTokens.access_token, apiDomain);

      return {
        accessToken: newTokens.access_token,
        refreshToken: refreshToken,
        tokenType: newTokens.token_type || record.token_type,
        expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
        scope: newTokens.scope || record.scope,
        apiDomain: apiDomain,
        accountsDomain: record.accounts_domain,
        orgId: orgId,  // NOUVEAU
        zohoUserId: record.zoho_user_id,
        zohoEmail: record.zoho_email,
      };
    } catch (refreshError) {
      console.error('Erreur rafraîchissement token:', refreshError);

      // Si le refresh token est invalide, supprimer les tokens
      if (refreshError instanceof ZohoAuthError && refreshError.needsReauthorization) {
        await deleteTokens(userId);
      }

      return null;
    }
  }

  // S'assurer que le domaine API est celui d'Analytics
  const apiDomain = convertToAnalyticsDomain(record.api_domain);

  return {
    accessToken,
    refreshToken,
    tokenType: record.token_type,
    expiresAt,
    scope: record.scope,
    apiDomain: apiDomain,
    accountsDomain: record.accounts_domain,
    orgId: record.org_id,  // NOUVEAU
    zohoUserId: record.zoho_user_id,
    zohoEmail: record.zoho_email,
  };
}

/**
 * Vérifie le statut de connexion Zoho d'un utilisateur
 */
export async function getConnectionStatus(userId: string): Promise<ZohoConnectionStatus> {
  const tokens = await getTokens(userId);

  if (!tokens) {
    return {
      isConnected: false,
      zohoEmail: null,
      expiresAt: null,
      needsReauthorization: false,
    };
  }

  return {
    isConnected: true,
    zohoEmail: tokens.zohoEmail,
    expiresAt: tokens.expiresAt,
    needsReauthorization: false,
  };
}

/**
 * Supprime les tokens d'un utilisateur
 */
export async function deleteTokens(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('user_zoho_tokens')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Erreur suppression tokens:', error);
    throw new Error(`Impossible de supprimer les tokens : ${error.message}`);
  }
}

/**
 * Met à jour les informations utilisateur Zoho
 */
export async function updateZohoUserInfo(
  userId: string,
  zohoUserId: string,
  zohoEmail: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('user_zoho_tokens')
    .update({
      zoho_user_id: zohoUserId,
      zoho_email: zohoEmail,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Erreur mise à jour infos Zoho:', error);
  }
}

/**
 * Valide qu'un access token est encore valide
 */
export async function validateAccessToken(tokens: ZohoTokens): Promise<boolean> {
  try {
    const response = await fetch(`${tokens.apiDomain}/restapi/v2/orgs`, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${tokens.accessToken}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}
