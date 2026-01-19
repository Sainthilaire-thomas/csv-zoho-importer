'use client';

/**
 * StepTransformPreview - Mission 006
 * Affiche un aperçu détaillé des données AVANT import
 * Montre : Source (fichier) → Transformé (envoyé à Zoho)
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { 
  ArrowRight, 
  ChevronDown, 
  ChevronUp,
  Info,
  RefreshCw,
  Check,
  Eye
} from 'lucide-react';
import type { AutoTransformation, ColumnMapping } from '@/lib/infrastructure/zoho/types';

// =============================================================================
// TYPES
// =============================================================================

interface StepTransformPreviewProps {
  autoTransformations: AutoTransformation[];
  matchedColumns: ColumnMapping[];
  parsedData: Record<string, unknown>[];
  totalRows: number;
  zohoReferenceRow?: Record<string, unknown> | null;
  onBack: () => void;
  onConfirm: () => void;
}

// =============================================================================
// HELPERS - Simulation des transformations
// =============================================================================

function applyTransformation(value: string, transformType: string | undefined): string {
  if (!value || value.trim() === '') return '';
  
  switch (transformType) {
    case 'date_format':
      // Simuler conversion DD/MM/YYYY → YYYY-MM-DD
      const dateMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (dateMatch) {
        return `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
      }
      return value;
      
    case 'number_format':
      // Simuler conversion 1 234,56 → 1234.56
      return value.replace(/\s/g, '').replace(',', '.');
      
    case 'duration_format':
      // Simuler conversion 9:30 → 09:30:00
      const durationMatch = value.match(/^(\d{1,2}):(\d{2})$/);
      if (durationMatch) {
        const hours = durationMatch[1].padStart(2, '0');
        return `${hours}:${durationMatch[2]}:00`;
      }
      return value;
      
    case 'trim':
      return value.trim();
      
    default:
      return value;
  }
}

function getTransformLabel(transformType: string | undefined): string | null {
  switch (transformType) {
    case 'date_format': return 'Date → ISO';
    case 'number_format': return 'Nombre FR → US';
    case 'duration_format': return 'Durée → HH:mm:ss';
    case 'trim': return 'Espaces supprimés';
    default: return null;
  }
}

/**
 * Prédit comment Zoho affichera une valeur basé sur le type de colonne
 */
function predictZohoDisplay(value: string, zohoType: string | null | undefined): string {
  if (!value) return '';
  
  // Pour les dates, Zoho affiche en format "DD Mon, YYYY HH:mm:ss"
  if (zohoType === 'DATE' || zohoType === 'DATE_AS_DATE' || zohoType === 'DATE_TIME') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Format ISO date seule : 2025-04-04
    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const day = dateOnlyMatch[3];
      const month = months[parseInt(dateOnlyMatch[2], 10) - 1];
      const year = dateOnlyMatch[1];
      return `${day} ${month}, ${year} 00:00:00`;
    }
    
    // Format ISO datetime : 2025-04-04 23:59:35 ou 2025-04-04T23:59:35
    const dateTimeMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})$/);
    if (dateTimeMatch) {
      const day = dateTimeMatch[3];
      const month = months[parseInt(dateTimeMatch[2], 10) - 1];
      const year = dateTimeMatch[1];
      const time = `${dateTimeMatch[4]}:${dateTimeMatch[5]}:${dateTimeMatch[6]}`;
      return `${day} ${month}, ${year} ${time}`;
    }
  }
  
  return value;
}

// =============================================================================
// COMPOSANT PRINCIPAL
// =============================================================================

export function StepTransformPreview({
  autoTransformations,
  matchedColumns,
  parsedData,
  totalRows,
  zohoReferenceRow,
  onBack,
  onConfirm,
}: StepTransformPreviewProps) {
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [sampleCount, setSampleCount] = useState(5);
  
  // Filtrer les colonnes mappées
  const mappedColumns = matchedColumns.filter(col => col.isMapped);
  
  // Colonnes avec transformation
  const transformedColumns = mappedColumns.filter(col => 
    col.transformNeeded && col.transformNeeded !== 'none'
  );
  
  // Colonnes sans transformation
  const unchangedColumns = mappedColumns.filter(col => 
    !col.transformNeeded || col.transformNeeded === 'none'
  );
  
  // Données échantillons
  const sampleData = parsedData.slice(0, sampleCount);
  
  // Colonnes à afficher
  const displayColumns = showAllColumns ? mappedColumns : transformedColumns;
  
  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Aperçu des transformations
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Vérifiez comment vos données seront transformées avant l'import dans Zoho
        </p>
      </div>

      {/* Résumé */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-500" />
            Résumé
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox value={totalRows} label="Lignes à importer" />
            <StatBox value={mappedColumns.length} label="Colonnes mappées" />
            <StatBox 
              value={transformedColumns.length} 
              label="Avec transformation" 
              highlight="blue"
            />
            <StatBox 
              value={unchangedColumns.length} 
              label="Sans modification" 
              highlight="green"
            />
          </div>
        </CardContent>
      </Card>

      {/* Toggle affichage */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant={showAllColumns ? 'outline' : 'primary'}
            size="sm"
            onClick={() => setShowAllColumns(false)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Transformées ({transformedColumns.length})
          </Button>
          <Button
            variant={showAllColumns ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setShowAllColumns(true)}
          >
            <Eye className="h-4 w-4 mr-2" />
            Toutes les colonnes ({mappedColumns.length})
          </Button>
        </div>
        
        <select
          value={sampleCount}
          onChange={(e) => setSampleCount(Number(e.target.value))}
          className="text-sm border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-700"
        >
          <option value={3}>3 lignes</option>
          <option value={5}>5 lignes</option>
          <option value={10}>10 lignes</option>
        </select>
      </div>

      {/* Tableau de prévisualisation */}
      {displayColumns.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-10">
                      #
                    </th>
                   {displayColumns.map((col) => (
                      <th key={col.fileColumn} className="px-3 py-2 text-left min-w-[200px]">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {col.fileColumn}
                          </span>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500">→ {col.zohoColumn}</span>
                            {col.transformNeeded && col.transformNeeded !== 'none' && (
                              <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                {getTransformLabel(col.transformNeeded)}
                              </span>
                            )}
                          </div>
                         {/* Exemple Zoho existant */}
                          {zohoReferenceRow && col.zohoColumn && zohoReferenceRow[col.zohoColumn] !== undefined && (
                            <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                              <span>📋</span>
                              <span className="font-mono truncate max-w-[180px]" title={String(zohoReferenceRow[col.zohoColumn])}>
                                {String(zohoReferenceRow[col.zohoColumn])}
                              </span>
                            </div>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {sampleData.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-2 text-gray-400 text-xs">
                        {rowIndex + 1}
                      </td>
                     {displayColumns.map((col) => {
                        const sourceValue = String(row[col.fileColumn] ?? '');
                        const transformedValue = applyTransformation(sourceValue, col.transformNeeded);
                        const zohoPreview = predictZohoDisplay(transformedValue, col.zohoType);
                        const hasChanged = sourceValue !== transformedValue && sourceValue !== '';
                        const zohoWillDiffer = transformedValue !== zohoPreview;

                        return (
                          <td key={col.fileColumn} className="px-3 py-2">
                            <div className="flex flex-col gap-1">
                              {/* 📄 Valeur source (fichier) */}
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400 text-xs">📄</span>
                                <span className="font-mono text-gray-600 dark:text-gray-400 text-xs">
                                  {sourceValue || <span className="italic text-gray-400">(vide)</span>}
                                </span>
                              </div>

                              {/* 🔄 Valeur transformée (envoyée à Zoho) */}
                              {hasChanged && (
                                <div className="flex items-center gap-2">
                                  <span className="text-blue-500 text-xs">🔄</span>
                                  <span className="font-mono text-blue-600 dark:text-blue-400 font-medium text-xs">
                                    {transformedValue}
                                  </span>
                                </div>
                              )}

                              {/* 👁️ Zoho affichera */}
                              {sourceValue && zohoWillDiffer && (
                                <div className="flex items-center gap-2">
                                  <span className="text-purple-500 text-xs">👁️</span>
                                  <span className="font-mono text-purple-600 dark:text-purple-400 text-xs">
                                    {zohoPreview}
                                  </span>
                                </div>
                              )}

                              {/* ✅ Inchangé */}
                              {sourceValue && !hasChanged && !zohoWillDiffer && (
                                <div className="flex items-center gap-2">
                                  <Check className="h-3 w-3 text-green-500 shrink-0" />
                                  <span className="text-xs text-green-600 dark:text-green-400">
                                    Inchangé
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Alert variant="success" title="Aucune transformation nécessaire">
          Vos données sont déjà dans le format attendu par Zoho Analytics.
          Cliquez sur "Toutes les colonnes" pour prévisualiser vos données.
        </Alert>
      )}

      {/* Liste des colonnes inchangées (si on affiche que transformées) */}
      {!showAllColumns && unchangedColumns.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              Colonnes sans modification ({unchangedColumns.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {unchangedColumns.slice(0, 10).map((col) => (
                <span
                  key={col.fileColumn}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded"
                >
                  {col.fileColumn}
                </span>
              ))}
              {unchangedColumns.length > 10 && (
                <span className="px-2 py-1 text-xs text-gray-500">
                  +{unchangedColumns.length - 10} autres
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Note explicative */}
      <Alert variant="info" title="Comment lire ce tableau">
        <div className="space-y-2">
          <p>Chaque cellule montre le flux de transformation de vos données :</p>
          <ul className="text-sm space-y-1">
            <li><span className="mr-2">📄</span><strong>Fichier Excel</strong> : Valeur brute de votre fichier</li>
            <li><span className="mr-2">🔄</span><strong>Sera envoyé</strong> : Valeur après transformation (si différente)</li>
            <li><span className="mr-2">👁️</span><strong>Zoho affichera</strong> : Format d'affichage dans Zoho (ex: dates)</li>
          </ul>
        </div>
      </Alert>

      {/* Boutons d'action */}
      <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <Button onClick={onConfirm}>
          Confirmer et continuer
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// SOUS-COMPOSANTS
// =============================================================================

function StatBox({ 
  value, 
  label, 
  highlight 
}: { 
  value: number; 
  label: string; 
  highlight?: 'blue' | 'green';
}) {
  const bgClass = highlight === 'blue' 
    ? 'bg-blue-50 dark:bg-blue-900/20' 
    : highlight === 'green'
    ? 'bg-green-50 dark:bg-green-900/20'
    : 'bg-gray-50 dark:bg-gray-800';
    
  const textClass = highlight === 'blue'
    ? 'text-blue-600 dark:text-blue-400'
    : highlight === 'green'
    ? 'text-green-600 dark:text-green-400'
    : 'text-gray-900 dark:text-gray-100';

  return (
    <div className={`text-center p-3 rounded-lg ${bgClass}`}>
      <div className={`text-2xl font-bold ${textClass}`}>
        {value}
      </div>
      <div className={`text-xs ${highlight ? textClass : 'text-gray-500 dark:text-gray-400'}`}>
        {label}
      </div>
    </div>
  );
}
