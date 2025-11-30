/**
 * @file app/api/zoho/oauth/authorize/route.ts
 * @description Initie le flow OAuth Zoho Analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { generateAuthorizationUrl } from '@/lib/infrastructure/zoho/auth';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

// Fallback pour l'URL de l'app
function getAppUrl(): string {
  // Essayer plusieurs sources
  const appUrl = process.env.NEXT_PUBLIC_APP_URL 
    || process.env.VERCEL_URL 
    || 'http://localhost:3000';
  
  // S'assurer que l'URL a un protocole
  if (appUrl.startsWith('http://') || appUrl.startsWith('https://')) {
    return appUrl;
  }
  
  // Pour Vercel, ajouter https://
  return `https://${appUrl}`;
}

export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }
    
    // Récupérer la région depuis les query params (optionnel)
    const { searchParams } = new URL(request.url);
    const region = (searchParams.get('region') || 'us') as 'us' | 'eu' | 'in' | 'au' | 'jp' | 'cn';
    
    // Générer un state unique pour la sécurité CSRF
    const state = uuidv4();
    
    // Stocker le state dans un cookie sécurisé
    const cookieStore = await cookies();
    cookieStore.set('zoho_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    });
    
    // Stocker aussi la région pour le callback
    cookieStore.set('zoho_oauth_region', region, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/',
    });
    
    // Générer l'URL d'autorisation Zoho
    const authUrl = generateAuthorizationUrl(state, region);
    
    // Debug log
    console.log('OAuth authorize - redirecting to:', authUrl);
    
    // Rediriger vers Zoho
    return NextResponse.redirect(authUrl);
    
  } catch (error) {
    console.error('Erreur OAuth authorize:', error);
    
    const appUrl = getAppUrl();
    
    return NextResponse.redirect(
      `${appUrl}/import?error=oauth_init_failed`
    );
  }
}
