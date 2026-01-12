// components/layout/sidebar.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Upload, History, Settings, BeakerIcon, FileText } from 'lucide-react';

const navigation = [
  { name: 'Import', href: '/import', icon: Upload },
  { name: 'Historique', href: '/history', icon: History },
  { name: 'Paramètres', href: '/settings', icon: Settings },
  { name: 'Test Dashboard', href: '/dashboard-test', icon: BeakerIcon },
  { name: 'PDF Config', href: '/pdf-config', icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          CSV → Zoho
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Analytics Importer</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-400 dark:text-gray-500">
          Version 0.1.0
        </div>
      </div>
    </div>
  );
}
