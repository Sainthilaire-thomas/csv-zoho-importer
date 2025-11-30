// components/import/validation-results.tsx
'use client';

import { useState, useMemo } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import type { ValidationResult, ValidationError } from '@/types';

interface ValidationResultsProps {
  result: ValidationResult;
  maxErrorsToShow?: number;
}

export function ValidationResults({
  result,
  maxErrorsToShow = 100,
}: ValidationResultsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterColumn, setFilterColumn] = useState<string | null>(null);

  const errorColumns = useMemo(() => {
    const columns = new Set<string>();
    result.errors.forEach((err) => columns.add(err.column));
    return Array.from(columns).sort();
  }, [result.errors]);

  const filteredErrors = useMemo(() => {
    let errors = result.errors;

    if (filterColumn) {
      errors = errors.filter((err) => err.column === filterColumn);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      errors = errors.filter(
        (err) =>
          err.message.toLowerCase().includes(query) ||
          err.value.toLowerCase().includes(query) ||
          err.column.toLowerCase().includes(query) ||
          String(err.line).includes(query)
      );
    }

    return errors.slice(0, maxErrorsToShow);
  }, [result.errors, filterColumn, searchQuery, maxErrorsToShow]);

  const hasMoreErrors = result.errors.length > maxErrorsToShow;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          <div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              {result.validRows.toLocaleString()}
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">lignes valides</p>
          </div>
        </div>

        <div
          className={`
            flex items-center gap-3 p-4 rounded-lg border
            ${
              result.errorRows > 0
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }
          `}
        >
          <AlertCircle
            className={`h-8 w-8 ${result.errorRows > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}
          />
          <div>
            <p className={`text-2xl font-bold ${result.errorRows > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-500'}`}>
              {result.errorRows.toLocaleString()}
            </p>
            <p className={`text-sm ${result.errorRows > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>
              lignes avec erreurs
            </p>
          </div>
        </div>
      </div>

      {/* Success message */}
      {result.isValid && (
        <Alert variant="success" title="Validation réussie">
          Toutes les données sont conformes et prêtes à être importées.
        </Alert>
      )}

      {/* Error list */}
      {result.errorRows > 0 && (
        <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <span className="font-medium text-red-800 dark:text-red-200">
                Détail des erreurs ({result.errors.length})
              </span>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-red-600 dark:text-red-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
          </button>

          {isExpanded && (
            <>
              <div className="p-3 bg-white dark:bg-gray-800 border-b border-red-200 dark:border-red-800 flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {errorColumns.length > 1 && (
                  <select
                    value={filterColumn || ''}
                    onChange={(e) => setFilterColumn(e.target.value || null)}
                    className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Toutes les colonnes</option>
                    {errorColumns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Ligne</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Colonne</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Valeur</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Erreur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredErrors.map((error, index) => (
                      <ErrorRow key={`${error.line}-${error.column}-${index}`} error={error} />
                    ))}
                  </tbody>
                </table>
              </div>

              {hasMoreErrors && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 text-center text-sm text-gray-500">
                  Et {result.errors.length - maxErrorsToShow} autres erreurs...
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface ErrorRowProps {
  error: ValidationError;
}

function ErrorRow({ error }: ErrorRowProps) {
  const truncateValue = (value: string, maxLength: number = 30) => {
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength) + '...';
  };

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-mono">{error.line}</td>
      <td className="px-4 py-3">
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-mono text-xs">
          {error.column}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs max-w-[200px]">
        <span title={error.value} className="truncate block">
          {truncateValue(error.value) || <em className="text-gray-400">(vide)</em>}
        </span>
      </td>
      <td className="px-4 py-3 text-red-600 dark:text-red-400">{error.message}</td>
    </tr>
  );
}
