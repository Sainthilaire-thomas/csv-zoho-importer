/**
 * @file app/api/zoho/dashboard-embed/route.ts
 * @description API pour générer une URL de dashboard filtrée par utilisateur
 * 
 * Flow :
 * 1. Reçoit l'email de l'utilisateur
 * 2. Lookup dans Agents_SC pour trouver le Cpte_Matriculaire
 * 3. Récupère/crée la Private URL du dashboard
 * 4. Construit l'URL avec filtre ZOHO_CRITERIA
 * 5. Retourne l'URL complète
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { getTokens } from '@/lib/infrastructure/zoho/auth';

// Configuration du dashboard PQS
const DASHBOARD_CONFIG = {
  workspaceId: '1718953000016707052',  // RATP Réseaux de Bus
  viewId: '1718953000033028262',        // Conseiller PQS 2025
  agentsTableId: '1718953000033132623', // Agents_SC (viewId de la table)
  filterColumn: 'Nom',                  // Colonne de filtrage dans le dashboard
  // Private URL (sera récupérée/créée automatiquement)
  privateUrl: 'https://analytics.zoho.com/open-view/1718953000033028262/2f22f56df5772565ad3c1e7648862c39',
};

/**
 * Convertit le domaine API vers Analytics
 */
function convertToAnalyticsDomain(apiDomain: string): string {
  if (apiDomain.includes('analyticsapi')) {
    return apiDomain.startsWith('https://') ? apiDomain : `https://${apiDomain}`;
  }
  const match = apiDomain.match(/zohoapis\.(\w+)/);
  const region = match ? match[1] : 'eu';
  return `https://analyticsapi.zoho.${region}`;
}

/**
 * Parse une réponse CSV de Zoho en tableau d'objets
 */
function parseCSVResponse(csvText: string): { columns: string[]; rows: string[][] } {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) {
    return { columns: [], rows: [] };
  }

  // Première ligne = headers
  const columns = lines[0].split(',').map(col => col.trim().replace(/^"|"$/g, ''));
  
  // Lignes suivantes = données
  const rows = lines.slice(1).map(line => {
    // Parser CSV avec gestion des guillemets
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    return values;
  });

  return { columns, rows };
}

/**
 * Lookup agent dans la table Agents_SC par email
 */
async function lookupAgentByEmail(
  email: string,
  accessToken: string,
  apiDomain: string,
  orgId: string
): Promise<{
  found: boolean;
  agent?: {
    nom: string;
    email: string;
    matricule: string;
    cpteMatriculaire: string;
  };
  error?: string;
}> {
  try {
    console.log('[Lookup] Recherche agent avec email:', email);

    // Méthode : Lire les données de la table Agents_SC
    // L'API Zoho retourne du CSV par défaut
    const url = `${apiDomain}/restapi/v2/workspaces/${DASHBOARD_CONFIG.workspaceId}/views/${DASHBOARD_CONFIG.agentsTableId}/data`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'ZANALYTICS-ORGID': orgId,
      },
    });

    const responseText = await response.text();
    
    // Vérifier si c'est du JSON (erreur) ou du CSV (données)
    if (responseText.trim().startsWith('{')) {
      // C'est du JSON, probablement une erreur
      const jsonData = JSON.parse(responseText);
      if (jsonData.status === 'failure') {
        console.error('[Lookup] Erreur API:', jsonData);
        return { found: false, error: jsonData.data?.errorMessage || 'Erreur API Zoho' };
      }
    }

    // Parser le CSV
    const { columns, rows } = parseCSVResponse(responseText);
    
    console.log('[Lookup] Colonnes trouvées:', columns);
    console.log('[Lookup] Nombre de lignes:', rows.length);

    // Trouver les index des colonnes
    const emailIdx = columns.findIndex(c => c === 'Courriel');
    const nomIdx = columns.findIndex(c => c === 'Nom');
    const matriculeIdx = columns.findIndex(c => c === 'Matricule');
    const cpteIdx = columns.findIndex(c => c === 'Cpte_Matriculaire');

    console.log('[Lookup] Index colonnes - Email:', emailIdx, 'Nom:', nomIdx, 'Matricule:', matriculeIdx, 'Cpte:', cpteIdx);

    if (emailIdx === -1) {
      return { found: false, error: 'Colonne "Courriel" non trouvée dans la table Agents_SC' };
    }

    // Chercher la ligne avec l'email correspondant (case insensitive)
    const matchingRow = rows.find(row => 
      row[emailIdx]?.toLowerCase() === email.toLowerCase()
    );

    if (matchingRow) {
      const agent = {
        nom: matchingRow[nomIdx] || '',
        email: matchingRow[emailIdx] || '',
        matricule: matchingRow[matriculeIdx] || '',
        cpteMatriculaire: matchingRow[cpteIdx] || '',
      };

      console.log('[Lookup] Agent trouvé:', agent);
      return { found: true, agent };
    }

    console.log('[Lookup] Agent non trouvé pour:', email);
    return { found: false, error: `Aucun agent trouvé avec l'email: ${email}` };

  } catch (error) {
    console.error('[Lookup] Erreur:', error);
    return { found: false, error: `Erreur lors de la recherche: ${error}` };
  }
}

/**
 * Construit l'URL du dashboard avec le filtre ZOHO_CRITERIA
 */
function buildFilteredUrl(privateUrl: string, agentName: string): string {
  // Le filtre utilise la colonne "Nom" pour filtrer par agent
  const criteria = `("${DASHBOARD_CONFIG.filterColumn}"='${agentName}')`;
  const encodedCriteria = encodeURIComponent(criteria);
  return `${privateUrl}?ZOHO_CRITERIA=${encodedCriteria}`;
}

/**
 * POST /api/zoho/dashboard-embed
 * Body: { email: string }
 * Returns: { success, agent?, embedUrl?, error? }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Vérifier l'authentification
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    // 2. Récupérer les tokens Zoho
    const tokens = await getTokens(user.id);
    if (!tokens) {
      return NextResponse.json({ success: false, error: 'Non connecté à Zoho' }, { status: 401 });
    }

    // 3. Parser le body
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: false, error: 'Email requis' }, { status: 400 });
    }

    // 4. Lookup de l'agent
    const apiDomain = convertToAnalyticsDomain(tokens.apiDomain);
    const lookupResult = await lookupAgentByEmail(
      email,
      tokens.accessToken,
      apiDomain,
      tokens.orgId || ''
    );

    if (!lookupResult.found || !lookupResult.agent) {
      return NextResponse.json({
        success: false,
        error: lookupResult.error || 'Agent non trouvé',
      });
    }

    // 5. Construire l'URL filtrée
    const embedUrl = buildFilteredUrl(
      DASHBOARD_CONFIG.privateUrl,
      lookupResult.agent.nom
    );

    // 6. Retourner le résultat
    return NextResponse.json({
      success: true,
      agent: lookupResult.agent,
      privateUrl: DASHBOARD_CONFIG.privateUrl,
      embedUrl: embedUrl,
    });

  } catch (error) {
    console.error('[Dashboard Embed] Erreur:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/zoho/dashboard-embed
 * Retourne la configuration et les infos du dashboard
 */
export async function GET() {
  return NextResponse.json({
    dashboard: {
      name: 'Conseiller PQS 2025',
      workspaceId: DASHBOARD_CONFIG.workspaceId,
      viewId: DASHBOARD_CONFIG.viewId,
      filterColumn: DASHBOARD_CONFIG.filterColumn,
    },
    usage: {
      method: 'POST',
      body: '{ "email": "user@example.com" }',
      response: '{ "success": true, "agent": {...}, "embedUrl": "..." }',
    },
  });
}
