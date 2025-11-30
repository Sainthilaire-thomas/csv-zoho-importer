// app/api/zoho/tables/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { ZohoAnalyticsClient } from '@/lib/infrastructure/zoho/client';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Récupérer le workspaceId depuis les query params
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId requis' }, { status: 400 });
    }

    const zohoClient = await ZohoAnalyticsClient.forUser(session.user.id);

    if (!zohoClient) {
      return NextResponse.json({
        error: 'Connexion Zoho requise',
        needsReauthorization: true
      }, { status: 401 });
    }

    // DEBUG: Récupérer TOUTES les vues (pas seulement les tables)
    const allViews = await zohoClient.getTables(workspaceId, false); // false = ne pas filtrer
    console.log('=== DEBUG TABLES ===');
    console.log('Workspace ID:', workspaceId);
    console.log('Nombre total de vues:', allViews.length);
    console.log('Types de vues:', [...new Set(allViews.map(v => v.viewType))]);
    console.log('Premières 5 vues:', allViews.slice(0, 5).map(v => ({ 
      id: v.viewId, 
      name: v.viewName, 
      type: v.viewType 
    })));

    // Filtrer pour ne garder que les tables
   const tablesOnly = allViews.filter(v => {
  const type = v.viewType?.toLowerCase();
  return type === 'table' || type === 'querytable';
});

    // Mapper vers le format attendu par le frontend
    const tables = tablesOnly.map(table => ({
      id: table.viewId,
      name: table.viewName,
      displayName: table.viewName,
      workspaceId: workspaceId,
      type: table.viewType || 'TABLE',
      folderId: table.folderId
    }));

    console.log('Tables retournées au frontend:', tables.length);

    return NextResponse.json({ tables });

  } catch (error: unknown) {
    console.error('Erreur chargement tables:', error);

    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';

    if (errorMessage.includes('Non connecté') || errorMessage.includes('tokens') || errorMessage.includes('expiré')) {
      return NextResponse.json({
        error: 'Connexion Zoho requise',
        needsReauthorization: true
      }, { status: 401 });
    }

    return NextResponse.json({
      error: errorMessage || 'Erreur lors du chargement des tables'
    }, { status: 500 });
  }
}
