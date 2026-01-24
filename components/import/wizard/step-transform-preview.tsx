'use client';

/**
 * StepTransformPreview - Mission 006 + Mission 017 Phase 2
 * Affiche un aperçu détaillé des données AVANT import
 * 
 * NOUVEAU (Phase 2): UI Accordéon montrant la chaîne complète de transformation :
 * - Source Excel (v, z, w)
 * - Interprétation locale
 * - Transformation appliquée
 * - Ce qui sera envoyé à Zoho
 * - Prévision affichage Zoho
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Info,
  RefreshCw,
  Check,
  Eye,
  FileSpreadsheet,
  Monitor,
  Repeat,
  Cloud,
} from 'lucide-react';
import type { AutoTransformation, ColumnMapping } from '@/lib/infrastructure/zoho/types';
import type { RawCellDataMap } from '@/types/profiles';

// =============================================================================
// TYPES
// =============================================================================

interface StepTransformPreviewProps {
  autoTransformations: AutoTransformation[];
  matchedColumns: ColumnMapping[];
  parsedData: Record<string, unknown>[];
  totalRows: number;
  zohoReferenceRow?: Record<string, unknown> | null;
  // NOUVEAU: Données brutes Excel pour l'accordéon
  rawCellData?: RawCellDataMap;
  fileType?: 'csv' | 'xlsx' | 'xls';
  onBack: () => void;
  onConfirm: () => void;
}

interface AccordionRowState {
  [key: string]: boolean;  // "rowIndex-columnName" -> expanded
}

// =============================================================================
// HELPERS - Simulation des transformations
// =============================================================================

function applyTransformation(value: string, transformType: string | undefined): string {
  if (!value || (typeof value === 'string' && value.trim() === '')) return '';

  const strValue = String(value);

  switch (transformType) {
    case 'date_format':
      // Simuler conversion DD/MM/YYYY → YYYY-MM-DD
      // Avec heure: DD/MM/YYYY HH:mm:ss → YYYY-MM-DD HH:mm:ss
      const dateTimeMatch = strValue.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
      if (dateTimeMatch) {
        return `${dateTimeMatch[3]}-${dateTimeMatch[2]}-${dateTimeMatch[1]} ${dateTimeMatch[4]}:${dateTimeMatch[5]}:${dateTimeMatch[6]}`;
      }
      const dateMatch = strValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (dateMatch) {
        return `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
      }
      return strValue;

    case 'number_format':
      // Simuler conversion 1 234,56 → 1234.56
      return strValue.replace(/\s/g, '').replace(',', '.');

    case 'duration_format':
      // Simuler conversion 9:30 → 09:30:00
      const durationMatch = strValue.match(/^(\d{1,2}):(\d{2})$/);
      if (durationMatch) {
        const hours = durationMatch[1].padStart(2, '0');
        return `${hours}:${durationMatch[2]}:00`;
      }
      return strValue;

    case 'trim':
      return strValue.trim();

    default:
      return strValue;
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

/**
 * Génère la description de la règle de transformation
 */
function getTransformationRule(
  isLocaleAware: boolean,
  hasTime: boolean,
  transformType: string | undefined
): string {
  if (isLocaleAware) {
    if (hasTime) {
      return 'Format locale-aware (Excel FR) → DD/MM/YYYY HH:mm:ss → ISO';
    }
    return 'Format locale-aware (Excel FR) → DD/MM/YYYY → ISO';
  }
  
  switch (transformType) {
    case 'date_format': return 'DD/MM/YYYY → ISO (YYYY-MM-DD)';
    case 'number_format': return 'Virgule décimale → Point décimal';
    case 'duration_format': return 'HH:mm → HH:mm:ss';
    default: return 'Aucune transformation';
  }
}

// =============================================================================
// COMPOSANT ACCORDÉON DÉTAIL CELLULE
// =============================================================================

interface CellDetailAccordionProps {
  columnName: string;
  rowIndex: number;
  sourceValue: unknown;
  transformedValue: string;
  zohoPreview: string;
  zohoType: string | null | undefined;
  zohoReferenceValue?: unknown;
  rawCell?: {
    v: unknown;
    z?: string;
    w?: string;
    t?: string;
    isLocaleAwareFormat: boolean;
  };
  isExpanded: boolean;
  onToggle: () => void;
}

function CellDetailAccordion({
  columnName,
  rowIndex,
  sourceValue,
  transformedValue,
  zohoPreview,
  zohoType,
  zohoReferenceValue,
  rawCell,
  isExpanded,
  onToggle,
}: CellDetailAccordionProps) {
  const hasTransformation = String(sourceValue) !== transformedValue && sourceValue !== '';
  const hasRawData = rawCell && rawCell.v !== undefined;
  const isExcelDate = rawCell?.isLocaleAwareFormat && rawCell?.t === 'n';
  
// Ne pas afficher l'accordéon si pas de données intéressantes
  const displayValue = String(sourceValue ?? '');
  
  if (!hasRawData && !hasTransformation) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="font-mono text-gray-600 dark:text-gray-400">
          {displayValue || <span className="italic text-gray-400">(vide)</span>}
        </span>
        {displayValue && (
          <Check className="h-3 w-3 text-green-500 shrink-0" />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* En-tête cliquable */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 -mx-1 w-full text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
        )}
        
        {/* Résumé compact */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-gray-600 dark:text-gray-400 text-xs">
            {String(sourceValue) || <span className="italic">(vide)</span>}
          </span>
          
          {hasTransformation && (
            <>
              <ArrowRight className="h-3 w-3 text-blue-500" />
              <span className="font-mono text-blue-600 dark:text-blue-400 text-xs font-medium">
                {transformedValue}
              </span>
            </>
          )}
          
          {hasRawData && (
            <span className="text-xs text-purple-500 ml-1">
              (détails)
            </span>
          )}
        </div>
      </button>

      {/* Contenu accordéon */}
      {isExpanded && hasRawData && (
        <div className="ml-5 mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3 text-xs">
          
          {/* 1. Source Excel */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
              <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
              Source Excel
            </div>
            <div className="ml-5 space-y-0.5 text-gray-600 dark:text-gray-400">
              <div>
                <span className="text-gray-500">Valeur brute (v) :</span>{' '}
                <span className="font-mono">{String(rawCell.v)}</span>
                {rawCell.t && (
                  <span className="text-gray-400 ml-2">
                    [type: {rawCell.t === 'n' ? 'number' : rawCell.t === 's' ? 'string' : rawCell.t}]
                  </span>
                )}
              </div>
              {rawCell.z && (
                <div>
                  <span className="text-gray-500">Format Excel (z) :</span>{' '}
                  <span className="font-mono">{rawCell.z}</span>
                  {rawCell.isLocaleAwareFormat && (
                    <span className="ml-2 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-[10px]">
                      locale-aware
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Interprétation locale (si locale-aware) */}
          {isExcelDate && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
                <Monitor className="h-3.5 w-3.5 text-amber-600" />
                Affichage Excel (Windows FR)
              </div>
              <div className="ml-5 space-y-0.5 text-gray-600 dark:text-gray-400">
                <div>
                  <span className="text-gray-500">Tu vois :</span>{' '}
                  <span className="font-mono font-medium text-amber-700 dark:text-amber-400">
                    {String(sourceValue)}
                  </span>
                </div>
                {rawCell.w && rawCell.w !== String(sourceValue) && (
                  <div className="text-gray-500 text-[11px]">
                    <span>ℹ️ Bibliothèque xlsx lit :</span>{' '}
                    <span className="font-mono text-gray-400">{rawCell.w}</span>
                    <span className="ml-1">(format US, nous utilisons ta valeur FR)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Transformation */}
          {hasTransformation && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
                <Repeat className="h-3.5 w-3.5 text-blue-600" />
                Transformation
              </div>
              <div className="ml-5 space-y-0.5 text-gray-600 dark:text-gray-400">
                <div>
                  <span className="text-gray-500">Règle :</span>{' '}
                  <span>{getTransformationRule(rawCell.isLocaleAwareFormat, String(sourceValue).includes(':'), undefined)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Résultat :</span>{' '}
                  <span className="font-mono font-medium text-blue-600 dark:text-blue-400">
                    {transformedValue}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 4. Zoho Analytics */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
              <Cloud className="h-3.5 w-3.5 text-purple-600" />
              Zoho Analytics
            </div>
            <div className="ml-5 space-y-0.5 text-gray-600 dark:text-gray-400">
              <div>
                <span className="text-gray-500">Envoyé :</span>{' '}
                <span className="font-mono">{transformedValue}</span>
              </div>
              {zohoPreview !== transformedValue && (
                <div>
                  <span className="text-gray-500">Sera affiché :</span>{' '}
                  <span className="font-mono text-purple-600 dark:text-purple-400">
                    {zohoPreview}
                  </span>
                </div>
              )}
              {zohoReferenceValue !== undefined && (
                <div>
                  <span className="text-gray-500">Exemple existant :</span>{' '}
                  <span className="font-mono text-purple-500">
                    {String(zohoReferenceValue)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
  rawCellData,
  fileType,
  onBack,
  onConfirm,
}: StepTransformPreviewProps) {
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [sampleCount, setSampleCount] = useState(5);
  const [expandedCells, setExpandedCells] = useState<AccordionRowState>({});

  const isExcelFile = fileType === 'xlsx' || fileType === 'xls';
  const hasRawData = isExcelFile && rawCellData && Object.keys(rawCellData).length > 0;

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

  // Toggle accordéon
  const toggleCell = (rowIndex: number, columnName: string) => {
    const key = `${rowIndex}-${columnName}`;
    setExpandedCells(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Expand/Collapse all
  const expandAll = () => {
    const newState: AccordionRowState = {};
    sampleData.forEach((_, rowIndex) => {
      displayColumns.forEach(col => {
        newState[`${rowIndex}-${col.fileColumn}`] = true;
      });
    });
    setExpandedCells(newState);
  };

  const collapseAll = () => {
    setExpandedCells({});
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Aperçu des transformations
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Vérifiez comment vos données seront transformées avant l'import dans Zoho
          {hasRawData && (
            <span className="ml-1 text-purple-600 dark:text-purple-400">
              • Cliquez sur une cellule pour voir les détails Excel
            </span>
          )}
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
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
            Toutes ({mappedColumns.length})
          </Button>
          
          {hasRawData && (
            <>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={expandAll}
              >
                Tout déplier
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={collapseAll}
              >
                Tout replier
              </Button>
            </>
          )}
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
                      <th key={col.fileColumn} className="px-3 py-2 text-left min-w-[220px]">
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
                      <td className="px-3 py-2 text-gray-400 text-xs align-top">
                        {rowIndex + 1}
                      </td>
                     {displayColumns.map((col) => {
                        const sourceValue = row[col.fileColumn] ?? '';
                        const transformedValue = applyTransformation(String(sourceValue), col.transformNeeded);
                        const zohoPreview = predictZohoDisplay(transformedValue, col.zohoType);
                        const rawCell = rawCellData?.[rowIndex]?.[col.fileColumn];
                        const isExpanded = expandedCells[`${rowIndex}-${col.fileColumn}`] || false;

                        return (
                          <td key={col.fileColumn} className="px-3 py-2 align-top">
                            <CellDetailAccordion
                              columnName={col.fileColumn}
                              rowIndex={rowIndex}
                              sourceValue={sourceValue}
                              transformedValue={transformedValue}
                              zohoPreview={zohoPreview}
                              zohoType={col.zohoType}
                              zohoReferenceValue={zohoReferenceRow?.[col.zohoColumn ?? '']}
                              rawCell={rawCell}
                              isExpanded={isExpanded}
                              onToggle={() => toggleCell(rowIndex, col.fileColumn)}
                            />
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
            <li><span className="mr-2">📄</span><strong>Source</strong> : Valeur dans votre fichier</li>
            <li><span className="mr-2">→</span><strong>Transformé</strong> : Valeur après transformation (si différente)</li>
            {hasRawData && (
              <li><span className="mr-2">🔍</span><strong>Détails</strong> : Cliquez pour voir les infos Excel (v, z, w)</li>
            )}
          </ul>
          {hasRawData && (
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
              💡 Les fichiers Excel ont des métadonnées supplémentaires. Cliquez sur une cellule pour comprendre exactement comment elle est transformée.
            </p>
          )}
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
