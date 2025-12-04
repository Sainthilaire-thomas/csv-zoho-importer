// app/api/profiles/route.ts
// API pour la gestion des profils d'import
// GET  : Liste tous les profils
// POST : Crée un nouveau profil

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { 
  ImportProfile, 
  ImportProfileRow, 
  CreateProfilePayload,
  rowToProfile 
} from '@/types/profiles';

// =============================================================================
// GET : Liste tous les profils
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }
    
    // Paramètres de requête optionnels
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const viewId = searchParams.get('viewId');
    
    // Construire la requête (schéma csv_importer)
    let query = supabase
      .schema('csv_importer')
      .from('import_profiles')
      .select('*')
      .order('last_used_at', { ascending: false, nullsFirst: false });
    
    // Filtres optionnels
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }
    if (viewId) {
      query = query.eq('view_id', viewId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erreur récupération profils:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des profils' },
        { status: 500 }
      );
    }
    
    // Convertir les rows en ImportProfile
    const profiles: ImportProfile[] = (data as ImportProfileRow[]).map(rowToProfile);
    
    return NextResponse.json({
      success: true,
      data: profiles,
      count: profiles.length
    });
    
  } catch (error) {
    console.error('Erreur API profiles GET:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST : Crée un nouveau profil
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }
    
    // Parser le body
    const body: CreateProfilePayload = await request.json();
    
    // Validation des champs requis
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: 'Le nom du profil est requis' },
        { status: 400 }
      );
    }
    if (!body.viewId) {
      return NextResponse.json(
        { error: 'viewId est requis' },
        { status: 400 }
      );
    }
    if (!body.workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId est requis' },
        { status: 400 }
      );
    }
    
    // Vérifier qu'un profil n'existe pas déjà pour cette table
    const { data: existingProfile } = await supabase
      .schema('csv_importer')
      .from('import_profiles')
      .select('id, name')
      .eq('view_id', body.viewId)
      .single();
    
    if (existingProfile) {
      return NextResponse.json(
        { 
          error: `Un profil existe déjà pour cette table: "${existingProfile.name}"`,
          existingProfileId: existingProfile.id
        },
        { status: 409 } // Conflict
      );
    }
    
    // Générer des IDs pour les colonnes (les colonnes arrivent sans ID)
    const columnsWithIds = (body.columns || []).map((col, index) => ({
      ...col,
      id: `col_${Date.now()}_${index}`
    }));
    
    // Préparer les données pour insertion
        const insertData = {
      name: body.name.trim(),
      description: body.description?.trim() || null,
      workspace_id: body.workspaceId,
      workspace_name: body.workspaceName,
      view_id: body.viewId,
      view_name: body.viewName,
      columns: columnsWithIds,
      default_import_mode: body.defaultImportMode || 'append',
      matching_columns: body.matchingColumns || null,
      created_by: user.id
    };
    
    // Insérer le profil
    const { data, error } = await supabase
      .schema('csv_importer')
      .from('import_profiles')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      console.error('Erreur création profil:', error);
      
      // Gérer l'erreur de contrainte unique
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Un profil existe déjà pour cette table' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: 'Erreur lors de la création du profil' },
        { status: 500 }
      );
    }
    
    const profile = rowToProfile(data as ImportProfileRow);
    
    return NextResponse.json({
      success: true,
      data: profile
    }, { status: 201 });
    
  } catch (error) {
    console.error('Erreur API profiles POST:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'JSON invalide dans le body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
