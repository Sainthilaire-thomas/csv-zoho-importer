import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { ZohoAnalyticsClient } from '@/lib/infrastructure/zoho/client';

const WORKSPACE_ID = '1718953000016707052'; // RATP Réseaux de Bus

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const client = await ZohoAnalyticsClient.forUser(user.id);
    if (!client) {
      return NextResponse.json({ error: 'Non connecté à Zoho' }, { status: 401 });
    }

    // Récupérer TOUTES les views (pas seulement les tables)
    const allViews = await client.getTables(WORKSPACE_ID, false);

    // Grouper par type
    const grouped = allViews.reduce((acc, view) => {
      const type = view.viewType || 'unknown';
      if (!acc[type]) acc[type] = [];
      acc[type].push({
        viewId: view.viewId,
        viewName: view.viewName,
        folderId: view.folderId,
      });
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json({
      workspaceId: WORKSPACE_ID,
      totalViews: allViews.length,
      byType: grouped,
      // Chercher spécifiquement les vues liées à PQS
      pqsRelated: allViews.filter(v =>
        v.viewName.toLowerCase().includes('pqs') ||
        v.viewName.toLowerCase().includes('prime') ||
        v.viewName.toLowerCase().includes('qualité') ||
        v.viewName.toLowerCase().includes('quantité')
      ),
    });
  } catch (error) {
    console.error('Erreur:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
