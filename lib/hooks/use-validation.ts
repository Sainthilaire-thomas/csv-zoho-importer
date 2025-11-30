// lib/hooks/use-validation.ts
'use client';

import { useCallback, useState } from 'react';
import { validationEngine } from '@/lib/domain/validation';
import type { ValidationResult, TableValidationConfig } from '@/types';

interface UseValidationOptions {
  onProgress?: (percentage: number) => void;
}

export function useValidation(options?: UseValidationOptions) {
  const [isValidating, setIsValidating] = useState(false);

  const validate = useCallback(
    async (
      data: Record<string, unknown>[],
      config: TableValidationConfig
    ): Promise<ValidationResult> => {
      setIsValidating(true);

      try {
        // Simuler une progression pour les gros fichiers
        const totalRows = data.length;
        const chunkSize = Math.max(1000, Math.floor(totalRows / 10));
        
        let processedRows = 0;
        const allErrors: ValidationResult['errors'] = [];
        let validRows = 0;
        let errorRows = 0;
        const preview: ValidationResult['preview'] = [];

        // Traiter par chunks pour ne pas bloquer l'UI
        for (let i = 0; i < totalRows; i += chunkSize) {
          const chunk = data.slice(i, Math.min(i + chunkSize, totalRows));
          
          // Validation du chunk
          const chunkResult = validationEngine.validate(chunk, {
            ...config,
            // Ajuster les numéros de ligne
          });

          // Ajuster les numéros de ligne pour ce chunk
          const adjustedErrors = chunkResult.errors.map((err) => ({
            ...err,
            line: err.line + i,
          }));

          allErrors.push(...adjustedErrors);
          validRows += chunkResult.validRows;
          errorRows += chunkResult.errorRows;

          // Garder seulement les 50 premières lignes pour le preview
          if (preview.length < 50 && chunkResult.preview) {
            const adjustedPreview = chunkResult.preview.map((row) => ({
              ...row,
              _lineNumber: row._lineNumber + i,
            }));
            preview.push(...adjustedPreview.slice(0, 50 - preview.length));
          }

          processedRows += chunk.length;
          const percentage = Math.round((processedRows / totalRows) * 100);
          options?.onProgress?.(percentage);

          // Laisser respirer l'UI
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        return {
          isValid: errorRows === 0,
          totalRows,
          validRows,
          errorRows,
          errors: allErrors.slice(0, 1000), // Limiter à 1000 erreurs max
          preview,
        };
      } finally {
        setIsValidating(false);
      }
    },
    [options]
  );

  return { validate, isValidating };
}
