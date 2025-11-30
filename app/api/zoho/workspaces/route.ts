// app/api/zoho/workspaces/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { ZohoAnalyticsClient } from '@/lib/infrastructure/zoho/client';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const zohoClient = await ZohoAnalyticsClient.forUser(session.user.id);
    
    if (!zohoClient) {
      return NextResponse.json({ 
        error: 'Connexion Zoho requise',
        needsReauthorization: true 
      }, { status: 401 });
    }

    const workspaces = await zohoClient.getWorkspaces();

    return NextResponse.json({ 
      workspaces: workspaces.map(ws => ({
        id: ws.workspaceId,
        name: ws.workspaceName
      }))
    });

  } catch (error: unknown) {
    console.error('Erreur chargement workspaces:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    
    if (errorMessage.includes('Non connecté') || errorMessage.includes('tokens') || errorMessage.includes('expiré')) {
      return NextResponse.json({ 
        error: 'Connexion Zoho requise',
        needsReauthorization: true 
      }, { status: 401 });
    }

    return NextResponse.json({ 
      error: errorMessage || 'Erreur lors du chargement des workspaces' 
    }, { status: 500 });
  }
}
