/**
 * @file components/import/table-selector-accordion.tsx
 * @description Sélecteur de tables Zoho avec vue en accordéon par dossier
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronDown, Table2, Database, FolderOpen, Folder, Search, Loader2 } from 'lucide-react';

// ==================== TYPES ====================

interface ZohoFolder {
  folderId: string;
  folderName: string;
  parentFolderId: string;
  isDefault?: boolean;
}

interface ZohoTable {
  id: string;
  name: string;
  displayName: string;
  workspaceId: string;
  type: string;
  folderId?: string;
}

interface FolderWithTables extends ZohoFolder {
  tables: ZohoTable[];
  subFolders: FolderWithTables[];
}

interface TableSelectorAccordionProps {
  workspaceId: string;
  selectedTableId: string | null;
  onTableSelect: (tableId: string, tableName: string) => void;
  disabled?: boolean;
}

// ==================== COMPOSANT PRINCIPAL ====================

export function TableSelectorAccordion({
  workspaceId,
  selectedTableId,
  onTableSelect,
  disabled = false,
}: TableSelectorAccordionProps) {
  const [folders, setFolders] = useState<ZohoFolder[]>([]);
  const [tables, setTables] = useState<ZohoTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');


 // Charger les dossiers et tables quand le workspace change
  useEffect(() => {
    if (!workspaceId) {
      setFolders([]);
      setTables([]);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Charger les dossiers et tables en parallèle
        const [foldersRes, tablesRes] = await Promise.all([
          fetch(`/api/zoho/folders?workspaceId=${workspaceId}`),
          fetch(`/api/zoho/tables?workspaceId=${workspaceId}`),
        ]);

        // Traiter les dossiers
        let loadedFolders: ZohoFolder[] = [];
        if (foldersRes.ok) {
          const foldersData = await foldersRes.json();
          loadedFolders = foldersData.folders || [];
          setFolders(loadedFolders);
          
          // Développer le dossier par défaut
          const defaultFolder = loadedFolders.find((f: ZohoFolder) => f.isDefault);
          if (defaultFolder) {
            setExpandedFolders(new Set([defaultFolder.folderId]));
          }
        } else {
          console.warn('API folders non disponible, utilisation du mode plat');
          setFolders([]);
        }

        // Traiter les tables
        if (!tablesRes.ok) {
          throw new Error('Erreur lors du chargement des tables');
        }
        const tablesData = await tablesRes.json();
        setTables(tablesData.tables || []);

      } catch (err) {
        console.error('Erreur chargement:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [workspaceId]);

  // Construire la structure hiérarchique
  const folderTree = useMemo(() => {
    if (folders.length === 0) {
      // Mode plat : pas de dossiers, juste une liste de tables
      return null;
    }

    // Créer un map des dossiers
    const folderMap = new Map<string, FolderWithTables>();
    folders.forEach(folder => {
      folderMap.set(folder.folderId, {
        ...folder,
        tables: [],
        subFolders: [],
      });
    });

    // Assigner les tables aux dossiers
    tables.forEach(table => {
      const folderId = table.folderId || '';
      const folder = folderMap.get(folderId);
      if (folder) {
        folder.tables.push(table);
      }
    });

    // Construire l'arbre (dossiers racine = parentFolderId === '-1' ou vide)
    const rootFolders: FolderWithTables[] = [];
    folderMap.forEach(folder => {
      if (folder.parentFolderId === '-1' || !folder.parentFolderId) {
        rootFolders.push(folder);
      } else {
        const parent = folderMap.get(folder.parentFolderId);
        if (parent) {
          parent.subFolders.push(folder);
        } else {
          // Parent non trouvé, mettre à la racine
          rootFolders.push(folder);
        }
      }
    });

    // Trier par nom
    const sortByName = (a: { folderName?: string; name?: string }, b: { folderName?: string; name?: string }) => {
      const nameA = a.folderName || a.name || '';
      const nameB = b.folderName || b.name || '';
      return nameA.localeCompare(nameB);
    };

    rootFolders.sort(sortByName);
    rootFolders.forEach(folder => {
      folder.subFolders.sort(sortByName);
      folder.tables.sort((a, b) => a.name.localeCompare(b.name));
    });

    return rootFolders;
  }, [folders, tables]);

  // Filtrer les tables par recherche
  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return tables;
    const query = searchQuery.toLowerCase();
    return tables.filter(t => 
      t.name.toLowerCase().includes(query) ||
      t.displayName.toLowerCase().includes(query)
    );
  }, [tables, searchQuery]);

  // Toggle un dossier
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Sélectionner une table
  const handleSelectTable = (table: ZohoTable) => {
    if (!disabled) {
      onTableSelect(table.id, table.name);
    }
  };

  // ==================== RENDU ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        Chargement des tables...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-400">
        Aucune table trouvée dans ce workspace.
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Barre de recherche */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une table..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Liste des tables */}
      <div className="max-h-80 overflow-y-auto">
        {searchQuery ? (
          // Mode recherche : liste plate
          <div className="p-2">
            {filteredTables.length === 0 ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                Aucune table ne correspond à "{searchQuery}"
              </div>
            ) : (
              filteredTables.map(table => (
                <TableItem
                  key={table.id}
                  table={table}
                  isSelected={selectedTableId === table.id}
                  onSelect={handleSelectTable}
                  disabled={disabled}
                />
              ))
            )}
          </div>
        ) : folderTree ? (
          // Mode accordéon avec dossiers
          <div className="p-2">
           {folderTree.map(folder => (
  <FolderItem
    key={folder.folderId}
    folder={folder}
    isExpanded={expandedFolders.has(folder.folderId)}
    expandedFolders={expandedFolders}
    onToggle={toggleFolder}
    selectedTableId={selectedTableId}
    onTableSelect={handleSelectTable}
    disabled={disabled}
    level={0}
  />
))}
          </div>
        ) : (
          // Mode plat sans dossiers
          <div className="p-2">
            {tables.map(table => (
              <TableItem
                key={table.id}
                table={table}
                isSelected={selectedTableId === table.id}
                onSelect={handleSelectTable}
                disabled={disabled}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer avec le nombre de tables */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400">
        {tables.length} table{tables.length > 1 ? 's' : ''} disponible{tables.length > 1 ? 's' : ''}
      </div>
    </div>
  );
}

// ==================== SOUS-COMPOSANTS ====================

interface FolderItemProps {
  folder: FolderWithTables;
  isExpanded: boolean;
  expandedFolders: Set<string>;  // AJOUTÉ
  onToggle: (folderId: string) => void;
  selectedTableId: string | null;
  onTableSelect: (table: ZohoTable) => void;
  disabled: boolean;
  level: number;
}

function FolderItem({
  folder,
  isExpanded,
  expandedFolders,
  onToggle,
  selectedTableId,
  onTableSelect,
  disabled,
  level,
}: FolderItemProps) {
  const hasContent = folder.tables.length > 0 || folder.subFolders.length > 0;
  const paddingLeft = level * 16;

  return (
    <div>
      {/* En-tête du dossier */}
      <button
        onClick={() => hasContent && onToggle(folder.folderId)}
        disabled={!hasContent}
        className={`
          w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm
          ${hasContent ? 'hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer' : 'opacity-50 cursor-default'}
          transition-colors
        `}
        style={{ paddingLeft: `${paddingLeft + 8}px` }}
      >
        {hasContent ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          )
        ) : (
          <span className="w-4" />
        )}
        
        {isExpanded ? (
          <FolderOpen className="w-4 h-4 text-yellow-500 shrink-0" />
        ) : (
          <Folder className="w-4 h-4 text-yellow-500 shrink-0" />
        )}
        
        <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
          {folder.folderName}
        </span>
        
        <span className="ml-auto text-xs text-gray-400">
          {folder.tables.length}
        </span>
      </button>

      {/* Contenu du dossier (si développé) */}
      {isExpanded && hasContent && (
        <div className="mt-1">
          {/* Sous-dossiers */}
        {folder.subFolders.map(subFolder => (
  <FolderItem
    key={subFolder.folderId}
    folder={subFolder}
    isExpanded={expandedFolders.has(subFolder.folderId)}
    expandedFolders={expandedFolders}
    onToggle={onToggle}
    selectedTableId={selectedTableId}
    onTableSelect={onTableSelect}
    disabled={disabled}
    level={level + 1}
  />
))}

          {/* Tables du dossier */}
          {folder.tables.map(table => (
            <TableItem
              key={table.id}
              table={table}
              isSelected={selectedTableId === table.id}
              onSelect={onTableSelect}
              disabled={disabled}
              indent={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TableItemProps {
  table: ZohoTable;
  isSelected: boolean;
  onSelect: (table: ZohoTable) => void;
  disabled: boolean;
  indent?: number;
}

function TableItem({ table, isSelected, onSelect, disabled, indent = 0 }: TableItemProps) {
  const paddingLeft = indent * 16 + 8;
  const isQueryTable = table.type?.toLowerCase() === 'querytable';

  return (
    <button
      onClick={() => onSelect(table)}
      disabled={disabled}
      className={`
        w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm
        transition-colors
        ${isSelected 
          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' 
          : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      style={{ paddingLeft: `${paddingLeft + 24}px` }}
    >
      {isQueryTable ? (
        <Database className="w-4 h-4 text-purple-500 shrink-0" />
      ) : (
        <Table2 className="w-4 h-4 text-blue-500 shrink-0" />
      )}
      
      <span className="truncate">{table.displayName || table.name}</span>
      
      {isQueryTable && (
        <span className="ml-auto text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded">
          Query
        </span>
      )}
    </button>
  );
}

export default TableSelectorAccordion;
