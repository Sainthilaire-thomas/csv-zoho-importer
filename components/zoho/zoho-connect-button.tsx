/**
 * @file components/zoho/zoho-connect-button.tsx
 * @description Bouton pour connecter/deconnecter Zoho
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ZohoConnectButtonProps {
  isConnected: boolean;
  zohoEmail?: string | null;
  onDisconnect?: () => void;
}

export function ZohoConnectButton({ 
  isConnected, 
  zohoEmail,
  onDisconnect 
}: ZohoConnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = () => {
    setIsLoading(true);
    // Rediriger vers le flow OAuth
    window.location.href = '/api/zoho/oauth/authorize';
  };

  const handleDisconnect = async () => {
    if (!confirm('Voulez-vous vraiment deconnecter votre compte Zoho ?')) {
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/zoho/oauth/disconnect', {
        method: 'POST',
      });
      
      if (response.ok) {
        onDisconnect?.();
        window.location.reload();
      }
    } catch (error) {
      console.error('Erreur deconnexion:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Connecte {zohoEmail ? `(${zohoEmail})` : 'a Zoho'}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          isLoading={isLoading}
        >
          Deconnecter
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={handleConnect}
      isLoading={isLoading}
      className="bg-orange-500 hover:bg-orange-600 text-white"
    >
      <svg 
        className="w-5 h-5 mr-2" 
        viewBox="0 0 24 24" 
        fill="currentColor"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
      Connecter a Zoho Analytics
    </Button>
  );
}
