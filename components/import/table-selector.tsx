// components/import/table-selector.tsx
'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, Search, Table2, Loader2 } from 'lucide-react';
import type { ZohoTable } from '@/types';

interface TableSelectorProps {
  tables: ZohoTable[];
  selectedTableId: string | null;
  onSelect: (tableId: string, tableName: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function TableSelector({
  tables,
  selectedTableId,
  onSelect,
  isLoading = false,
  disabled = false,
}: TableSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedTable = useMemo(
    () => tables.find((t) => t.viewId === selectedTableId),
    [tables, selectedTableId]
  );

  const filteredTables = useMemo(() => {
    if (!searchQuery) return tables;
    const query = searchQuery.toLowerCase();
    return tables.filter(
      (t) =>
        t.viewName.toLowerCase().includes(query) ||
        t.viewName.toLowerCase().includes(query)
    );
  }, [tables, searchQuery]);

  const handleSelect = (table: ZohoTable) => {
    onSelect(table.viewId, table.viewName || table.viewName);
    setIsOpen(false);
    setSearchQuery('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        <span className="text-gray-500 dark:text-gray-400">Chargement des tables...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2 p-3
          bg-white dark:bg-gray-800 rounded-lg
          border border-gray-300 dark:border-gray-600
          text-left transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 dark:hover:border-blue-500'}
          ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Table2 className="h-5 w-5 shrink-0 text-gray-400" />
          {selectedTable ? (
            <span className="truncate text-gray-900 dark:text-gray-100">
              {selectedTable.viewName || selectedTable.viewName}
            </span>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">Sélectionner une table...</span>
          )}
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-hidden">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher une table..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-60">
              {filteredTables.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  {searchQuery ? 'Aucune table trouvée' : 'Aucune table disponible'}
                </div>
              ) : (
                <ul className="py-1">
                  {filteredTables.map((table) => (
                    <li key={table.viewId}>
                      <button
                        type="button"
                        onClick={() => handleSelect(table)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                          ${
                            table.viewId === selectedTableId
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }
                        `}
                      >
                        <Table2 className="h-4 w-4 shrink-0 opacity-50" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{table.viewName || table.viewName}</p>
                          {table.viewName && table.viewName !== table.viewName && (
                            <p className="text-xs text-gray-500 truncate">{table.viewName}</p>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
