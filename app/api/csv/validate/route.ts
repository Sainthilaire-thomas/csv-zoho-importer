// app/api/csv/validate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { validationEngine } from '@/lib/domain/validation';
import type { TableValidationConfig, ColumnValidationConfig } from '@/types';
import Papa from 'papaparse';

export async function POST(request: NextRequest) {
  // Variables pour le cleanup
  let fileContent: string | null = null;
  let parsedData: Record<string, unknown>[] | null = null;

  try {
    const supabase = await createClient();

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Récupérer le form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const tableId = formData.get('tableId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Fichier requis' },
        { status: 400 }
      );
    }

    if (!tableId) {
      return NextResponse.json(
        { error: 'Table ID requis' },
        { status: 400 }
      );
    }

    // Vérifier la taille du fichier (50 MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Fichier trop volumineux (max 50 MB)' },
        { status: 400 }
      );
    }

    // Lire le contenu du fichier
    fileContent = await file.text();

    // Parser le CSV
    const parseResult = Papa.parse<Record<string, unknown>>(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
    });

    if (parseResult.errors.length > 0) {
      const criticalErrors = parseResult.errors.filter(
        (e) => e.type === 'Quotes' || e.type === 'FieldMismatch'
      );
      
      if (criticalErrors.length > 0) {
        return NextResponse.json(
          { 
            error: 'Erreur de parsing CSV',
            details: criticalErrors.map((e) => e.message),
          },
          { status: 400 }
        );
      }
    }

    parsedData = parseResult.data;

    // Récupérer la configuration de validation pour cette table
    const { data: rulesData, error: rulesError } = await supabase
      .from('validation_rules')
      .select('*')
      .eq('zoho_table_id', tableId)
      .eq('is_active', true);

    if (rulesError) {
      console.error('Erreur récupération règles:', rulesError);
    }

    // Construire la configuration de validation
    const columns: ColumnValidationConfig[] = (rulesData ?? []).map((rule) => ({
      columnName: rule.column_name,
      rules: rule.rules ?? [],
    }));

    const validationConfig: TableValidationConfig = {
      tableId,
      tableName: '',
      columns,
    };

    // Exécuter la validation
    const validationResult = validationEngine.validate(parsedData, validationConfig);

    return NextResponse.json({ result: validationResult });
  } catch (error) {
    console.error('Erreur validation CSV:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la validation' },
      { status: 500 }
    );
  } finally {
    // ZERO DATA RETENTION - Nettoyage explicite
    fileContent = null;
    parsedData = null;
  }
}
