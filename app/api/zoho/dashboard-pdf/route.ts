/**
 * @file app/api/zoho/dashboard-pdf/route.ts
 * @description Génère un PDF du bilan PQS pour un conseiller
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { ZohoAnalyticsClient } from '@/lib/infrastructure/zoho';
import { renderToBuffer } from '@react-pdf/renderer';
import { BilanPQSDocument } from '@/lib/pdf/templates/bilan-pqs';
import type { PQSRow } from '@/lib/pdf/types';
import { PDFTemplateConfig, DEFAULT_CONFIG } from '@/lib/pdf/config';

// Configuration
const CONFIG = {
  workspaceId: '1718953000016707052',
  scPqsViewId: '1718953000032998801',
  agentsTableId: '1718953000033132623',
};

/**
 * Lookup agent par email dans Agents_SC
 */
async function lookupAgent(
  client: ZohoAnalyticsClient,
  email: string
): Promise<{ nom: string; matricule: string } | null> {
  try {
    const result = await client.exportData(
      CONFIG.workspaceId,
      CONFIG.agentsTableId,
      { limit: 200 }
    );

    const agent = result.data.find(
      (row: any) => row.Courriel?.toLowerCase() === email.toLowerCase()
    );

    if (agent) {
      return {
        nom: agent.Nom as string,
        matricule: agent.Matricule as string,
      };
    }
    return null;
  } catch (error) {
    console.error('[Dashboard PDF] Lookup error:', error);
    return null;
  }
}

/**
 * Récupère les données PQS pour un agent
 */
async function getPQSData(
  client: ZohoAnalyticsClient,
  agentNom: string
): Promise<PQSRow[]> {
  try {
    const criteria = `"Nom"='${agentNom}'`;
    
    const result = await client.exportDataAsync(
      CONFIG.workspaceId,
      CONFIG.scPqsViewId,
      { 
        criteria,
        responseFormat: 'json',
        maxWaitSeconds: 60,
      }
    );

    return result.data as PQSRow[];
  } catch (error) {
    console.error('[Dashboard PDF] PQS data error:', error);
    throw error;
  }
}

/**
 * POST /api/zoho/dashboard-pdf
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // 2. Client Zoho
    const client = await ZohoAnalyticsClient.forUser(user.id);
    if (!client) {
      return NextResponse.json({ error: 'Non connecté à Zoho' }, { status: 401 });
    }

     // 3. Body
    const body = await request.json();
    const { email, config: userConfig } = body;
    
    // Fusionner config utilisateur avec défaut
    const config: PDFTemplateConfig = {
      ...DEFAULT_CONFIG,
      ...userConfig,
      colors: { ...DEFAULT_CONFIG.colors, ...userConfig?.colors },
      sections: { ...DEFAULT_CONFIG.sections, ...userConfig?.sections },
      tableColumns: { ...DEFAULT_CONFIG.tableColumns, ...userConfig?.tableColumns },
      kpis: { ...DEFAULT_CONFIG.kpis, ...userConfig?.kpis },
    };

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 });
    }

    // 4. Lookup agent
    const agent = await lookupAgent(client, email);
    if (!agent) {
      return NextResponse.json({ 
        error: `Agent non trouvé: ${email}` 
      }, { status: 404 });
    }

    console.log('[Dashboard PDF] Agent found:', agent);

    // 5. Récupérer données PQS
    const pqsData = await getPQSData(client, agent.nom);

    if (pqsData.length === 0) {
      return NextResponse.json({ 
        error: `Aucune donnée PQS pour ${agent.nom}` 
      }, { status: 404 });
    }

    console.log('[Dashboard PDF] PQS data rows:', pqsData.length);

    // 6. Générer le PDF
    const pdfBuffer = await renderToBuffer(
      BilanPQSDocument({
        data: {
          agent: { ...agent, email },
          rows: pqsData,
          generatedAt: new Date(),
        },
        config,
      })
    );

    console.log('[Dashboard PDF] PDF generated, size:', pdfBuffer.length);

    // 7. Retourner le PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="bilan-pqs-${agent.nom.toLowerCase()}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('[Dashboard PDF] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * GET - Info sur l'endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/zoho/dashboard-pdf',
    method: 'POST',
    body: { email: 'string (email du conseiller)' },
    response: 'PDF du bilan PQS',
  });
}
