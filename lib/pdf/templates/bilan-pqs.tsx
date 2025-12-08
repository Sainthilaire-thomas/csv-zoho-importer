/**
 * @file lib/pdf/templates/bilan-pqs.tsx
 * @description Template PDF pour le bilan PQS conseiller
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { PQSReportData, PQSRow } from '../types';

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2 solid #1e40af',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  agentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  agentName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  matricule: {
    fontSize: 10,
    color: '#64748b',
  },
  section: {
    marginTop: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
    borderBottom: '1 solid #e2e8f0',
    paddingBottom: 4,
  },
  // KPI Cards
  kpiContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  kpiCard: {
    width: '23%',
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    border: '1 solid #e2e8f0',
  },
  kpiLabel: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  kpiUnit: {
    fontSize: 8,
    color: '#64748b',
  },
  // Table
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e40af',
    color: 'white',
    padding: 6,
    fontSize: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e2e8f0',
    padding: 5,
    fontSize: 8,
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  cellPeriode: { width: '12%' },
  cellJours: { width: '10%', textAlign: 'right' },
  cellQte: { width: '13%', textAlign: 'right' },
  cellQle: { width: '13%', textAlign: 'right' },
  cellPrime: { width: '13%', textAlign: 'right' },
  // Bar Chart
  chartContainer: {
    marginTop: 10,
    height: 120,
  },
  chartTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  barLabel: {
    width: '15%',
    fontSize: 8,
  },
  barContainer: {
    width: '70%',
    height: 16,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
  },
  bar: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  barValue: {
    width: '15%',
    fontSize: 8,
    textAlign: 'right',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    fontSize: 8,
    color: '#94a3b8',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

// Helpers
function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  return parseFloat(value.replace(',', '.').replace('%', '')) || 0;
}

function formatCurrency(value: number): string {
  return value.toFixed(2) + ' €';
}

function formatPercent(value: number): string {
  return value.toFixed(1) + '%';
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Components
interface KPICardProps {
  label: string;
  value: string;
  unit?: string;
}

function KPICard({ label, value, unit }: KPICardProps) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {unit && <Text style={styles.kpiUnit}>{unit}</Text>}
    </View>
  );
}

interface BarChartProps {
  data: { label: string; value: number; max: number }[];
  title: string;
  color?: string;
}

function BarChart({ data, title, color = '#3b82f6' }: BarChartProps) {
  const maxValue = Math.max(...data.map(d => d.max), 100);
  
  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>{title}</Text>
      {data.map((item, index) => (
        <View key={index} style={styles.barRow}>
          <Text style={styles.barLabel}>{item.label}</Text>
          <View style={styles.barContainer}>
            <View 
              style={[
                styles.bar, 
                { 
                  width: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: color,
                }
              ]} 
            />
          </View>
          <Text style={styles.barValue}>{item.value.toFixed(1)}</Text>
        </View>
      ))}
    </View>
  );
}

// Main Document
interface BilanPQSDocumentProps {
  data: PQSReportData;
}

export function BilanPQSDocument({ data }: BilanPQSDocumentProps) {
  const { agent, rows, generatedAt } = data;
  
  // Séparer données mensuelles et trimestrielles
  const monthlyRows = rows.filter(r => !r.Pde.startsWith('T'));
  const quarterlyRows = rows.filter(r => r.Pde.startsWith('T'));
  
  // Calculer les KPIs (dernier mois disponible)
  const latestMonth = monthlyRows[monthlyRows.length - 1];
  const totalPrime = monthlyRows.reduce(
    (sum, r) => sum + parseNumber(r['Prop. € SC']?.replace('%', '')), 
    0
  );
  
  // Données pour les graphiques trimestriels
  const quarterlyPrimes = quarterlyRows.map(r => ({
    label: r.Pde,
    value: parseNumber(r['Prop. € C3T']),
    max: 150,
  }));
  
  const quarterlyQte = quarterlyRows.map(r => ({
    label: r.Pde,
    value: parseNumber(r['Moy. Qté ☎']),
    max: 100,
  }));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Bilan PQS 2025</Text>
          <Text style={styles.subtitle}>Prime Qualité de Service - Conseiller</Text>
          <View style={styles.agentInfo}>
            <View>
              <Text style={styles.agentName}>{agent.nom}</Text>
              <Text style={styles.matricule}>Matricule: {agent.matricule}</Text>
            </View>
            <View>
              <Text style={styles.matricule}>Statut: {latestMonth?.Statut || '-'}</Text>
              <Text style={styles.matricule}>Fonction: {latestMonth?.Fct || '-'}</Text>
            </View>
          </View>
        </View>

        {/* KPIs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Indicateurs clés</Text>
          <View style={styles.kpiContainer}>
            <KPICard 
              label="Jours travaillés (cumul)" 
              value={monthlyRows.reduce((s, r) => s + parseNumber(r['JW Pointés']), 0).toFixed(0)}
              unit="jours"
            />
            <KPICard 
              label="Moy. Quantité ☎" 
              value={latestMonth ? parseNumber(latestMonth['Moy. Qté ☎']).toFixed(1) : '-'}
              unit="appels/jour"
            />
            <KPICard 
              label="Moy. Qualité ☎" 
              value={latestMonth ? formatPercent(parseNumber(latestMonth['Moy.Qlé ☎'])) : '-'}
            />
            <KPICard 
              label="Prime SC" 
              value={latestMonth?.['Prop. € SC'] || '-'}
            />
          </View>
        </View>

        {/* Graphique Primes Trimestrielles */}
        {quarterlyPrimes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Primes par trimestre</Text>
            <BarChart 
              data={quarterlyPrimes} 
              title="Prime C3T (€)"
              color="#22c55e"
            />
          </View>
        )}

        {/* Tableau mensuel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Détail mensuel</Text>
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.cellPeriode}>Période</Text>
              <Text style={styles.cellJours}>Jours</Text>
              <Text style={styles.cellQte}>Qté ☎</Text>
              <Text style={styles.cellQte}>Qté ✉</Text>
              <Text style={styles.cellQle}>Qlé ☎</Text>
              <Text style={styles.cellQle}>Qlé ✉</Text>
              <Text style={styles.cellPrime}>Prime SC</Text>
            </View>
            
            {/* Rows */}
            {monthlyRows.map((row, index) => (
              <View 
                key={row.Pde} 
                style={[
  styles.tableRow,
  index % 2 === 1 ? styles.tableRowAlt : {}
]}
              >
                <Text style={styles.cellPeriode}>{row.Pde}</Text>
                <Text style={styles.cellJours}>{parseNumber(row['JW Pointés']).toFixed(0)}</Text>
                <Text style={styles.cellQte}>{parseNumber(row['Moy. Qté ☎']).toFixed(1)}</Text>
                <Text style={styles.cellQte}>{parseNumber(row['Moy. Qté ✉@']).toFixed(1)}</Text>
                <Text style={styles.cellQle}>{formatPercent(parseNumber(row['Moy.Qlé ☎']))}</Text>
                <Text style={styles.cellQle}>{formatPercent(parseNumber(row['Moy.Qlé ✉@']))}</Text>
                <Text style={styles.cellPrime}>{row['Prop. € SC']}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Généré le {formatDate(generatedAt)}</Text>
          <Text>RATP - Service Client</Text>
        </View>
      </Page>
    </Document>
  );
}
