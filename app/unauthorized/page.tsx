import Link from 'next/link';

export default function UnauthorizedPage() {
  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth-central-six.vercel.app';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md text-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Accès non autorisé
          </h1>

          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Vous n'avez pas accès à CSV Zoho Importer. 
            Contactez un administrateur pour obtenir l'accès.
          </p>

          <div className="space-y-3">
            
             <a  href={`${authUrl}/select-app`}
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Voir mes applications
            </a>

            
            <a  href={`${authUrl}/logout`}
              className="block w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Se déconnecter
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
