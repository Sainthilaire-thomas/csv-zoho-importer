'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/infrastructure/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Vérifier si l'utilisateur a une session valide (vient du lien de reset)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsValidSession(true);
      } else {
        // Écouter les changements d'auth (le token peut être dans l'URL)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
              setIsValidSession(true);
            } else if (session) {
              setIsValidSession(true);
            }
          }
        );

        // Attendre un peu pour le traitement du hash URL
        setTimeout(() => {
          if (isValidSession === null) {
            setIsValidSession(false);
          }
        }, 2000);

        return () => subscription.unsubscribe();
      }
    };

    checkSession();
  }, [supabase.auth, isValidSession]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validations
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      
      // Rediriger vers la page de login après 3 secondes
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    }
  };

  // État de chargement initial
  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Vérification en cours...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Lien invalide ou expiré
  if (isValidSession === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-4">
                Lien invalide ou expiré
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Ce lien de réinitialisation n&apos;est plus valide. Veuillez demander un nouveau lien.
              </p>
              <Button
                onClick={() => router.push('/login')}
                className="mt-6"
              >
                Retour à la connexion
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Succès
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-4">
                Mot de passe modifié !
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Votre mot de passe a été réinitialisé avec succès.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">
                Redirection vers la page de connexion...
              </p>
              <Button
                onClick={() => router.push('/login')}
                className="mt-6"
              >
                Se connecter maintenant
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Formulaire de reset
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              CSV Zoho Importer
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Créez votre nouveau mot de passe
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Reset Password Form */}
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Minimum 6 caractères</p>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <div className="relative mt-1">
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pr-10"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Modification...
                </>
              ) : (
                'Réinitialiser le mot de passe'
              )}
            </Button>

            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 mt-2"
            >
              ← Retour à la connexion
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
