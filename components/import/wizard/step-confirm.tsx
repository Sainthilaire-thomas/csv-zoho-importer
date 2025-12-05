// components/import/wizard/step-confirm.tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Clock, 
  FileSpreadsheet, 
  RotateCcw, 
  ExternalLink,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Key,
  ArrowRight,
} from 'lucide-react';
import { useState } from 'react';
import type { ImportResult } from '@/types';
import type { Anomaly, ComparedRow, ComparedColumn, AnomalyType } from '@/lib/domain/verification';

interface StepConfirmProps {
  result: ImportResult;
  tableName: string;
  onNewImport: () => void;
}

export function StepConfirm({
  result,
  tableName,
  onNewImport,
}: StepConfirmProps) {
  const [showAnomalyDetails, setShowAnomalyDetails] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  
  const verification = result.verification;
  const hasVerification = verification?.performed;
  const hasAnomalies = (verification?.anomalies?.length ?? 0) > 0;

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Card variant="bordered" padding="lg">
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8">
          {/* Success icon */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-pulse" />
            <div className="relative p-6 bg-green-100 dark:bg-green-900/50 rounded-full">
              <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Import réussi !
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-8">
            Vos données ont été importées dans{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {tableName}
            </span>
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-8">
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <FileSpreadsheet className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {result.rowsImported.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  lignes importées
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Clock className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatDuration(result.duration)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  durée totale
                </p>
              </div>
            </div>
          </div>

          {/* ==================== VERIFICATION SECTION ==================== */}
          {hasVerification && verification && (
            <div className="w-full max-w-4xl mb-8">
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Vérification post-import
                </h4>

                {/* Résultat vérification */}
                {!hasAnomalies ? (
                  <VerificationSuccess 
                    verification={verification}
                    selectedRowIndex={selectedRowIndex}
                    onSelectRow={setSelectedRowIndex}
                  />
                ) : (
                  <VerificationWithAnomalies
                    verification={verification}
                    showDetails={showAnomalyDetails}
                    onToggleDetails={() => setShowAnomalyDetails(!showAnomalyDetails)}
                    selectedRowIndex={selectedRowIndex}
                    onSelectRow={setSelectedRowIndex}
                  />
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="primary"
              onClick={onNewImport}
              leftIcon={<RotateCcw className="h-4 w-4" />}
            >
              Nouvel import
            </Button>

            <a
              href="https://analytics.zoho.eu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors duration-200"
            >
              Ouvrir Zoho Analytics
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== SUB-COMPONENTS ====================

function VerificationSuccess({ 
  verification,
  selectedRowIndex,
  onSelectRow,
}: { 
  verification: NonNullable<ImportResult['verification']>;
  selectedRowIndex: number | null;
  onSelectRow: (index: number | null) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const { checkedRows, duration, matchingColumn, comparedRows } = verification;

  return (
    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-green-800 dark:text-green-200">
              Intégrité des données confirmée
            </p>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              {checkedRows} lignes vérifiées • Aucune anomalie détectée
            </p>
            
            {/* Colonne de matching */}
            {matchingColumn && (
              <div className="mt-2 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <Key className="h-3 w-3" />
                <span>Colonne de matching :</span>
                <code className="bg-green-100 dark:bg-green-900 px-1.5 py-0.5 rounded font-mono">
                  {matchingColumn}
                </code>
                <span className="text-green-500">(auto-détectée)</span>
              </div>
            )}
            
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
              Vérification en {duration}ms
            </p>
          </div>
        </div>
      </div>

      {/* Bouton voir détails */}
      {comparedRows && comparedRows.length > 0 && (
        <>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full px-4 py-2 text-sm font-medium flex items-center justify-center gap-1 border-t border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          >
            {showDetails ? (
              <>
                Masquer les détails
                <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                Voir les données comparées
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </button>

          {showDetails && (
            <div className="border-t border-green-200 dark:border-green-800 p-4 bg-white dark:bg-gray-900">
              {/* Sélecteur de lignes */}
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Sélectionnez une ligne pour voir le détail complet :
                </p>
                <div className="flex gap-2 flex-wrap">
                  {comparedRows.map((row: ComparedRow) => (
                    <button
                      key={row.rowIndex}
                      onClick={() => onSelectRow(selectedRowIndex === row.rowIndex ? null : row.rowIndex)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        selectedRowIndex === row.rowIndex
                          ? 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200'
                          : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300'
                      }`}
                    >
                      Ligne {row.rowIndex}
                      <CheckCircle2 className="w-3 h-3 inline ml-1" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Détail de la ligne sélectionnée */}
              {selectedRowIndex !== null && comparedRows && (
                <ComparedRowDetail 
                  row={comparedRows.find((r: ComparedRow) => r.rowIndex === selectedRowIndex)!}
                  matchingColumn={matchingColumn}
                />
              )}

              {/* Résumé si aucune ligne sélectionnée */}
              {selectedRowIndex === null && (
                <ComparisonSummaryTable 
                  rows={comparedRows} 
                  matchingColumn={matchingColumn}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VerificationWithAnomalies({
  verification,
  showDetails,
  onToggleDetails,
  selectedRowIndex,
  onSelectRow,
}: {
  verification: NonNullable<ImportResult['verification']>;
  showDetails: boolean;
  onToggleDetails: () => void;
  selectedRowIndex: number | null;
  onSelectRow: (index: number | null) => void;
}) {
  const { summary, anomalies, checkedRows, matchedRows, matchingColumn, comparedRows } = verification;
  const hasCritical = summary.critical > 0;

  return (
    <div className={`border rounded-lg overflow-hidden ${
      hasCritical 
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
    }`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {hasCritical ? (
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          )}
          <div className="flex-1">
            <p className={`font-medium ${
              hasCritical 
                ? 'text-red-800 dark:text-red-200' 
                : 'text-yellow-800 dark:text-yellow-200'
            }`}>
              {hasCritical ? 'Anomalies détectées' : 'Avertissements'}
            </p>
            <p className={`text-sm mt-1 ${
              hasCritical 
                ? 'text-red-700 dark:text-red-300' 
                : 'text-yellow-700 dark:text-yellow-300'
            }`}>
              {checkedRows} lignes vérifiées • {matchedRows} trouvées dans Zoho
            </p>
            
            {/* Colonne de matching */}
            {matchingColumn && (
              <div className={`mt-2 flex items-center gap-2 text-xs ${
                hasCritical ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
              }`}>
                <Key className="h-3 w-3" />
                <span>Colonne de matching :</span>
                <code className={`px-1.5 py-0.5 rounded font-mono ${
                  hasCritical 
                    ? 'bg-red-100 dark:bg-red-900' 
                    : 'bg-yellow-100 dark:bg-yellow-900'
                }`}>
                  {matchingColumn}
                </code>
                <span className={hasCritical ? 'text-red-500' : 'text-yellow-500'}>
                  (auto-détectée)
                </span>
              </div>
            )}
            
            {/* Badges résumé */}
            <div className="flex gap-2 mt-3">
              {summary.critical > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  <XCircle className="h-3 w-3" />
                  {summary.critical} critique{summary.critical > 1 ? 's' : ''}
                </span>
              )}
              {summary.warning > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  <AlertTriangle className="h-3 w-3" />
                  {summary.warning} avertissement{summary.warning > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toggle details */}
      <button
        onClick={onToggleDetails}
        className={`w-full px-4 py-2 text-sm font-medium flex items-center justify-center gap-1 border-t ${
          hasCritical 
            ? 'border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30' 
            : 'border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
        } transition-colors`}
      >
        {showDetails ? (
          <>
            Masquer les détails
            <ChevronUp className="h-4 w-4" />
          </>
        ) : (
          <>
            Voir les détails
            <ChevronDown className="h-4 w-4" />
          </>
        )}
      </button>

      {/* Details */}
      {showDetails && (
        <div className={`border-t ${
          hasCritical 
            ? 'border-red-200 dark:border-red-800' 
            : 'border-yellow-200 dark:border-yellow-800'
        }`}>
          {/* Sélecteur de lignes */}
          {comparedRows && comparedRows.length > 0 && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Sélectionnez une ligne pour voir le détail complet :
              </p>
              <div className="flex gap-2 flex-wrap">
                {comparedRows.map((row: ComparedRow) => {
                  const rowAnomalies = row.columns.filter((c: ComparedColumn) => !c.match && (c.sentValue || c.receivedValue)).length;
                  return (
                    <button
                      key={row.rowIndex}
                      onClick={() => onSelectRow(selectedRowIndex === row.rowIndex ? null : row.rowIndex)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        selectedRowIndex === row.rowIndex
                          ? 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200'
                          : row.found
                          ? rowAnomalies > 0
                            ? 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-300'
                            : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300'
                          : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300'
                      }`}
                    >
                      Ligne {row.rowIndex}
                      {row.found ? (
                        rowAnomalies > 0 ? (
                          <AlertTriangle className="w-3 h-3 inline ml-1" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 inline ml-1" />
                        )
                      ) : (
                        <XCircle className="w-3 h-3 inline ml-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Détail de la ligne sélectionnée */}
          {selectedRowIndex !== null && comparedRows && (
            <div className="p-4 bg-white dark:bg-gray-900">
              <ComparedRowDetail 
                row={comparedRows.find((r: ComparedRow) => r.rowIndex === selectedRowIndex)!}
                matchingColumn={matchingColumn}
              />
            </div>
          )}

          {/* Liste des anomalies si aucune ligne sélectionnée */}
          {selectedRowIndex === null && (
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Liste des anomalies :
              </p>
              {anomalies.map((anomaly, index) => (
                <AnomalyItem key={index} anomaly={anomaly} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Tableau résumé des lignes comparées
 */
function ComparisonSummaryTable({ 
  rows, 
  matchingColumn 
}: { 
  rows: ComparedRow[]; 
  matchingColumn?: string;
}) {
  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
      <table className="w-full text-xs">
        <thead className="bg-gray-100 dark:bg-gray-800">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Ligne</th>
            {matchingColumn && (
              <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                🔑 {matchingColumn}
              </th>
            )}
            <th className="px-3 py-2 text-center font-medium text-gray-700 dark:text-gray-300">Trouvée</th>
            <th className="px-3 py-2 text-center font-medium text-gray-700 dark:text-gray-300">Colonnes OK</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row: ComparedRow) => {
            const totalCols = row.columns.filter((c: ComparedColumn) => c.sentValue || c.receivedValue).length;
            const matchingCols = row.columns.filter((c: ComparedColumn) => c.match).length;
            return (
              <tr key={row.rowIndex}>
                <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">
                  {row.rowIndex}
                </td>
                {matchingColumn && (
                  <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">
                    {row.matchingValue}
                  </td>
                )}
                <td className="px-3 py-2 text-center">
                  {row.found ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 inline" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 inline" />
                  )}
                </td>
                <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">
                  {matchingCols}/{totalCols}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Détail d'une ligne avec les 3 colonnes : Fichier / Normalisée / Zoho
 */
function ComparedRowDetail({ 
  row, 
  matchingColumn 
}: { 
  row: ComparedRow; 
  matchingColumn?: string;
}) {
  if (!row.found) {
    return (
      <div className="bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200 font-medium">
          Ligne {row.rowIndex} non trouvée dans Zoho
        </p>
        {matchingColumn && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            Valeur recherchée pour &quot;{matchingColumn}&quot; : 
            <code className="bg-red-200 dark:bg-red-800 px-1 rounded ml-1">{row.matchingValue}</code>
          </p>
        )}
      </div>
    );
  }

  // Filtrer pour n'afficher que les colonnes avec des valeurs
  const relevantColumns = row.columns.filter(
    (col: ComparedColumn) => col.sentValue || col.receivedValue
  );

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Ligne {row.rowIndex}
          {matchingColumn && (
            <span className="ml-2 text-gray-500 dark:text-gray-400">
              — Clé : <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">{row.matchingValue}</code>
            </span>
          )}
        </p>
      </div>

      {/* Légende des colonnes */}
      <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-xs">
        <div className="flex items-center gap-4 text-blue-700 dark:text-blue-300">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-200 dark:bg-amber-800"></span>
            Fichier (valeur brute)
          </span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-200 dark:bg-blue-800"></span>
            Normalisée (pour comparaison)
          </span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-200 dark:bg-green-800"></span>
            Dans Zoho (après import)
          </span>
        </div>
      </div>

      {/* Tableau des données */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 w-40">
                Colonne
              </th>
              <th className="px-3 py-2 text-left font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20">
                📄 Fichier
              </th>
              <th className="px-3 py-2 text-left font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">
                🔄 Normalisée
              </th>
              <th className="px-3 py-2 text-left font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20">
                ☁️ Zoho
              </th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-400 w-24">
                Statut
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {relevantColumns.map((col: ComparedColumn) => {
              const hasChange = col.sentValue !== col.normalizedValue;
              const zohoChanged = col.normalizedValue.toLowerCase() !== col.receivedValue.toLowerCase();
              
              return (
                <tr key={col.name} className={col.match ? '' : 'bg-red-50 dark:bg-red-900/10'}>
                  <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {col.name}
                  </td>
                  <td className={`px-3 py-2 font-mono bg-amber-50/50 dark:bg-amber-900/10 ${
                    hasChange ? 'text-amber-700 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {col.sentValue || <span className="text-gray-400 italic">vide</span>}
                  </td>
                  <td className={`px-3 py-2 font-mono bg-blue-50/50 dark:bg-blue-900/10 ${
                    hasChange ? 'text-blue-700 dark:text-blue-400 font-semibold' : 'text-gray-500 dark:text-gray-500'
                  }`}>
                    {col.normalizedValue || <span className="text-gray-400 italic">vide</span>}
                    {hasChange && <span className="ml-1 text-blue-500">*</span>}
                  </td>
                  <td className={`px-3 py-2 font-mono bg-green-50/50 dark:bg-green-900/10 ${
                    zohoChanged ? 'text-green-700 dark:text-green-400 font-semibold' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {col.receivedValue || <span className="text-gray-400 italic">vide</span>}
                    {zohoChanged && col.match && <span className="ml-1 text-green-500">≈</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {col.match ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 inline" />
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <XCircle className="w-4 h-4 text-red-500" />
                        {col.anomalyType && <AnomalyBadge type={col.anomalyType} />}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Légende en bas */}
      <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        <span className="text-blue-500">*</span> = Valeur modifiée par normalisation
        <span className="mx-3">|</span>
        <span className="text-green-500">≈</span> = Valeur équivalente après normalisation
      </div>
    </div>
  );
}

function AnomalyItem({ anomaly }: { anomaly: Anomaly }) {
  const isCritical = anomaly.level === 'critical';

  return (
    <div className={`text-sm rounded p-3 ${
      isCritical 
        ? 'bg-red-100 dark:bg-red-900/40' 
        : 'bg-yellow-100 dark:bg-yellow-900/40'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        {isCritical ? (
          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        )}
        <span className={`font-medium ${
          isCritical 
            ? 'text-red-800 dark:text-red-200' 
            : 'text-yellow-800 dark:text-yellow-200'
        }`}>
          Ligne {anomaly.rowIndex}
          {anomaly.column && <>, colonne &quot;{anomaly.column}&quot;</>}
        </span>
        {anomaly.type && <AnomalyBadge type={anomaly.type} />}
      </div>
      <p className={`ml-6 ${
        isCritical 
          ? 'text-red-700 dark:text-red-300' 
          : 'text-yellow-700 dark:text-yellow-300'
      }`}>
        {anomaly.message}
      </p>
      {(anomaly.sentValue || anomaly.receivedValue) && (
        <div className="ml-6 mt-2 p-2 bg-white/50 dark:bg-gray-900/50 rounded text-xs font-mono grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-500 block mb-1">Envoyé :</span>
            <span className={isCritical ? 'text-red-600' : 'text-yellow-600'}>
              {anomaly.sentValue || <span className="italic text-gray-400">vide</span>}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">Dans Zoho :</span>
            <span className={isCritical ? 'text-red-600' : 'text-yellow-600'}>
              {anomaly.receivedValue || <span className="italic text-gray-400">vide</span>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function AnomalyBadge({ type }: { type: AnomalyType }) {
  const labels: Record<AnomalyType, string> = {
    value_different: 'Différent',
    value_missing: 'Manquant',
    row_missing: 'Absent',
    date_inverted: 'Date inversée',
    truncated: 'Tronqué',
    rounded: 'Arrondi',
    encoding_issue: 'Encodage',
  };

  const colors: Record<AnomalyType, string> = {
    value_different: 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200',
    value_missing: 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200',
    row_missing: 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200',
    date_inverted: 'bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200',
    truncated: 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200',
    rounded: 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200',
    encoding_issue: 'bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200',
  };

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[type]}`}>
      {labels[type]}
    </span>
  );
}
