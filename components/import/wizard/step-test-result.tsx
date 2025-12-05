/**
 * @file components/import/wizard/step-test-result.tsx
 * @description Résultat du test d'import - Affiche la comparaison détaillée des données
 */

'use client';

import { useState } from 'react';
import {
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertCircle,
  Loader2,
  ArrowRight,
  Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import type { VerificationResult, ComparedRow, ComparedColumn, Anomaly, AnomalyType } from '@/lib/domain/verification';
import type { RollbackResult } from '@/lib/domain/rollback';

interface StepTestResultProps {
  verificationResult: VerificationResult;
  sampleSize: number;
  remainingRows: number;
  matchingColumn: string;
  matchingValues: string[];
  onConfirmFullImport: () => void;
  onRollbackAndFix: () => Promise<RollbackResult>;
  onForceImport: () => void;
  className?: string;
}

export function StepTestResult({
  verificationResult,
  sampleSize,
  remainingRows,
  matchingColumn,
  matchingValues,
  onConfirmFullImport,
  onRollbackAndFix,
  onForceImport,
  className = '',
}: StepTestResultProps) {
  const [showDetails, setShowDetails] = useState(true); // Ouvert par défaut
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackResult, setRollbackResult] = useState<RollbackResult | null>(null);

  const { success, checkedRows, matchedRows, anomalies, summary, duration, comparedRows } = verificationResult;
  const hasAnomalies = anomalies.length > 0;
  const criticalCount = summary?.critical || 0;
  const warningCount = summary?.warning || 0;

  const handleRollback = async () => {
    setIsRollingBack(true);
    try {
      const result = await onRollbackAndFix();
      setRollbackResult(result);
    } catch (error) {
      console.error('[TestResult] Rollback error:', error);
      setRollbackResult({
        success: false,
        deletedRows: 0,
        duration: 0,
        errorMessage: error instanceof Error ? error.message : 'Erreur lors du rollback',
        remainingValues: matchingValues,
      });
    } finally {
      setIsRollingBack(false);
    }
  };

  // Affichage après rollback réussi
  if (rollbackResult?.success) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold">Rollback effectué</h2>
          <p className="text-muted-foreground mt-1">
            {rollbackResult.deletedRows} lignes supprimées de Zoho.
            Vous pouvez maintenant corriger le profil et relancer l'import.
          </p>
        </div>
      </div>
    );
  }

  // Affichage échec rollback
  if (rollbackResult && !rollbackResult.success) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold">Échec du rollback</h2>
          <p className="text-muted-foreground mt-1">
            Impossible de supprimer les lignes de test.
          </p>
        </div>

        <Alert variant="error">
          <AlertCircle className="h-4 w-4" />
          <div className="ml-2">
            <p className="font-medium">{rollbackResult.errorMessage}</p>
            <p className="text-sm mt-1">
              Les {sampleSize} lignes de test sont toujours dans Zoho.
              Vous devrez les supprimer manuellement.
            </p>
          </div>
        </Alert>

        {rollbackResult.remainingValues && rollbackResult.remainingValues.length > 0 && (
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-medium mb-2">
              Valeurs à supprimer ({matchingColumn}) :
            </p>
            <div className="bg-muted rounded p-3 font-mono text-sm max-h-32 overflow-y-auto">
              {rollbackResult.remainingValues.map((val, i) => (
                <div key={i}>• {val}</div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                navigator.clipboard.writeText(rollbackResult.remainingValues!.join('\n'));
              }}
            >
              Copier les valeurs
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header - Succès ou Anomalies */}
      <div className="text-center">
        {success ? (
          <>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-green-700 dark:text-green-400">
              Test réussi !
            </h2>
            <p className="text-muted-foreground mt-1">
              {checkedRows} lignes importées et vérifiées avec succès.
            </p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold text-amber-700 dark:text-amber-400">
              Anomalies détectées
            </h2>
            <p className="text-muted-foreground mt-1">
              Le test a révélé des problèmes sur {anomalies.length} élément(s).
            </p>
          </>
        )}
      </div>

      {/* Résumé compact */}
      <div className="rounded-lg border bg-card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold">{checkedRows}</div>
            <div className="text-muted-foreground text-xs">Lignes testées</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{matchedRows}</div>
            <div className="text-muted-foreground text-xs">Trouvées dans Zoho</div>
          </div>
          {criticalCount > 0 && (
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
              <div className="text-muted-foreground text-xs">Anomalies critiques</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-2xl font-bold text-muted-foreground">{duration}ms</div>
            <div className="text-muted-foreground text-xs">Durée vérification</div>
          </div>
        </div>

        {/* Colonne de matching */}
        {matchingColumn && (
          <div className="mt-3 pt-3 border-t flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Key className="h-3 w-3" />
            <span>Colonne de matching :</span>
            <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
              {matchingColumn}
            </code>
          </div>
        )}
      </div>

      {/* ==================== TABLEAU COMPARATIF ==================== */}
      {comparedRows && comparedRows.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors border-b"
          >
            <span className="font-medium flex items-center gap-2">
              📊 Comparaison détaillée des données
            </span>
            {showDetails ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          {showDetails && (
            <div className="p-4 space-y-4">
              {/* Sélecteur de lignes */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Sélectionnez une ligne pour voir le détail complet :
                </p>
                <div className="flex gap-2 flex-wrap">
                  {comparedRows.map((row: ComparedRow) => {
                    const rowAnomalies = row.columns.filter(
                      (c: ComparedColumn) => !c.match && (c.sentValue || c.receivedValue)
                    ).length;
                    const isSelected = selectedRowIndex === row.rowIndex;

                    return (
                      <button
                        key={row.rowIndex}
                        onClick={() => setSelectedRowIndex(isSelected ? null : row.rowIndex)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                          isSelected
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

              {/* Détail de la ligne sélectionnée */}
              {selectedRowIndex !== null && (
                <ComparedRowDetail
                  row={comparedRows.find((r: ComparedRow) => r.rowIndex === selectedRowIndex)!}
                  matchingColumn={matchingColumn}
                />
              )}

              {/* Tableau résumé si aucune ligne sélectionnée */}
              {selectedRowIndex === null && (
                <ComparisonSummaryTable
                  rows={comparedRows}
                  matchingColumn={matchingColumn}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Détail des anomalies (si présentes) */}
      {hasAnomalies && (
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <span className="font-medium">
              {criticalCount > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  🔴 {criticalCount} anomalie(s) critique(s)
                </span>
              )}
              {criticalCount > 0 && warningCount > 0 && ' • '}
              {warningCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  🟡 {warningCount} avertissement(s)
                </span>
              )}
            </span>
          </div>

          <div className="p-4 space-y-3 max-h-48 overflow-y-auto">
            {anomalies.map((anomaly, index) => (
              <AnomalyItem key={index} anomaly={anomaly} />
            ))}
          </div>
        </div>
      )}

      {/* Recommandation si anomalies */}
      {hasAnomalies && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <div className="ml-2">
            <p className="font-medium">Recommandation</p>
            <p className="text-sm mt-1">
              Annulez le test, corrigez le profil (format de date, longueur max, etc.),
              puis relancez l'import.
            </p>
          </div>
        </Alert>
      )}

      {/* Séparateur */}
      <div className="border-t" />

      {/* Actions */}
      {success ? (
        <div className="space-y-4">
          <p className="text-center text-muted-foreground">
            Voulez-vous importer les <strong>{remainingRows}</strong> lignes restantes ?
          </p>
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={handleRollback}
              disabled={isRollingBack}
            >
              {isRollingBack ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Annuler et rollback
            </Button>
            <Button onClick={onConfirmFullImport}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmer l'import
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center gap-3">
          <Button
            onClick={handleRollback}
            disabled={isRollingBack}
          >
            {isRollingBack ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Rollback + Corriger
          </Button>
          <Button
            variant="outline"
            onClick={onForceImport}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Forcer l'import quand même
          </Button>
        </div>
      )}
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

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
        <div className="flex items-center gap-4 text-blue-700 dark:text-blue-300 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-200 dark:bg-amber-800"></span>
            Fichier (valeur brute)
          </span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-200 dark:bg-blue-800"></span>
            Normalisée (envoyée)
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

/**
 * Élément d'anomalie
 */
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

/**
 * Badge pour le type d'anomalie
 */
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
