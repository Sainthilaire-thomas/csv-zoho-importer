// components/import/wizard/step-source.tsx
'use client';

import { FileUpload } from '@/components/import/file-upload';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, HardDrive, Server } from 'lucide-react';
import type { FileSource } from '@/types';

interface StepSourceProps {
  file: File | null;
  source: FileSource;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  onSourceChange: (source: FileSource) => void;
  onNext: () => void;
  canProceed: boolean;
}

export function StepSource({
  file,
  source,
  onFileSelect,
  onFileRemove,
  onSourceChange,
  onNext,
  canProceed,
}: StepSourceProps) {
  return (
    <Card variant="bordered" padding="lg">
      <CardHeader>
        <CardTitle>Sélectionner un fichier CSV</CardTitle>
        <CardDescription>
          Choisissez le fichier que vous souhaitez importer dans Zoho Analytics
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Source du fichier
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onSourceChange('upload')}
              className={`
                flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-all
                ${
                  source === 'upload'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              <HardDrive
                className={`
                  h-5 w-5
                  ${source === 'upload' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}
                `}
              />
              <div className="text-left">
                <p
                  className={`
                    font-medium
                    ${source === 'upload' ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}
                  `}
                >
                  Upload
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Depuis votre ordinateur
                </p>
              </div>
            </button>

            <button
              type="button"
              disabled
              className="flex-1 flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed"
            >
              <Server className="h-5 w-5 text-gray-400" />
              <div className="text-left">
                <p className="font-medium text-gray-700 dark:text-gray-300">SFTP</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Bientôt disponible</p>
              </div>
            </button>
          </div>
        </div>

        {source === 'upload' && (
          <FileUpload
  onFileSelect={onFileSelect}
  onFileRemove={onFileRemove}
  selectedFile={file}
  accept=".csv,.xlsx,.xls"
  maxSizeMB={200}
/>
        )}
      </CardContent>

      <CardFooter className="justify-end">
        <Button
          onClick={onNext}
          disabled={!canProceed}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          Suivant
        </Button>
      </CardFooter>
    </Card>
  );
}
