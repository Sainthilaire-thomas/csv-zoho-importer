/**
 * @file components/zoho/zoho-connection-status.tsx
 * @description Affiche le statut de connexion Zoho avec chargement automatique
 */

'use client';

import { useEffect, useState } from 'react';
import { ZohoConnectButton } from './zoho-connect-button';
import { Alert } from '@/components/ui/alert';

interface ConnectionStatus {
  isConnected: boolean;
  zohoEmail: string | null;
  expiresAt: string | null;
  needsReauthorization: boolean;
}

interface ZohoConnectionStatusProps {
  onStatusChange?: (status: ConnectionStatus) => void;
}

export function ZohoConnectionStatus({ onStatusChange }: ZohoConnectionStatusProps) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/zoho/oauth/status');
      
      if (!response.ok) {
        throw new Error('Erreur lors de la verification');
      }
      
      const data: ConnectionStatus = await response.json();
      setStatus(data);
      onStatusChange?.(data);
      
    } catch (err) {
      setError('Impossible de verifier la connexion Zoho');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        <span className="text-sm">Verification connexion Zoho...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="warning" title="Attention">
        {error}
      </Alert>
    );
  }

  if (status?.needsReauthorization) {
    return (
      <div className="space-y-2">
        <Alert variant="warning" title="Reconnexion necessaire">
          Votre session Zoho a expire. Veuillez vous reconnecter.
        </Alert>
        <ZohoConnectButton 
          isConnected={false} 
          onDisconnect={checkStatus}
        />
      </div>
    );
  }

  return (
    <ZohoConnectButton 
      isConnected={status?.isConnected || false}
      zohoEmail={status?.zohoEmail}
      onDisconnect={checkStatus}
    />
  );
}
