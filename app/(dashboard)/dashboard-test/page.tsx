/**
 * @file app/(dashboard)/dashboard-test/page.tsx
 * @description Page de test pour l'intégration iframe du dashboard PQS
 * 
 * Permet de :
 * 1. Saisir une adresse email
 * 2. Faire le lookup pour trouver le Cpte_Matriculaire
 * 3. Afficher le dashboard filtré dans une iframe
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface LookupResult {
  success: boolean;
  agent?: {
    nom: string;
    email: string;
    matricule: string;
    cpteMatriculaire: string;
  };
  embedUrl?: string;
  privateUrl?: string;
  error?: string;
}

export default function DashboardTestPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [showIframe, setShowIframe] = useState(false);

  const handleLookup = async () => {
    if (!email.trim()) {
      alert('Veuillez saisir une adresse email');
      return;
    }

    setLoading(true);
    setResult(null);
    setShowIframe(false);

    try {
      const response = await fetch('/api/zoho/dashboard-embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data: LookupResult = await response.json();
      setResult(data);

      if (data.success && data.embedUrl) {
        setShowIframe(true);
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'Erreur de connexion au serveur',
      });
    } finally {
      setLoading(false);
    }
  };

  // Liste d'emails de test (depuis la table Agents_SC)
  const testEmails = [
    'sandrine.auberger@ratp.fr',
    'naouelle.adesir@ratp.fr',
    'laurence.albouze@ratp.fr',
    'nicolas.alexandre@ratp.fr',
    'lyne.amiens@ratp.fr',
  ];

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-2xl font-bold mb-2">Test Dashboard PQS - Iframe</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Simulez l'intégration du dashboard dans Zoho Desk en testant avec différentes adresses email.
      </p>

      {/* Formulaire de test */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">1. Saisir l'email du conseiller</h2>
        
        <div className="flex gap-4 mb-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="exemple@ratp.fr"
            className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          />
          <Button onClick={handleLookup} disabled={loading}>
            {loading ? 'Recherche...' : 'Charger le dashboard'}
          </Button>
        </div>

        {/* Emails de test rapide */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-500">Emails de test :</span>
          {testEmails.map((testEmail) => (
            <button
              key={testEmail}
              onClick={() => setEmail(testEmail)}
              className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition"
            >
              {testEmail.split('@')[0]}
            </button>
          ))}
        </div>
      </Card>

      {/* Résultat du lookup */}
      {result && (
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">2. Résultat du lookup</h2>
          
          {result.success ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Nom :</span>
                  <span className="ml-2 font-medium">{result.agent?.nom}</span>
                </div>
                <div>
                  <span className="text-gray-500">Email :</span>
                  <span className="ml-2 font-medium">{result.agent?.email}</span>
                </div>
                <div>
                  <span className="text-gray-500">Matricule :</span>
                  <span className="ml-2 font-medium">{result.agent?.matricule}</span>
                </div>
                <div>
                  <span className="text-gray-500">Cpte Matriculaire :</span>
                  <span className="ml-2 font-medium text-green-600">{result.agent?.cpteMatriculaire}</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono break-all">
                <div className="text-gray-500 mb-1">URL avec filtre ZOHO_CRITERIA :</div>
                <a 
                  href={result.embedUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {result.embedUrl}
                </a>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-700 dark:text-red-400">
                ❌ {result.error || 'Agent non trouvé'}
              </p>
              <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                Vérifiez que l'email existe dans la table Agents_SC
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Iframe du dashboard */}
      {showIframe && result?.embedUrl && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">3. Dashboard PQS - {result.agent?.nom}</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(result.embedUrl, '_blank')}
              >
                Ouvrir en plein écran ↗
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowIframe(false)}
              >
                Fermer
              </Button>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden bg-white">
            <iframe
              src={result.embedUrl}
              width="100%"
              height="700"
              frameBorder="0"
              style={{ border: 'none' }}
              title={`Dashboard PQS - ${result.agent?.nom}`}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>

          <p className="text-xs text-gray-500 mt-3">
            💡 Cette iframe simule l'intégration dans le portail Zoho Desk. 
            Le filtrage se fait via le paramètre ZOHO_CRITERIA sur le Cpte_Matriculaire.
          </p>
        </Card>
      )}

      {/* Informations techniques */}
      <Card className="p-6 mt-6 bg-gray-50 dark:bg-gray-900">
        <h2 className="text-lg font-semibold mb-3">ℹ️ Informations techniques</h2>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p><strong>Workspace :</strong> RATP Réseaux de Bus (1718953000016707052)</p>
          <p><strong>Dashboard :</strong> Conseiller PQS 2025 (1718953000033028262)</p>
          <p><strong>Table lookup :</strong> Agents_SC (Courriel → Cpte_Matriculaire)</p>
          <p><strong>Filtre :</strong> ZOHO_CRITERIA=("Mle"='XX123456')</p>
        </div>
      </Card>
    </div>
  );
}
