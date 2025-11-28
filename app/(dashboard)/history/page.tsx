// app/(dashboard)/history/page.tsx

export default function HistoryPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Historique des imports
      </h1>
      
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-8">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Aucun import pour le moment
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Vos imports apparaîtront ici une fois effectués.
          </p>
        </div>
      </div>
    </div>
  );
}
