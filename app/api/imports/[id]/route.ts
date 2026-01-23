// ============================================
// @file app/api/imports/[id]/route.ts
// API pour un import spécifique
// GET: Détail d'un import
// Mission 013
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';

/**
 * GET /api/imports/[id]
 * Récupérer le détail d'un import
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Récupérer l'import
     const { data: importLog, error } = await supabase
      .schema('csv_importer')
      .from('import_logs')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)  // Sécurité: seulement ses propres imports
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Import non trouvé' }, { status: 404 });
      }
      console.error('[API imports/[id]] Erreur Supabase:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(importLog);

  } catch (error) {
    console.error('[API imports/[id]] Erreur inattendue:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
