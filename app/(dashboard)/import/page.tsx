// app/(dashboard)/import/page.tsx
import { Suspense } from 'react';
import { ImportPageClient } from './import-page-client';

export const metadata = {
  title: 'Import CSV | CSV to Zoho Analytics',
  description: 'Importez vos fichiers CSV dans Zoho Analytics',
};

function ImportPageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={<ImportPageLoading />}>
      <ImportPageClient />
    </Suspense>
  );
}
