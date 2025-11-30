/**
 * @file app/(dashboard)/import/import-page-client.tsx
 * @description Page d'import avec gestion connexion Zoho
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ImportWizard } from '@/components/import/wizard';
import { ZohoConnectionStatus } from '@/components/zoho';
import { Alert } from '@/components/ui/alert';

export function ImportPageClient() {
  const searchParams = useSearchParams();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState<string | null>(null);
  const [isZohoConnected, setIsZohoConnected] = useState(false);

  useEffect(() => {
    // Verifier les parametres URL apres OAuth callback
    const zohoConnected = searchParams.get('zoho_connected');
    const error = searchParams.get('error');
    const message = searchParams.get('message');

    if (zohoConnected === 'true') {
      setShowSuccess(true);
      // Nettoyer l'URL
      window.history.replaceState({}, '', '/import');
      setTimeout(() => setShowSuccess(false), 5000);
    }

    if (error) {
      setShowError(message || 'Erreur de connexion Zoho');
      window.history.replaceState({}, '', '/import');
      setTimeout(() => setShowError(null), 10000);
    }
  }, [searchParams]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Importer un fichier CSV
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Suivez les etapes pour importer vos donnees dans Zoho Analytics
            </p>
          </div>
          <div className="flex-shrink-0">
            <ZohoConnectionStatus 
              onStatusChange={(status) => setIsZohoConnected(status.isConnected)}
            />
          </div>
        </div>
      </div>

      {/* Message de succes connexion */}
      {showSuccess && (
        <Alert variant="success" title="Connexion reussie" className="mb-6" dismissible onDismiss={() => setShowSuccess(false)}>
          Votre compte Zoho Analytics est maintenant connecte.
        </Alert>
      )}

      {/* Message d'erreur */}
      {showError && (
        <Alert variant="error" title="Erreur de connexion" className="mb-6" dismissible onDismiss={() => setShowError(null)}>
          {showError}
        </Alert>
      )}

      {/* Wizard d'import */}
      {!isZohoConnected ? (
        <Alert variant="info" title="Connexion requise">
          Veuillez connecter votre compte Zoho Analytics pour pouvoir importer des fichiers.
        </Alert>
      ) : (
        <ImportWizard />
      )}
    </div>
  );
}
