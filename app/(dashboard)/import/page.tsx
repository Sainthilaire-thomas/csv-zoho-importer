// app/(dashboard)/import/page.tsx
import { ImportPageClient } from './import-page-client';

export const metadata = {
  title: 'Import CSV | CSV to Zoho Analytics',
  description: 'Importez vos fichiers CSV dans Zoho Analytics',
};

export default function ImportPage() {
  return <ImportPageClient />;
}
