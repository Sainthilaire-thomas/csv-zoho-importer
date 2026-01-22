// ============================================
// @file app/(dashboard)/history/page.tsx
// Page Historique des imports
// Mission 013
// ============================================

import { ImportList } from '@/components/history';

export default function HistoryPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Historique des imports
      </h1>
      
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6">
        <ImportList />
      </div>
    </div>
  );
}
