/**
 * @file app/(dashboard)/pdf-config/page.tsx
 * @description Interface de configuration du template PDF
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  PDFTemplateConfig, 
  DEFAULT_CONFIG, 
  CONFIG_LABELS 
} from '@/lib/pdf/config';

export default function PDFConfigPage() {
  const [config, setConfig] = useState<PDFTemplateConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [previewEmail, setPreviewEmail] = useState('sandrine.auberger@ratp.fr');

  // Charger la config sauvegardée
  useEffect(() => {
    const saved = localStorage.getItem('pdf-template-config');
    if (saved) {
      try {
        setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
      } catch (e) {
        console.error('Erreur chargement config:', e);
      }
    }
  }, []);

  // Sauvegarder la config
  const handleSave = () => {
    setSaving(true);
    localStorage.setItem('pdf-template-config', JSON.stringify(config));
    setTimeout(() => setSaving(false), 500);
  };

  // Réinitialiser
  const handleReset = () => {
    if (confirm('Réinitialiser la configuration par défaut ?')) {
      setConfig(DEFAULT_CONFIG);
      localStorage.removeItem('pdf-template-config');
    }
  };

  // Prévisualiser le PDF
  const handlePreview = async () => {
    const response = await fetch('/api/zoho/dashboard-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: previewEmail,
        config: config,
      }),
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } else {
      const error = await response.json();
      alert(error.error || 'Erreur génération PDF');
    }
  };

  // Helpers pour mise à jour
  const updateColor = (key: keyof PDFTemplateConfig['colors'], value: string) => {
    setConfig(prev => ({
      ...prev,
      colors: { ...prev.colors, [key]: value }
    }));
  };

  const toggleSection = (key: keyof PDFTemplateConfig['sections']) => {
    setConfig(prev => ({
      ...prev,
      sections: { ...prev.sections, [key]: !prev.sections[key] }
    }));
  };

  const toggleColumn = (key: keyof PDFTemplateConfig['tableColumns']) => {
    setConfig(prev => ({
      ...prev,
      tableColumns: { ...prev.tableColumns, [key]: !prev.tableColumns[key] }
    }));
  };

  const toggleKpi = (key: keyof PDFTemplateConfig['kpis']) => {
    setConfig(prev => ({
      ...prev,
      kpis: { ...prev.kpis, [key]: !prev.kpis[key] }
    }));
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Configuration du PDF</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Personnalisez le template du bilan PQS
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            Réinitialiser
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegardé ✓' : 'Sauvegarder'}
          </Button>
        </div>
      </div>

      {/* Textes */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">📝 Textes</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Titre principal</label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Pied de page gauche</label>
              <input
                type="text"
                value={config.footerLeft}
                onChange={(e) => setConfig(prev => ({ ...prev, footerLeft: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                placeholder="{date} sera remplacé par la date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pied de page droit</label>
              <input
                type="text"
                value={config.footerRight}
                onChange={(e) => setConfig(prev => ({ ...prev, footerRight: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Couleurs */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">🎨 Couleurs</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.keys(config.colors) as Array<keyof PDFTemplateConfig['colors']>).map((key) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1">
                {CONFIG_LABELS.colors[key]}
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={config.colors[key]}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={config.colors[key]}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="flex-1 px-2 py-1 border rounded text-sm dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Sections à afficher */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">📊 Sections à afficher</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(Object.keys(config.sections) as Array<keyof PDFTemplateConfig['sections']>).map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.sections[key]}
                onChange={() => toggleSection(key)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">{CONFIG_LABELS.sections[key]}</span>
            </label>
          ))}
        </div>
      </Card>

      {/* KPIs */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">📈 Indicateurs KPI</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(Object.keys(config.kpis) as Array<keyof PDFTemplateConfig['kpis']>).map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.kpis[key]}
                onChange={() => toggleKpi(key)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">{CONFIG_LABELS.kpis[key]}</span>
            </label>
          ))}
        </div>
      </Card>

      {/* Colonnes tableau */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">📋 Colonnes du tableau mensuel</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(config.tableColumns) as Array<keyof PDFTemplateConfig['tableColumns']>).map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.tableColumns[key]}
                onChange={() => toggleColumn(key)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">{CONFIG_LABELS.tableColumns[key]}</span>
            </label>
          ))}
        </div>
      </Card>

      {/* Prévisualisation */}
      <Card className="p-6 bg-gray-50 dark:bg-gray-900">
        <h2 className="text-lg font-semibold mb-4">👁️ Prévisualisation</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Email de test</label>
            <input
              type="email"
              value={previewEmail}
              onChange={(e) => setPreviewEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <Button onClick={handlePreview}>
            Générer le PDF de test
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          La génération peut prendre 15-30 secondes
        </p>
      </Card>
    </div>
  );
}
