// components/layout/header.tsx

'use client';

import { createClient } from '@/lib/infrastructure/supabase/client';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';

export function Header() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Tableau de bord
        </h2>
      </div>
      
      <div className="flex items-center gap-4">
        <ThemeToggle />
        
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
