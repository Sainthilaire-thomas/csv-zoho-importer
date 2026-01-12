/**
 * @file components/import/wizard/verification-report.tsx
 * @description Composant d'affichage du rapport de vérification post-import
 * 
 * Affiche :
 * - La colonne de matching utilisée
 * - Un résumé du résultat
 * - Un tableau comparatif détaillé (envoyé vs reçu)
 */

'use client';

import { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp,
  Search,
  ArrowRight,
} from 'lucide-react';
import type { VerificationResult, ComparedRow, ComparedColumn, AnomalyType } from '@/lib/domain/verification/types';

interface VerificationReportProps {
  result: VerificationResult;
}

export function VerificationReport({ result }: VerificationReportProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  if (!result.performed) {
    return null;
  }

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
        <Search className="w-4 h-4" />
        VÉRIFICATION POST-IMPORT
      </h3>

      {/* Résumé principal */}
      <VerificationSummary result={result} />

      {/* Info colonne de matching */}
      {result.matchingColumn && (
        <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          <span className="font-medium">Colonne de matching :</span>{' '}
          <code className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-700">
            {result.matchingColumn}
          </code>
          <span className="text-gray-400 ml-2">(auto-détectée)</span>
        </div>
      )}

      {/* Bouton détails */}
      {result.comparedRows && result.comparedRows.length > 0 && (
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mt-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
        >
          {showDetails ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Masquer les détails
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Voir les détails ({result.checkedRows} lignes vérifiées)
            </>
          )}
        </button>
      )}

      {/* Tableau comparatif */}
      {showDetails && result.comparedRows && (
        <div className="mt-4 space-y-4">
          {/* Sélecteur de ligne */}
          <div className="flex gap-2 flex-wrap">
            {result.comparedRows.map((row) => (
              <button
                key={row.rowIndex}
                onClick={() => setSelectedRow(selectedRow === row.rowIndex ? null : row.rowIndex)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  selectedRow === row.rowIndex
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : row.found
                    ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                    : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                }`}
              >
                Ligne {row.rowIndex}
                {row.found ? (
                  <CheckCircle2 className="w-3 h-3 inline ml-1" />
                ) : (
                  <XCircle className="w-3 h-3 inline ml-1" />
                )}
              </button>
            ))}
          </div>

          {/* Détail de la ligne sélectionnée */}
          {selectedRow !== null && (
            <ComparedRowDetail 
              row={result.comparedRows.find(r => r.rowIndex === selectedRow)!}
              matchingColumn={result.matchingColumn}
            />
          )}

          {/* Vue tableau complet */}
          {selectedRow === null && (
            <ComparisonTable 
              rows={result.comparedRows} 
              matchingColumn={result.matchingColumn}
            />
          )}
        </div>
      )}

      {/* Durée */}
      <p className="mt-3 text-xs text-gray-400">
        Vérification en {(result.duration / 1000).toFixed(1)}s
      </p>
    </div>
  );
}

// ==================== SOUS-COMPOSANTS ====================

function VerificationSummary({ result }: { result: VerificationResult }) {
  if (result.success && result.anomalies.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
          <div>
            <p className="font-medium text-green-800">
              Intégrité des données confirmée
            </p>
            <p className="text-sm text-green-600 mt-1">
              {result.checkedRows} lignes vérifiées • {result.matchedRows} trouvées dans Zoho • Aucune anomalie
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasCritical = result.summary.critical > 0;

  return (
    <div className={`rounded-lg p-4 border ${
      hasCritical 
        ? 'bg-red-50 border-red-200' 
        : 'bg-yellow-50 border-yellow-200'
    }`}>
      <div className="flex items-start gap-3">
        {hasCritical ? (
          <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
        )}
        <div>
          <p className={`font-medium ${hasCritical ? 'text-red-800' : 'text-yellow-800'}`}>
            Anomalies détectées
          </p>
          <p className={`text-sm mt-1 ${hasCritical ? 'text-red-600' : 'text-yellow-600'}`}>
            {result.checkedRows} lignes vérifiées • {result.matchedRows} trouvées
          </p>
          <div className="flex gap-3 mt-2">
            {result.summary.critical > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                <XCircle className="w-3 h-3" />
                {result.summary.critical} critique{result.summary.critical > 1 ? 's' : ''}
              </span>
            )}
            {result.summary.warning > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                <AlertTriangle className="w-3 h-3" />
                {result.summary.warning} warning{result.summary.warning > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparedRowDetail({ row, matchingColumn }: { row: ComparedRow; matchingColumn?: string }) {
  if (!row.found) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-medium">
          Ligne {row.rowIndex} non trouvée dans Zoho
        </p>
        {matchingColumn && (
          <p className="text-sm text-red-600 mt-1">
            Valeur recherchée : <code className="bg-red-100 px-1 rounded">{row.matchingValue}</code>
          </p>
        )}
      </div>
    );
  }

  // Filtrer pour n'afficher que les colonnes avec des valeurs
  const relevantColumns = row.columns.filter(
    col => col.sentValue || col.receivedValue
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <p className="text-sm font-medium text-gray-700">
          Ligne {row.rowIndex} — {matchingColumn}: <code className="bg-gray-200 px-1 rounded">{row.matchingValue}</code>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Colonne</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Envoyé</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 w-8"></th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Dans Zoho</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 w-16">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {relevantColumns.map((col) => (
              <tr key={col.name} className={col.match ? '' : 'bg-red-50'}>
                <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                  {col.name}
                </td>
                <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate" title={col.sentValue}>
                  {col.sentValue || <span className="text-gray-400 italic">vide</span>}
                </td>
                <td className="px-3 py-2 text-center text-gray-400">
                  <ArrowRight className="w-3 h-3 inline" />
                </td>
                <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate" title={col.receivedValue}>
                  {col.receivedValue || <span className="text-gray-400 italic">vide</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  {col.match ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 inline" />
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <XCircle className="w-4 h-4 text-red-500" />
                      <AnomalyBadge type={col.anomalyType} />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComparisonTable({ rows, matchingColumn }: { rows: ComparedRow[]; matchingColumn?: string }) {
  // Trouver toutes les colonnes uniques
  const allColumns = new Set<string>();
  rows.forEach(row => {
    row.columns.forEach(col => {
      if (col.sentValue || col.receivedValue) {
        allColumns.add(col.name);
      }
    });
  });

  // Limiter à 5 colonnes pour la lisibilité
  const displayColumns = Array.from(allColumns).slice(0, 5);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Ligne</th>
              {matchingColumn && (
                <th className="px-3 py-2 text-left font-medium text-gray-600 bg-blue-50">
                  🔑 {matchingColumn}
                </th>
              )}
              <th className="px-3 py-2 text-center font-medium text-gray-600">Trouvée</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Anomalies</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const anomalyCount = row.columns.filter(c => !c.match && (c.sentValue || c.receivedValue)).length;
              return (
                <tr key={row.rowIndex} className={row.found ? '' : 'bg-red-50'}>
                  <td className="px-3 py-2 font-medium text-gray-700">
                    {row.rowIndex}
                  </td>
                  {matchingColumn && (
                    <td className="px-3 py-2 text-gray-600 bg-blue-50/50 font-mono text-xs">
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
                  <td className="px-3 py-2 text-center">
                    {row.found ? (
                      anomalyCount === 0 ? (
                        <span className="text-green-600">0</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          {anomalyCount}
                        </span>
                      )
                    ) : (
                      <span className="text-red-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-500">
        Cliquez sur une ligne ci-dessus pour voir le détail complet
      </div>
    </div>
  );
}

function AnomalyBadge({ type }: { type?: AnomalyType }) {
  if (!type) return null;

 const labels: Record<AnomalyType, string> = {
  value_different: 'Différent',
  value_missing: 'Manquant',
  row_missing: 'Ligne absente',
  date_inverted: 'Date inversée',
  datetime_truncated: 'Heure ignorée',
  spaces_trimmed: 'Espaces modifiés',
  truncated: 'Tronqué',
  rounded: 'Arrondi',
  encoding_issue: 'Encodage',
};
const colors: Record<AnomalyType, string> = {
  value_different: 'bg-red-100 text-red-700',
  value_missing: 'bg-red-100 text-red-700',
  row_missing: 'bg-red-100 text-red-700',
  date_inverted: 'bg-orange-100 text-orange-700',
  datetime_truncated: 'bg-blue-100 text-blue-700',
  spaces_trimmed: 'bg-blue-100 text-blue-700',
  truncated: 'bg-yellow-100 text-yellow-700',
  rounded: 'bg-yellow-100 text-yellow-700',
  encoding_issue: 'bg-purple-100 text-purple-700',
};

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[type]}`}>
      {labels[type]}
    </span>
  );
}
