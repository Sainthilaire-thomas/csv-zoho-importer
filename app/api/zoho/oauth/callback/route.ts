/**
 * @file app/api/zoho/oauth/callback/route.ts
 * @description Callback OAuth2 Zoho
 *
 * GET /api/zoho/oauth/callback?code=XXX&state=XXX
 * - Valide le state CSRF
 * - Échange le code contre des tokens
 * - Stocke les tokens chiffrés dans Supabase
 * - Redirige vers /import
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import {
  exchangeCodeForTokens,
  storeTokens,
} from '@/lib/infrastructure/zoho/auth';
import { ZohoRegion } from '@/lib/infrastructure/zoho/types';
import { cookies } from 'next/headers';

// Fallback pour l'URL de l'app
function getAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL 
    || process.env.APP_URL
    || 'http://localhost:3000';
  
  if (appUrl.startsWith('http://') || appUrl.startsWith('https://')) {
    return appUrl;
  }
  
  return `https://${appUrl}`;
}

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl();
  
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Debug logs
  console.log('OAuth callback - params:', { code: !!code, state, error });

  // 1. Vérifier si Zoho a retourné une erreur
  if (error) {
    console.error('Erreur OAuth Zoho:', error, errorDescription);
    return NextResponse.redirect(
      `${appUrl}/import?error=zoho_oauth_error&message=${encodeURIComponent(errorDescription || error)}`
    );
  }

  // 2. Vérifier la présence du code
  if (!code) {
    return NextResponse.redirect(
      `${appUrl}/import?error=missing_code&message=${encodeURIComponent('Code d\'autorisation manquant')}`
    );
  }

  // 3. Récupérer le state et la région depuis les cookies
  const cookieStore = await cookies();
  const storedState = cookieStore.get('zoho_oauth_state')?.value;
  const storedRegion = (cookieStore.get('zoho_oauth_region')?.value || 'us') as ZohoRegion;

  console.log('OAuth callback - cookies:', { storedState, storedRegion });

  // 4. Valider le state CSRF
  if (!storedState) {
    // En développement, on peut ignorer si le cookie a expiré
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.redirect(
        `${appUrl}/import?error=invalid_state&message=${encodeURIComponent('Session expirée, veuillez réessayer')}`
      );
    }
    console.warn('Cookie state non trouvé - ignoré en développement');
  } else if (state !== storedState) {
    console.error('State mismatch:', { urlState: state, cookieState: storedState });
    return NextResponse.redirect(
      `${appUrl}/import?error=csrf_error&message=${encodeURIComponent('Erreur de sécurité, veuillez réessayer')}`
    );
  }

  // 5. Récupérer l'utilisateur authentifié
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    console.error('Session Supabase non trouvée');
    return NextResponse.redirect(
      `${appUrl}/login?error=session_expired`
    );
  }

  const userId = session.user.id;
  console.log('OAuth callback - userId:', userId);

  try {
    // 6. Échanger le code contre des tokens
    const tokens = await exchangeCodeForTokens(code, storedRegion);
    console.log('OAuth callback - tokens reçus');

    // 7. Vérifier qu'on a un refresh_token
    if (!tokens.refresh_token) {
      console.error('Pas de refresh_token reçu de Zoho');
      return NextResponse.redirect(
        `${appUrl}/import?error=no_refresh_token&message=${encodeURIComponent('Erreur d\'autorisation Zoho, veuillez réessayer')}`
      );
    }

    // 8. Stocker les tokens chiffrés dans Supabase
    await storeTokens(userId, tokens, undefined, storedRegion);
    console.log('OAuth callback - tokens stockés');

    // 9. Créer la réponse de redirection
    const response = NextResponse.redirect(`${appUrl}/import?zoho_connected=true`);
    
    // 10. Supprimer les cookies OAuth
    response.cookies.delete('zoho_oauth_state');
    response.cookies.delete('zoho_oauth_region');

    return response;

  } catch (err) {
    console.error('Erreur OAuth callback:', err);
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    
    // Nettoyer les cookies en cas d'erreur
    const response = NextResponse.redirect(
      `${appUrl}/import?error=oauth_error&message=${encodeURIComponent(message)}`
    );
    response.cookies.delete('zoho_oauth_state');
    response.cookies.delete('zoho_oauth_region');
    
    return response;
  }
}
