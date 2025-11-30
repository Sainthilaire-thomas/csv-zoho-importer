// components/import/wizard/wizard-progress.tsx
'use client';

import { Check } from 'lucide-react';
import type { ImportStatus } from '@/types';

interface WizardStep {
  id: ImportStatus;
  label: string;
  shortLabel: string;
}

const WIZARD_STEPS: WizardStep[] = [
  { id: 'selecting', label: 'Sélection du fichier', shortLabel: 'Fichier' },
  { id: 'configuring', label: 'Configuration', shortLabel: 'Config' },
  { id: 'validating', label: 'Validation', shortLabel: 'Validation' },
  { id: 'reviewing', label: 'Vérification', shortLabel: 'Revue' },
  { id: 'success', label: 'Terminé', shortLabel: 'Fin' },
];

interface WizardProgressProps {
  currentStatus: ImportStatus;
  className?: string;
}

export function WizardProgress({ currentStatus, className = '' }: WizardProgressProps) {
  const currentIndex = WIZARD_STEPS.findIndex((step) => step.id === currentStatus);
  
  const effectiveIndex = currentStatus === 'error' 
    ? WIZARD_STEPS.findIndex((step) => step.id === 'reviewing')
    : currentStatus === 'importing'
    ? WIZARD_STEPS.findIndex((step) => step.id === 'reviewing')
    : currentIndex;

  return (
    <div className={`w-full ${className}`}>
      {/* Desktop version */}
      <div className="hidden md:block">
        <nav aria-label="Progression">
          <ol className="flex items-center justify-between">
            {WIZARD_STEPS.map((step, index) => {
              const isCompleted = index < effectiveIndex;
              const isCurrent = index === effectiveIndex;

              return (
                <li key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center w-full">
                    <div className="flex items-center w-full">
                      {index > 0 && (
                        <div
                          className={`
                            flex-1 h-0.5
                            ${isCompleted || isCurrent ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}
                          `}
                        />
                      )}

                      <div
                        className={`
                          relative flex items-center justify-center w-10 h-10 rounded-full
                          transition-all duration-300
                          ${
                            isCompleted
                              ? 'bg-blue-600 dark:bg-blue-500'
                              : isCurrent
                              ? 'bg-blue-600 dark:bg-blue-500 ring-4 ring-blue-100 dark:ring-blue-900'
                              : 'bg-gray-200 dark:bg-gray-700'
                          }
                        `}
                      >
                        {isCompleted ? (
                          <Check className="w-5 h-5 text-white" />
                        ) : (
                          <span
                            className={`
                              text-sm font-semibold
                              ${isCurrent ? 'text-white' : 'text-gray-500 dark:text-gray-400'}
                            `}
                          >
                            {index + 1}
                          </span>
                        )}
                      </div>

                      {index < WIZARD_STEPS.length - 1 && (
                        <div
                          className={`
                            flex-1 h-0.5
                            ${isCompleted ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}
                          `}
                        />
                      )}
                    </div>

                    <span
                      className={`
                        mt-2 text-xs font-medium text-center
                        ${
                          isCompleted || isCurrent
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'text-gray-500 dark:text-gray-400'
                        }
                      `}
                    >
                      {step.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      {/* Mobile version */}
      <div className="md:hidden">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            {WIZARD_STEPS.map((step, index) => {
              const isCompleted = index < effectiveIndex;
              const isCurrent = index === effectiveIndex;

              return (
                <div
                  key={step.id}
                  className={`
                    rounded-full transition-all duration-300
                    ${isCurrent ? 'w-6 h-2' : 'w-2 h-2'}
                    ${
                      isCompleted || isCurrent
                        ? 'bg-blue-600 dark:bg-blue-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }
                  `}
                />
              );
            })}
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {WIZARD_STEPS[effectiveIndex]?.label ?? 'En cours...'}
          </span>
        </div>
      </div>
    </div>
  );
}
