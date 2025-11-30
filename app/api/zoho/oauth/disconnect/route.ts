/**
 * @file app/api/zoho/oauth/disconnect/route.ts
 * @description Déconnecte l'utilisateur de Zoho
 * 
 * POST /api/zoho/oauth/disconnect
 * - Supprime les tokens Zoho de l'utilisateur
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { deleteTokens } from '@/lib/infrastructure/zoho';

export async function POST() {
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
    
    // 2. Supprimer les tokens
    await deleteTokens(session.user.id);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Erreur déconnexion Zoho:', error);
    
    return NextResponse.json(
      { error: 'Erreur lors de la déconnexion' },
      { status: 500 }
    );
  }
}
