// ============================================
// @file components/history/import-list.tsx
// Liste des imports avec pagination et filtres
// Mission 013 + Mission 015 (UX améliorée)
// ============================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ImportCard } from './import-card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import type { ImportLog, ImportListResponse } from '@/types/imports';

interface ImportListProps {
  className?: string;
}

export function ImportList({ className = '' }: ImportListProps) {
  const [imports, setImports] = useState<ImportLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // ─────────────────────────────────────────────────────────────────────────
  // Mission 015 : Filtres
  // ─────────────────────────────────────────────────────────────────────────
  const [showRolledBack, setShowRolledBack] = useState(true);

  const LIMIT = 20;

  // Charger les imports
  const loadImports = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      // Construire l'URL avec les paramètres de filtre
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(offset),
        includeRolledBack: String(showRolledBack),
      });

      const response = await fetch(`/api/imports?${params}`);

      if (!response.ok) {
        throw new Error('Erreur lors du chargement');
      }

      const data: ImportListResponse = await response.json();

      if (append) {
        setImports(prev => [...prev, ...data.imports]);
      } else {
        setImports(data.imports);
      }

      setHasMore(data.hasMore);
      setTotal(data.total);

    } catch (err) {
      console.error('Erreur chargement imports:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [showRolledBack]);

  // Chargement initial et rechargement quand les filtres changent
  useEffect(() => {
    loadImports();
  }, [loadImports]);

  // Charger plus
  const handleLoadMore = () => {
    loadImports(imports.length, true);
  };

  // Rafraîchir
  const handleRefresh = () => {
    loadImports(0, false);
  };

  // Toggle affichage des imports annulés
  const handleToggleRolledBack = () => {
    setShowRolledBack(prev => !prev);
  };

  // Callback après rollback réussi
  const handleRollbackSuccess = () => {
    // Recharger la liste pour mettre à jour les statuts
    loadImports(0, false);
  };

  // Déterminer si un import est le dernier pour sa table
  const isLatestForTable = (importLog: ImportLog, index: number): boolean => {
    // Chercher s'il y a un import plus récent sur la même table qui n'est pas annulé
    const tableId = importLog.zoho_table_id;

    for (let i = 0; i < index; i++) {
      if (imports[i].zoho_table_id === tableId && !imports[i].rolled_back) {
        return false;
      }
    }

    return true;
  };

  // Compter les imports annulés dans la liste actuelle
  const rolledBackCount = imports.filter(imp => imp.rolled_back).length;

  // État de chargement initial
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // État d'erreur
  if (error) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-red-500 mb-4">{error}</p>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Réessayer
        </Button>
      </div>
    );
  }

  // État vide
  if (imports.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-6xl mb-4">📋</div>
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
          Aucun import pour le moment
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Vos imports apparaîtront ici une fois effectués.
        </p>
        {!showRolledBack && (
          <Button variant="outline" size="sm" onClick={handleToggleRolledBack}>
            <Eye className="h-4 w-4 mr-1" />
            Afficher les imports annulés
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header avec compteur, filtres et refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {total} import{total > 1 ? 's' : ''} au total
          {rolledBackCount > 0 && showRolledBack && (
            <span className="text-gray-400 dark:text-gray-500">
              {' '}(dont {rolledBackCount} annulé{rolledBackCount > 1 ? 's' : ''})
            </span>
          )}
        </p>

        <div className="flex items-center gap-2">
          {/* Toggle imports annulés */}
          <Button
            variant={showRolledBack ? 'outline' : 'ghost'}
            size="sm"
            onClick={handleToggleRolledBack}
            className={!showRolledBack ? 'text-gray-400' : ''}
          >
            {showRolledBack ? (
              <>
                <EyeOff className="h-4 w-4 mr-1" />
                Masquer annulés
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Voir annulés
              </>
            )}
          </Button>

          {/* Bouton refresh */}
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Liste des imports */}
      <div className="space-y-4">
        {imports.map((importLog, index) => (
          <ImportCard
            key={importLog.id}
            importLog={importLog}
            onRollbackSuccess={handleRollbackSuccess}
            isLatestForTable={isLatestForTable(importLog, index)}
          />
        ))}
      </div>

      {/* Bouton charger plus */}
      {hasMore && (
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Chargement...
              </>
            ) : (
              'Charger plus'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
