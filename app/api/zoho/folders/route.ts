import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { ZohoAnalyticsClient } from '@/lib/infrastructure/zoho/client';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

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

    const folders = await zohoClient.getFolders(workspaceId);

    return NextResponse.json({ folders });

  } catch (error: unknown) {
    console.error('Erreur chargement dossiers:', error);

    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';

    if (errorMessage.includes('Non connecte') || errorMessage.includes('tokens') || errorMessage.includes('expire')) {
      return NextResponse.json({
        error: 'Connexion Zoho requise',
        needsReauthorization: true
      }, { status: 401 });
    }

    return NextResponse.json({
      error: errorMessage || 'Erreur lors du chargement des dossiers'
    }, { status: 500 });
  }
}
