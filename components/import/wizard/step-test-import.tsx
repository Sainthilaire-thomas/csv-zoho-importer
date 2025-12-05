/**
 * @file components/import/wizard/step-test-import.tsx
 * @description Étape d'import test - Import d'un échantillon pour vérification
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { CheckCircle, Loader2, AlertCircle, Clock } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface TestImportStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'success' | 'error';
  duration?: number;
  error?: string;
}

interface StepTestImportProps {
  sampleSize: number;
  matchingColumn: string | null;
  matchingValues: string[];
  onComplete: (success: boolean) => void;
  onError: (error: string) => void;
  // Callbacks pour exécuter les actions
  executeImport: () => Promise<{ success: boolean; error?: string }>;
  executeVerification: () => Promise<{ success: boolean; error?: string }>;
}

export function StepTestImport({
  sampleSize,
  matchingColumn,
  matchingValues,
  onComplete,
  onError,
  executeImport,
  executeVerification,
}: StepTestImportProps) {
  const [steps, setSteps] = useState<TestImportStep[]>([
    { id: 'import', label: `Import de ${sampleSize} lignes`, status: 'pending' },
    { id: 'wait', label: 'Attente indexation Zoho', status: 'pending' },
    { id: 'verify', label: 'Vérification des données', status: 'pending' },
  ]);
   const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  
  // Protection contre double exécution (React StrictMode)
  const hasStartedRef = useRef(false);

  // Lancer le processus automatiquement au montage
  useEffect(() => {
    if (!isRunning && !hasStartedRef.current) {
      hasStartedRef.current = true;
      runTestImport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStep = (
    stepId: string,
    updates: Partial<TestImportStep>
  ) => {
    setSteps(prev =>
      prev.map(s => (s.id === stepId ? { ...s, ...updates } : s))
    );
  };

  const runTestImport = async () => {
    setIsRunning(true);

    try {
      // Étape 1: Import
      setCurrentStepIndex(0);
      updateStep('import', { status: 'running' });
      const importStart = Date.now();

      const importResult = await executeImport();

      if (!importResult.success) {
        updateStep('import', {
          status: 'error',
          duration: Date.now() - importStart,
          error: importResult.error,
        });
        onError(importResult.error || 'Erreur lors de l\'import test');
        return;
      }

      updateStep('import', {
        status: 'success',
        duration: Date.now() - importStart,
      });

      // Étape 2: Attente indexation
      setCurrentStepIndex(1);
      updateStep('wait', { status: 'running' });
      const waitStart = Date.now();

      // Attendre 2 secondes pour l'indexation Zoho
      await new Promise(resolve => setTimeout(resolve, 2000));

      updateStep('wait', {
        status: 'success',
        duration: Date.now() - waitStart,
      });

      // Étape 3: Vérification
      setCurrentStepIndex(2);
      updateStep('verify', { status: 'running' });
      const verifyStart = Date.now();

      const verifyResult = await executeVerification();

      updateStep('verify', {
        status: verifyResult.success ? 'success' : 'error',
        duration: Date.now() - verifyStart,
        error: verifyResult.error,
      });

      // Terminé - passer au résultat
      onComplete(verifyResult.success);

    } catch (error) {
      console.error('[TestImport] Error:', error);
      onError(error instanceof Error ? error.message : 'Erreur inattendue');
    }
  };

  const totalProgress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
        <h2 className="text-xl font-semibold">Import de test</h2>
        <p className="text-muted-foreground mt-1">
          Nous importons {sampleSize} lignes pour vérifier que les transformations sont correctes.
        </p>
      </div>

      {/* Progress bar globale */}
      <Progress value={totalProgress} className="h-2" />

      {/* Liste des étapes */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-center gap-3 p-3 rounded-md transition-colors ${
              index === currentStepIndex && step.status === 'running'
                ? 'bg-primary/5'
                : ''
            }`}
          >
            {/* Icône de statut */}
            <div className="shrink-0">
              {step.status === 'pending' && (
                <div className="w-5 h-5 rounded-full border-2 border-muted" />
              )}
              {step.status === 'running' && (
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              )}
              {step.status === 'success' && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {step.status === 'error' && (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
            </div>

            {/* Label */}
            <span
              className={`flex-1 ${
                step.status === 'pending'
                  ? 'text-muted-foreground'
                  : step.status === 'error'
                  ? 'text-red-600 dark:text-red-400'
                  : ''
              }`}
            >
              {step.label}
            </span>

            {/* Durée */}
            {step.duration !== undefined && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {(step.duration / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Info colonne de matching */}
      {matchingColumn && (
        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Colonne de matching :</span>{' '}
            {matchingColumn}
          </p>
          {matchingValues.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium">Valeurs testées :</span>{' '}
              {matchingValues.slice(0, 3).join(', ')}
              {matchingValues.length > 3 && `, ... (+${matchingValues.length - 3})`}
            </p>
          )}
        </div>
      )}

      {/* Erreur */}
      {steps.some(s => s.error) && (
        <Alert variant="error">
          {steps.find(s => s.error)?.error}
        </Alert>
      )}
    </div>
  );
}
