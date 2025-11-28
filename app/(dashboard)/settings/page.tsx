// app/(dashboard)/settings/page.tsx

import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Paramètres
      </h1>
      
      <div className="space-y-4">
        <Link
          href="/settings/rules"
          className="block bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
        >
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Règles de validation
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Configurer les règles de validation par table Zoho Analytics.
          </p>
        </Link>
        
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 opacity-50">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Connexion Zoho
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Gérer la connexion à votre compte Zoho Analytics.
          </p>
          <span className="text-sm text-gray-400 dark:text-gray-500">(Bientôt disponible)</span>
        </div>
        
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 opacity-50">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Connexion SFTP
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Configurer l&apos;accès au serveur SFTP.
          </p>
          <span className="text-sm text-gray-400 dark:text-gray-500">(Bientôt disponible)</span>
        </div>
      </div>
    </div>
  );
}
