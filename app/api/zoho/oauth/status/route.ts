/**
 * @file app/api/zoho/oauth/status/route.ts
 * @description Vérifie le statut de connexion Zoho d'un utilisateur
 * 
 * GET /api/zoho/oauth/status
 * - Retourne si l'utilisateur est connecté à Zoho
 * - Email Zoho si disponible
 * - Si une réautorisation est nécessaire
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { getConnectionStatus } from '@/lib/infrastructure/zoho';

export async function GET() {
  try {
    // 1. Vérifier l'authentification Supabase
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }
    
    // 2. Récupérer le statut de connexion Zoho
    const status = await getConnectionStatus(session.user.id);
    
    return NextResponse.json(status);
    
  } catch (error) {
    console.error('Erreur vérification statut Zoho:', error);
    
    return NextResponse.json(
      { 
        isConnected: false, 
        zohoEmail: null, 
        expiresAt: null, 
        needsReauthorization: false,
        error: 'Erreur lors de la vérification' 
      },
      { status: 500 }
    );
  }
}
