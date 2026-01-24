// components/import/wizard/step-resolve.tsx
// VERSION 4 - Seulement les issues bloquantes (dates ambiguës, notation scientifique, types incompatibles)
'use client';

import { useState } from 'react';
import { 
  AlertTriangle, 
  Calendar, 
  Hash, 
  XCircle, 
  CheckCircle2, 
  HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { 
  ResolvableIssue, 
  IssueResolution, 
  DateFormatOption,
} from '@/lib/infrastructure/zoho/types';

// ==================== TYPES ====================

interface StepResolveProps {
  issues: ResolvableIssue[];
  onResolve: (resolvedIssues: ResolvableIssue[]) => void;
  onBack: () => void;
}

// ==================== COMPOSANTS DE RÉSOLUTION ====================

/**
 * Résolution pour les dates ambiguës (DD/MM vs MM/DD)
 */
function DateFormatResolver({
  issue,
  onResolve
}: {
  issue: ResolvableIssue;
  onResolve: (resolution: IssueResolution) => void;
}) {
  // Pré-sélectionner le format suggéré par Excel si disponible et confiance haute
  const defaultFormat = issue.excelHint?.confidence === 'high' 
    ? issue.excelHint.suggestedFormat as DateFormatOption 
    : null;
  
  const [selectedFormat, setSelectedFormat] = useState<DateFormatOption | null>(defaultFormat);
  const [applyToAll, setApplyToAll] = useState(true);

  const sampleValue = issue.sampleValues[0] || '05/03/2025';
  const parts = sampleValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  let ddmmInterpretation = '';
  let mmddInterpretation = '';

  if (parts) {
    const [, first, second, year] = parts;
    const ddmmDate = new Date(parseInt(year), parseInt(second) - 1, parseInt(first));
    ddmmInterpretation = ddmmDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const mmddDate = new Date(parseInt(year), parseInt(first) - 1, parseInt(second));
    mmddInterpretation = mmddDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  const handleConfirm = () => {
    if (selectedFormat) {
      onResolve({
        type: 'date_format',
        format: selectedFormat,
        applyToAll,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Hint Excel si disponible */}
      {issue.excelHint && (
        <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Suggestion Excel
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Le fichier Excel indique que cette colonne utilise le format{' '}
                <strong>{issue.excelHint.suggestedFormat}</strong>
                {issue.excelHint.confidence === 'high' && (
                  <span className="ml-1 text-xs bg-blue-200 dark:bg-blue-800 px-1.5 py-0.5 rounded">
                    confiance élevée
                  </span>
                )}
                {issue.excelHint.confidence === 'medium' && (
                  <span className="ml-1 text-xs bg-yellow-200 dark:bg-yellow-800 px-1.5 py-0.5 rounded">
                    confiance moyenne
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <strong>Exemple :</strong> &quot;{sampleValue}&quot;
        </p>
      </div>

      <div className="space-y-3">
        <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
          issue.excelHint?.suggestedFormat === 'DD/MM/YYYY' ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20' : ''
        }`}>
          <input
            type="radio"
            name={`date-format-${issue.id}`}
            value="DD/MM/YYYY"
            checked={selectedFormat === 'DD/MM/YYYY'}
            onChange={() => setSelectedFormat('DD/MM/YYYY')}
            className="mt-1"
          />
          <div className="flex-1">
            <p className="font-medium">
              JJ/MM/AAAA (format français)
              {issue.excelHint?.suggestedFormat === 'DD/MM/YYYY' && (
                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                  ← Suggéré par Excel
                </span>
              )}
            </p>
            <p className="text-sm text-gray-500">
              &quot;{sampleValue}&quot; → <strong>{ddmmInterpretation}</strong>
            </p>
          </div>
        </label>

        <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
          issue.excelHint?.suggestedFormat === 'MM/DD/YYYY' ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20' : ''
        }`}>
          <input
            type="radio"
            name={`date-format-${issue.id}`}
            value="MM/DD/YYYY"
            checked={selectedFormat === 'MM/DD/YYYY'}
            onChange={() => setSelectedFormat('MM/DD/YYYY')}
            className="mt-1"
          />
          <div className="flex-1">
            <p className="font-medium">
              MM/JJ/AAAA (format américain)
              {issue.excelHint?.suggestedFormat === 'MM/DD/YYYY' && (
                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                  ← Suggéré par Excel
                </span>
              )}
            </p>
            <p className="text-sm text-gray-500">
              &quot;{sampleValue}&quot; → <strong>{mmddInterpretation}</strong>
            </p>
          </div>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <input
          type="checkbox"
          checked={applyToAll}
          onChange={(e) => setApplyToAll(e.target.checked)}
        />
        Appliquer à toutes les colonnes de type date
      </label>

      <Button
        onClick={handleConfirm}
        disabled={!selectedFormat}
        className="w-full"
      >
        {issue.excelHint && selectedFormat === issue.excelHint.suggestedFormat 
          ? 'Confirmer la suggestion Excel' 
          : 'Confirmer le format'}
      </Button>
    </div>
  );
}

/**
 * Résolution pour la notation scientifique (1E6 → 1000000)
 */
function ScientificNotationResolver({ 
  issue, 
  onResolve 
}: { 
  issue: ResolvableIssue; 
  onResolve: (resolution: IssueResolution) => void;
}) {
  const [choice, setChoice] = useState<'number' | 'text' | null>(null);

  const handleConfirm = () => {
    if (choice === 'number') {
      onResolve({ type: 'scientific_to_number', confirmed: true });
    } else if (choice === 'text') {
      onResolve({ type: 'scientific_to_text', confirmed: true });
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
          <strong>Transformations prévues :</strong>
        </p>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 font-mono">
          {issue.sampleValues.map((v, i) => (
            <li key={i}>• {v}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <input
            type="radio"
            name={`scientific-${issue.id}`}
            value="number"
            checked={choice === 'number'}
            onChange={() => setChoice('number')}
            className="mt-1"
          />
          <div>
            <p className="font-medium">Convertir en nombre (recommandé)</p>
            <p className="text-sm text-gray-500">
              La notation sera développée (ex: 1.5E6 → 1 500 000)
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <input
            type="radio"
            name={`scientific-${issue.id}`}
            value="text"
            checked={choice === 'text'}
            onChange={() => setChoice('text')}
            className="mt-1"
          />
          <div>
            <p className="font-medium">Garder comme texte</p>
            <p className="text-sm text-gray-500">
              La valeur sera importée telle quelle (ex: &quot;1.5E6&quot;)
            </p>
          </div>
        </label>
      </div>

      <Button 
        onClick={handleConfirm} 
        disabled={!choice}
        className="w-full"
      >
        Confirmer le choix
      </Button>
    </div>
  );
}

/**
 * Résolution pour les types incompatibles
 */
function TypeIncompatibleResolver({ 
  issue, 
  onResolve 
}: { 
  issue: ResolvableIssue; 
  onResolve: (resolution: IssueResolution) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
        <p className="text-sm text-red-800 dark:text-red-200 mb-2">
          <strong>Exemples de valeurs :</strong>
        </p>
        <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
          {issue.sampleValues.map((v, i) => (
            <li key={i}>• &quot;{v}&quot;</li>
          ))}
        </ul>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Cette colonne contient des données incompatibles avec le type attendu par Zoho.
        Vous pouvez choisir d&apos;ignorer cette colonne lors de l&apos;import.
      </p>

      <div className="flex gap-3">
        <Button 
          onClick={() => onResolve({ type: 'ignore_column' })}
          variant="outline"
          className="flex-1"
        >
          Ignorer cette colonne
        </Button>
      </div>
    </div>
  );
}

// ==================== CARTE ISSUE ====================

/**
 * Carte pour une issue individuelle
 */
function IssueCard({ 
  issue, 
  index,
  onResolve 
}: { 
  issue: ResolvableIssue; 
  index: number;
  onResolve: (issueId: string, resolution: IssueResolution) => void;
}) {
  const getIcon = () => {
    switch (issue.type) {
      case 'ambiguous_date_format':
        return <Calendar className="w-5 h-5 text-amber-500" />;
      case 'scientific_notation':
        return <Hash className="w-5 h-5 text-blue-500" />;
      case 'type_incompatible':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <HelpCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTitle = () => {
    switch (issue.type) {
      case 'ambiguous_date_format':
        return 'Format de date ambigu';
      case 'scientific_notation':
        return 'Notation scientifique détectée';
      case 'type_incompatible':
        return 'Type incompatible';
      default:
        return 'Problème détecté';
    }
  };

  const getBorderColor = () => {
    switch (issue.type) {
      case 'ambiguous_date_format':
        return 'border-amber-200 dark:border-amber-800';
      case 'scientific_notation':
        return 'border-blue-200 dark:border-blue-800';
      case 'type_incompatible':
        return 'border-red-200 dark:border-red-800';
      default:
        return 'border-gray-200 dark:border-gray-800';
    }
  };

  const handleResolve = (resolution: IssueResolution) => {
    onResolve(issue.id, resolution);
  };

  if (issue.resolved) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <div>
              <CardTitle className="text-base text-green-800 dark:text-green-200">
                {getTitle()} — Résolu ✓
              </CardTitle>
              <CardDescription className="text-green-600 dark:text-green-400">
                Colonne : {issue.column}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={getBorderColor()}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 font-semibold text-sm">
            {index + 1}
          </div>
          {getIcon()}
          <div>
            <CardTitle className="text-base">{getTitle()}</CardTitle>
            <CardDescription>Colonne : <strong>{issue.column}</strong></CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {issue.message}
        </p>

        {issue.type === 'ambiguous_date_format' && (
          <DateFormatResolver issue={issue} onResolve={handleResolve} />
        )}

        {issue.type === 'scientific_notation' && (
          <ScientificNotationResolver issue={issue} onResolve={handleResolve} />
        )}

        {issue.type === 'type_incompatible' && (
          <TypeIncompatibleResolver issue={issue} onResolve={handleResolve} />
        )}
      </CardContent>
    </Card>
  );
}

// ==================== COMPOSANT PRINCIPAL ====================

export function StepResolve({ issues, onResolve, onBack }: StepResolveProps) {
  const [localIssues, setLocalIssues] = useState<ResolvableIssue[]>(issues);

  const resolvedCount = localIssues.filter(i => i.resolved).length;
  const totalCount = localIssues.length;
  const allResolved = resolvedCount === totalCount;

  const handleIssueResolve = (issueId: string, resolution: IssueResolution) => {
    setLocalIssues(prev => 
      prev.map(issue => 
        issue.id === issueId 
          ? { ...issue, resolved: true, resolution } 
          : issue
      )
    );
  };

  const handleContinue = () => {
    onResolve(localIssues);
  };

  // Si pas d'issues, afficher un message de succès
  if (totalCount === 0) {
    return (
      <div className="space-y-6">
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200">
                  Aucun problème à résoudre
                </h3>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Toutes les colonnes sont compatibles avec le schéma Zoho.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>
            ← Retour
          </Button>
          <Button onClick={handleContinue} className="flex-1">
            Continuer →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <div className="flex-1">
              <h3 className="font-semibold">
                {totalCount} format{totalCount > 1 ? 's' : ''} à confirmer
              </h3>
              <p className="text-sm text-gray-500">
                Ces formats sont ambigus et nécessitent votre confirmation.
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-amber-600">
                {resolvedCount}/{totalCount}
              </div>
              <div className="text-xs text-gray-500">confirmés</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${(resolvedCount / totalCount) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Liste des issues */}
      <div className="space-y-4">
        {localIssues.map((issue, index) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            index={index}
            onResolve={handleIssueResolve}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          ← Retour
        </Button>
        <Button 
          onClick={handleContinue} 
          disabled={!allResolved}
          className="flex-1"
        >
          {allResolved ? 'Continuer →' : `Confirmer ${totalCount - resolvedCount} format(s) restant(s)`}
        </Button>
      </div>
    </div>
  );
}
