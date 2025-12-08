/**
 * Route de test - Private URL Zoho Analytics
 * 
 * GET /api/zoho/test-private-url?viewId=XXX
 * 
 * Teste :
 * 1. Récupération/création de Private URL pour une vue
 * 2. Construction du filtre ZOHO_CRITERIA
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { getTokens } from '@/lib/infrastructure/zoho/auth';

/**
 * Convertit le domaine API standard en domaine Analytics
 * zohoapis.eu -> analyticsapi.zoho.eu
 */
function convertToAnalyticsDomain(apiDomain: string): string {
  // Si déjà un domaine analytics, retourner tel quel
  if (apiDomain.includes('analyticsapi')) {
    return apiDomain.startsWith('https://') ? apiDomain : `https://${apiDomain}`;
  }
  
  // Extraire la région du domaine (eu, com, in, etc.)
  const match = apiDomain.match(/zohoapis\.(\w+)/);
  const region = match ? match[1] : 'eu';
  
  return `https://analyticsapi.zoho.${region}`;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Vérifier l'authentification
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // 2. Récupérer les tokens Zoho
    const tokens = await getTokens(user.id);
    if (!tokens) {
      return NextResponse.json({ error: 'Non connecté à Zoho' }, { status: 401 });
    }

    // 3. Paramètres
    const searchParams = request.nextUrl.searchParams;
    const viewId = searchParams.get('viewId');
    const workspaceId = searchParams.get('workspaceId');
    const action = searchParams.get('action') || 'get'; // get, create, test-filter

    // Domaine API
    const apiDomain = convertToAnalyticsDomain(tokens.apiDomain);
    const orgId = tokens.orgId;

    const headers = {
      'Authorization': `Zoho-oauthtoken ${tokens.accessToken}`,
      'ZANALYTICS-ORGID': orgId || '',
      'Content-Type': 'application/json',
    };

    // === ACTION: LISTER LES VUES (Dashboards) ===
    if (action === 'list-views' && workspaceId) {
      console.log(`[Test] Liste des vues du workspace ${workspaceId}`);
      
      const response = await fetch(
        `${apiDomain}/restapi/v2/workspaces/${workspaceId}/views`,
        { method: 'GET', headers }
      );
      
      const data = await response.json();
      
      if (data.status === 'success' && data.data?.views) {
        // Grouper par type
        const views = data.data.views;
        const dashboards = views.filter((v: any) => v.viewType === 'Dashboard');
        const tables = views.filter((v: any) => v.viewType === 'Table');
        
        return NextResponse.json({
          success: true,
          summary: {
            total: views.length,
            dashboards: dashboards.length,
            tables: tables.length,
          },
          dashboards: dashboards.map((d: any) => ({
            viewId: d.viewId,
            viewName: d.viewName,
            folderId: d.folderId,
            folderName: d.folderName,
          })),
          tables: tables.slice(0, 10).map((t: any) => ({
            viewId: t.viewId,
            viewName: t.viewName,
          })),
        });
      }
      
      return NextResponse.json({ success: false, error: data });
    }

    // === ACTION: RÉCUPÉRER PRIVATE URL EXISTANTE ===
    if (action === 'get' && viewId && workspaceId) {
      console.log(`[Test] Récupération Private URL pour view ${viewId}`);
      
      const response = await fetch(
        `${apiDomain}/restapi/v2/workspaces/${workspaceId}/views/${viewId}/publish/privatelink`,
        { method: 'GET', headers }
      );
      
      const data = await response.json();
      
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          exists: false,
          message: 'Pas de Private URL existante pour cette vue',
        });
      }
      
      if (data.status === 'success' && data.data?.privateUrl) {
        return NextResponse.json({
          success: true,
          exists: true,
          privateUrl: data.data.privateUrl,
          // Exemple de filtre
          exampleFilteredUrl: buildFilteredUrl(data.data.privateUrl, 'Email', 'test@example.com'),
        });
      }
      
      return NextResponse.json({ success: false, error: data });
    }

    // === ACTION: CRÉER PRIVATE URL ===
    if (action === 'create' && viewId && workspaceId) {
      console.log(`[Test] Création Private URL pour view ${viewId}`);
      
      const response = await fetch(
        `${apiDomain}/restapi/v2/workspaces/${workspaceId}/views/${viewId}/publish/privatelink`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            // maskCriteria: true, // Masquer le filtre dans l'URL (optionnel)
          }),
        }
      );
      
      const data = await response.json();
      
      if (data.status === 'success' && data.data?.privateUrl) {
        return NextResponse.json({
          success: true,
          created: true,
          privateUrl: data.data.privateUrl,
          exampleFilteredUrl: buildFilteredUrl(data.data.privateUrl, 'Email', 'test@example.com'),
        });
      }
      
      return NextResponse.json({ 
        success: false, 
        error: data,
        hint: 'Vérifier que votre plan Zoho Analytics supporte les Private URLs (Premium/Enterprise)',
      });
    }

    // === ACTION: VOIR LES COLONNES D'UNE VUE ===
    if (action === 'columns' && viewId && workspaceId) {
      console.log(`[Test] Colonnes de la vue ${viewId}`);
      
      const response = await fetch(
        `${apiDomain}/restapi/v2/workspaces/${workspaceId}/views/${viewId}?withInvolvedMetaInfo=true`,
        { method: 'GET', headers }
      );
      
      const data = await response.json();
      
      if (data.status === 'success') {
        const columns = data.data?.columns || [];
        const emailColumns = columns.filter((c: any) => 
          c.columnName.toLowerCase().includes('email') ||
          c.columnName.toLowerCase().includes('mail')
        );
        
        return NextResponse.json({
          success: true,
          viewName: data.data?.viewName,
          viewType: data.data?.viewType,
          columns: columns.map((c: any) => ({
            name: c.columnName,
            type: c.dataType,
          })),
          suggestedFilterColumns: emailColumns.map((c: any) => c.columnName),
        });
      }
      
      return NextResponse.json({ success: false, error: data });
    }

    // === ACTION: TEST COMPLET ===
    if (action === 'full-test' && workspaceId) {
      console.log(`[Test] Test complet pour workspace ${workspaceId}`);
      
      const results: any = {
        workspaceId,
        timestamp: new Date().toISOString(),
        steps: [],
      };

      // Étape 1: Lister les dashboards
      const viewsResponse = await fetch(
        `${apiDomain}/restapi/v2/workspaces/${workspaceId}/views`,
        { method: 'GET', headers }
      );
      const viewsData = await viewsResponse.json();
      
      if (viewsData.status !== 'success') {
        results.steps.push({ step: 'list-views', success: false, error: viewsData });
        return NextResponse.json(results);
      }
      
      const dashboards = viewsData.data.views.filter((v: any) => v.viewType === 'Dashboard');
      results.steps.push({
        step: 'list-views',
        success: true,
        dashboardCount: dashboards.length,
        firstDashboard: dashboards[0] ? {
          viewId: dashboards[0].viewId,
          viewName: dashboards[0].viewName,
        } : null,
      });

      // Si pas de dashboard, essayer avec une table
      const testView = dashboards[0] || viewsData.data.views[0];
      if (!testView) {
        results.steps.push({ step: 'select-view', success: false, error: 'Aucune vue trouvée' });
        return NextResponse.json(results);
      }

      results.testView = {
        viewId: testView.viewId,
        viewName: testView.viewName,
        viewType: testView.viewType,
      };

      // Étape 2: Vérifier Private URL existante
      const getPrivateResponse = await fetch(
        `${apiDomain}/restapi/v2/workspaces/${workspaceId}/views/${testView.viewId}/publish/privatelink`,
        { method: 'GET', headers }
      );
      
      let privateUrl: string | null = null;
      
      if (getPrivateResponse.status === 200) {
        const privateData = await getPrivateResponse.json();
        if (privateData.status === 'success' && privateData.data?.privateUrl) {
          privateUrl = privateData.data.privateUrl;
          results.steps.push({
            step: 'get-private-url',
            success: true,
            exists: true,
            privateUrl,
          });
        }
      } else if (getPrivateResponse.status === 404) {
        results.steps.push({
          step: 'get-private-url',
          success: true,
          exists: false,
          message: 'Pas de Private URL existante',
        });
        
        // Étape 3: Créer Private URL
        const createResponse = await fetch(
          `${apiDomain}/restapi/v2/workspaces/${workspaceId}/views/${testView.viewId}/publish/privatelink`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({}),
          }
        );
        const createData = await createResponse.json();
        
        if (createData.status === 'success' && createData.data?.privateUrl) {
          privateUrl = createData.data.privateUrl;
          results.steps.push({
            step: 'create-private-url',
            success: true,
            privateUrl,
          });
        } else {
          results.steps.push({
            step: 'create-private-url',
            success: false,
            error: createData,
            hint: 'Plan Premium/Enterprise requis pour les Private URLs',
          });
        }
      }

      // Étape 4: Construire URL filtrée
      if (privateUrl) {
        const filteredUrl = buildFilteredUrl(privateUrl, 'Email', 'user@example.com');
        results.steps.push({
          step: 'build-filtered-url',
          success: true,
          privateUrl,
          filteredUrl,
          filterSyntax: '("TABLE"."Email"=\'user@example.com\')',
        });
        results.finalUrl = filteredUrl;
      }

      results.success = !!privateUrl;
      return NextResponse.json(results);
    }

    // Par défaut: afficher l'aide
    return NextResponse.json({
      help: true,
      endpoints: [
        {
          action: 'list-views',
          description: 'Liste les dashboards et tables',
          params: 'workspaceId',
          example: '/api/zoho/test-private-url?action=list-views&workspaceId=XXX',
        },
        {
          action: 'get',
          description: 'Récupère une Private URL existante',
          params: 'workspaceId, viewId',
          example: '/api/zoho/test-private-url?action=get&workspaceId=XXX&viewId=YYY',
        },
        {
          action: 'create',
          description: 'Crée une Private URL',
          params: 'workspaceId, viewId',
          example: '/api/zoho/test-private-url?action=create&workspaceId=XXX&viewId=YYY',
        },
        {
          action: 'columns',
          description: 'Liste les colonnes d\'une vue',
          params: 'workspaceId, viewId',
          example: '/api/zoho/test-private-url?action=columns&workspaceId=XXX&viewId=YYY',
        },
        {
          action: 'full-test',
          description: 'Test complet automatique',
          params: 'workspaceId',
          example: '/api/zoho/test-private-url?action=full-test&workspaceId=XXX',
        },
      ],
    });

  } catch (error) {
    console.error('[Test Private URL] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Construit une URL avec filtre ZOHO_CRITERIA
 */
function buildFilteredUrl(privateUrl: string, column: string, value: string, table?: string): string {
  // Syntaxe: ("Table"."Column"='Value')
  // Si pas de table spécifiée, utiliser juste la colonne
  const criteria = table 
    ? `("${table}"."${column}"='${value}')`
    : `("${column}"='${value}')`;
  
  const encodedCriteria = encodeURIComponent(criteria);
  return `${privateUrl}?ZOHO_CRITERIA=${encodedCriteria}`;
}
