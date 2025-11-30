// components/import/file-upload.tsx
'use client';

import { useCallback, useState, useRef } from 'react';
import { Upload, File, X, AlertCircle } from 'lucide-react';
import { AlertInline } from '@/components/ui/alert';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  selectedFile?: File | null;
  accept?: string;
  maxSizeMB?: number;
  disabled?: boolean;
}

export function FileUpload({
  onFileSelect,
  onFileRemove,
  selectedFile,
  accept = '.csv,.xlsx,.xls',
maxSizeMB = 200,
  disabled = false,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = useCallback(
    (file: File): string | null => {
      // Vérifier l'extension
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      const acceptedExtensions = accept.split(',').map((ext) => ext.trim().toLowerCase());
      
      if (!acceptedExtensions.includes(extension)) {
        return `Format non supporté. Formats acceptés : ${accept}`;
      }

      // Vérifier la taille
      if (file.size > maxSizeBytes) {
        return `Fichier trop volumineux. Taille maximale : ${maxSizeMB} MB`;
      }

      return null;
    },
    [accept, maxSizeBytes, maxSizeMB]
  );

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      const validationError = validateFile(file);
      
      if (validationError) {
        setError(validationError);
        return;
      }

      onFileSelect(file);
    },
    [validateFile, onFileSelect]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // Reset input pour permettre de resélectionner le même fichier
      e.target.value = '';
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setError(null);
      onFileRemove?.();
    },
    [onFileRemove]
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Affichage fichier sélectionné
  if (selectedFile) {
    return (
      <div className="w-full">
        <div
          className={`
            flex items-center justify-between gap-4 p-4
            bg-blue-50 dark:bg-blue-900/20
            border border-blue-200 dark:border-blue-800
            rounded-lg
          `}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg">
              <File className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {selectedFile.name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Supprimer le fichier"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Zone de drop
  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-4 p-8
          border-2 border-dashed rounded-xl
          transition-colors duration-200 cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : error
              ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/10'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
          aria-label="Sélectionner un fichier"
        />

        <div
          className={`
            p-4 rounded-full
            ${isDragging ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-gray-800'}
          `}
        >
          <Upload
            className={`
              h-8 w-8
              ${isDragging ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}
            `}
          />
        </div>

        <div className="text-center">
          <p className="text-gray-700 dark:text-gray-300">
            <span className="font-medium text-blue-600 dark:text-blue-400">
              Cliquez pour sélectionner
            </span>{' '}
            ou glissez votre fichier ici
          </p>
         <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
  Formats acceptés : CSV, Excel (.xlsx, .xls) - max {maxSizeMB} MB
</p>
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <AlertInline variant="error">{error}</AlertInline>
        </div>
      )}
    </div>
  );
}
