// app/api/profiles/[id]/route.ts
// API pour la gestion d'un profil spécifique
// GET    : Récupère un profil par ID
// PUT    : Met à jour un profil
// DELETE : Supprime un profil

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { 
  ImportProfile, 
  ImportProfileRow, 
  UpdateProfilePayload,
  ProfileUpdateFromImport,
  rowToProfile 
} from '@/types/profiles';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// =============================================================================
// GET : Récupère un profil par ID
// =============================================================================

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }
    
    // Récupérer le profil
    const { data, error } = await supabase
      .schema('csv_importer')
      .from('import_profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Profil non trouvé' },
          { status: 404 }
        );
      }
      console.error('Erreur récupération profil:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la récupération du profil' },
        { status: 500 }
      );
    }
    
    const profile = rowToProfile(data as ImportProfileRow);
    
    return NextResponse.json({
      success: true,
      data: profile
    });
    
  } catch (error) {
    console.error('Erreur API profile GET:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT : Met à jour un profil
// =============================================================================

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
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
    const body: UpdateProfilePayload | ProfileUpdateFromImport = await request.json();
    
    // Vérifier que le profil existe
    const { data: existingProfile, error: fetchError } = await supabase
      .schema('csv_importer')
      .from('import_profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !existingProfile) {
      return NextResponse.json(
        { error: 'Profil non trouvé' },
        { status: 404 }
      );
    }
    
    // Construire les données de mise à jour
    const updateData: Record<string, unknown> = {};
    
    // Mise à jour standard (UpdateProfilePayload)
    if ('name' in body && body.name !== undefined) {
      updateData.name = body.name.trim();
    }
    if ('description' in body && body.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }
    if ('columns' in body && body.columns !== undefined) {
      updateData.columns = body.columns;
    }
    if ('defaultImportMode' in body && body.defaultImportMode !== undefined) {
      updateData.default_import_mode = body.defaultImportMode;
    }
    
     if ('matchingColumns' in body) {
      updateData.matching_columns = (body as { matchingColumns?: string[] | null }).matchingColumns ?? null;
    }
    
    // Mise à jour après import (ProfileUpdateFromImport)
    if ('newAliases' in body || 'newFormats' in body) {
      const currentColumns = existingProfile.columns as unknown[];
      const updatedColumns = updateColumnsWithNewData(
        currentColumns as ProfileColumnRow[],
        body as ProfileUpdateFromImport
      );
      updateData.columns = updatedColumns;
    }
    
    if ('lastUsedAt' in body) {
      updateData.last_used_at = (body as ProfileUpdateFromImport).lastUsedAt;
    }
    
    if ('incrementUseCount' in body && (body as ProfileUpdateFromImport).incrementUseCount) {
      updateData.use_count = (existingProfile.use_count || 0) + 1;
    }
    
    // Si aucune donnée à mettre à jour
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Aucune donnée à mettre à jour' },
        { status: 400 }
      );
    }
    
    // Effectuer la mise à jour
    const { data, error } = await supabase
      .schema('csv_importer')
      .from('import_profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Erreur mise à jour profil:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour du profil' },
        { status: 500 }
      );
    }
    
    const profile = rowToProfile(data as ImportProfileRow);
    
    return NextResponse.json({
      success: true,
      data: profile
    });
    
  } catch (error) {
    console.error('Erreur API profile PUT:', error);
    
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

// =============================================================================
// DELETE : Supprime un profil
// =============================================================================

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }
    
    // Vérifier que le profil existe et appartient à l'utilisateur
    const { data: existingProfile, error: fetchError } = await supabase
      .schema('csv_importer')
      .from('import_profiles')
      .select('id, created_by, name')
      .eq('id', id)
      .single();
    
    if (fetchError || !existingProfile) {
      return NextResponse.json(
        { error: 'Profil non trouvé' },
        { status: 404 }
      );
    }
    
    // Vérifier les permissions (seul le créateur peut supprimer)
    if (existingProfile.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Vous ne pouvez supprimer que les profils que vous avez créés' },
        { status: 403 }
      );
    }
    
    // Supprimer le profil
    const { error } = await supabase
      .schema('csv_importer')
      .from('import_profiles')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Erreur suppression profil:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la suppression du profil' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `Profil "${existingProfile.name}" supprimé avec succès`
    });
    
  } catch (error) {
    console.error('Erreur API profile DELETE:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPERS
// =============================================================================

interface ProfileColumnRow {
  id: string;
  zohoColumn: string;
  acceptedNames: string[];
  config: {
    type: string;
    acceptedFormats?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Met à jour les colonnes avec les nouveaux alias et formats
 */
function updateColumnsWithNewData(
  columns: ProfileColumnRow[],
  updates: ProfileUpdateFromImport
): ProfileColumnRow[] {
  return columns.map(column => {
    const newColumn = { ...column };
    
    // Ajouter nouveaux alias
    if (updates.newAliases && updates.newAliases[column.zohoColumn]) {
      const currentNames = new Set(column.acceptedNames || []);
      updates.newAliases[column.zohoColumn].forEach(alias => currentNames.add(alias));
      newColumn.acceptedNames = Array.from(currentNames);
    }
    
    // Ajouter nouveaux formats
    if (updates.newFormats && updates.newFormats[column.zohoColumn]) {
      const config = { ...column.config };
      if (config.acceptedFormats) {
        const currentFormats = new Set(config.acceptedFormats);
        updates.newFormats[column.zohoColumn].forEach(format => currentFormats.add(format));
        config.acceptedFormats = Array.from(currentFormats);
      }
      newColumn.config = config;
    }
    
    return newColumn;
  });
}
