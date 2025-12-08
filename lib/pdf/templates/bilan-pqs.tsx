/**
 * @file lib/pdf/templates/bilan-pqs.tsx
 * @description Template PDF pour le bilan PQS conseiller - Style Dashboard Zoho
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Rect,
  Line,
} from '@react-pdf/renderer';
import type { PQSReportData, PQSRow } from '../types';

// Couleurs du dashboard
const COLORS = {
  primary: '#0891b2',      // Cyan/Teal (barres principales)
  secondary: '#eab308',    // Jaune (barres secondaires)
  accent: '#7c3aed',       // Violet (header nom)
  success: '#22c55e',      // Vert
  warning: '#f97316',      // Orange
  threshold: '#f97316',    // Orange (ligne seuil)
  dark: '#1e293b',
  gray: '#64748b',
  lightGray: '#f1f5f9',
  white: '#ffffff',
};

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: COLORS.white,
  },
  // Header
  header: {
    marginBottom: 20,
  },
  welcomeBanner: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 4,
    marginBottom: 10,
  },
  welcomeText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  agentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.accent,
    marginTop: 5,
  },
  agentInfo: {
    fontSize: 10,
    color: COLORS.gray,
    marginTop: 2,
  },
  // KPI Section
  kpiSection: {
    marginBottom: 20,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  kpiCard: {
    width: '24%',
    padding: 10,
    backgroundColor: COLORS.lightGray,
    borderRadius: 4,
    alignItems: 'center',
  },
  kpiCardWide: {
    width: '32%',
    padding: 10,
    backgroundColor: COLORS.lightGray,
    borderRadius: 4,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 8,
    color: COLORS.gray,
    marginBottom: 4,
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  kpiValueLarge: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  kpiUnit: {
    fontSize: 8,
    color: COLORS.gray,
    marginTop: 2,
  },
  kpiSubtext: {
    fontSize: 7,
    color: COLORS.gray,
    marginTop: 4,
    textAlign: 'center',
  },
  // Chart Section
  chartSection: {
    marginBottom: 15,
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: 8,
  },
  chartContainer: {
    height: 100,
    position: 'relative',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  legendColor: {
    width: 10,
    height: 10,
    marginRight: 4,
  },
  legendText: {
    fontSize: 7,
    color: COLORS.gray,
  },
  // Two column layout for charts
  chartsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartHalf: {
    width: '48%',
  },
  // Table
  tableSection: {
    marginTop: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: 8,
    borderBottom: `1 solid ${COLORS.lightGray}`,
    paddingBottom: 4,
  },
  table: {
    marginTop: 5,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    padding: 6,
  },
  tableHeaderCell: {
    color: COLORS.white,
    fontSize: 7,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: `1 solid ${COLORS.lightGray}`,
    padding: 5,
  },
  tableRowAlt: {
    backgroundColor: COLORS.lightGray,
  },
  tableCell: {
    fontSize: 7,
    color: COLORS.dark,
  },
  cellPeriode: { width: '10%' },
  cellJours: { width: '8%', textAlign: 'right' },
  cellMoy: { width: '10%', textAlign: 'right' },
  cellBar: { width: '8%', textAlign: 'right' },
  cellPrime: { width: '12%', textAlign: 'right' },
  cellProp: { width: '10%', textAlign: 'right' },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    fontSize: 8,
    color: COLORS.gray,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: `1 solid ${COLORS.lightGray}`,
    paddingTop: 10,
  },
});

// Helpers
function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  return parseFloat(value.replace(',', '.').replace('%', '').replace('€', '').trim()) || 0;
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
  });
}

// Bar Chart Component with threshold line
interface BarChartProps {
  data: { label: string; value: number; value2?: number }[];
  maxValue: number;
  threshold?: number;
  color1?: string;
  color2?: string;
  showLegend?: boolean;
  legend1?: string;
  legend2?: string;
}

function BarChart({ 
  data, 
  maxValue, 
  threshold,
  color1 = COLORS.primary, 
  color2 = COLORS.secondary,
  showLegend = false,
  legend1 = 'Tel',
  legend2 = 'Mail',
}: BarChartProps) {
  const chartWidth = 500;
  const chartHeight = 80;
  const barWidth = data[0]?.value2 !== undefined ? 25 : 40;
  const gap = data[0]?.value2 !== undefined ? 5 : 0;
  const groupWidth = barWidth * (data[0]?.value2 !== undefined ? 2 : 1) + gap;
  const spacing = (chartWidth - data.length * groupWidth) / (data.length + 1);

  return (
    <View>
      {showLegend && (
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: color1 }]} />
            <Text style={styles.legendText}>{legend1}</Text>
          </View>
          {data[0]?.value2 !== undefined && (
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: color2 }]} />
              <Text style={styles.legendText}>{legend2}</Text>
            </View>
          )}
          {threshold && (
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: COLORS.threshold }]} />
              <Text style={styles.legendText}>Seuil</Text>
            </View>
          )}
        </View>
      )}
      <Svg width={chartWidth} height={chartHeight + 20}>
        {/* Threshold line */}
        {threshold && (
          <>
            <Line
              x1={0}
              y1={chartHeight - (threshold / maxValue) * chartHeight}
              x2={chartWidth}
              y2={chartHeight - (threshold / maxValue) * chartHeight}
              stroke={COLORS.threshold}
              strokeWidth={1}
              strokeDasharray="4,2"
            />
            <Text
              x={chartWidth - 30}
              y={chartHeight - (threshold / maxValue) * chartHeight - 3}
              style={{ fontSize: 6, fill: COLORS.threshold }}
            >
              {threshold}
            </Text>
          </>
        )}
        
        {/* Bars */}
        {data.map((item, index) => {
          const x = spacing + index * (groupWidth + spacing);
          const height1 = Math.min((item.value / maxValue) * chartHeight, chartHeight);
          const height2 = item.value2 !== undefined 
            ? Math.min((item.value2 / maxValue) * chartHeight, chartHeight) 
            : 0;

          return (
            <React.Fragment key={index}>
              {/* Bar 1 */}
              <Rect
                x={x}
                y={chartHeight - height1}
                width={barWidth}
                height={height1}
                fill={color1}
              />
              {/* Value label 1 */}
              <Text
                x={x + barWidth / 2}
                y={chartHeight - height1 - 3}
                style={{ fontSize: 7, fill: color1, textAnchor: 'middle' }}
              >
                {item.value.toFixed(item.value >= 100 ? 0 : 1)}
              </Text>
              
              {/* Bar 2 (if exists) */}
              {item.value2 !== undefined && (
                <>
                  <Rect
                    x={x + barWidth + gap}
                    y={chartHeight - height2}
                    width={barWidth}
                    height={height2}
                    fill={color2}
                  />
                  <Text
                    x={x + barWidth + gap + barWidth / 2}
                    y={chartHeight - height2 - 3}
                    style={{ fontSize: 7, fill: color2, textAnchor: 'middle' }}
                  >
                    {item.value2.toFixed(item.value2 >= 100 ? 0 : 1)}
                  </Text>
                </>
              )}
              
              {/* X-axis label */}
              <Text
                x={x + (item.value2 !== undefined ? groupWidth / 2 : barWidth / 2)}
                y={chartHeight + 12}
                style={{ fontSize: 7, fill: COLORS.gray, textAnchor: 'middle' }}
              >
                {item.label}
              </Text>
            </React.Fragment>
          );
        })}
      </Svg>
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
  const monthlyRows = rows
    .filter(r => !r.Pde.startsWith('T'))
    .sort((a, b) => a.Pde.localeCompare(b.Pde));
  const quarterlyRows = rows
    .filter(r => r.Pde.startsWith('T'))
    .sort((a, b) => a.Pde.localeCompare(b.Pde));
  
  // Calculer les KPIs
  const totalPrime = quarterlyRows.reduce(
    (sum, r) => sum + parseNumber(r['✉ Réelle €']), 
    0
  );
  const totalJours = monthlyRows.reduce(
    (sum, r) => sum + parseNumber(r['JW Pointés']), 
    0
  );
  const avgProportion = quarterlyRows.length > 0
    ? quarterlyRows.reduce((sum, r) => sum + parseNumber(r['Prop. € SC']), 0) / quarterlyRows.length
    : 0;
  
  // Prime max et min par trimestre
  const primesByQuarter = quarterlyRows.map(r => ({
    period: r.Pde,
    value: parseNumber(r['✉ Réelle €']),
  }));
  const maxPrime = primesByQuarter.reduce(
    (max, p) => p.value > max.value ? p : max, 
    { period: '-', value: 0 }
  );
  const minPrime = primesByQuarter.reduce(
    (min, p) => p.value < min.value || min.value === 0 ? p : min, 
    { period: '-', value: Infinity }
  );
  
  // Dernier mois avec données
  const lastActiveMonth = [...monthlyRows]
    .reverse()
    .find(r => parseNumber(r['JW Pointés']) > 0);
  
  // Seuil max (prime théorique trimestrielle)
  const maxThreshold = quarterlyRows.length > 0 
    ? parseNumber(quarterlyRows[0]['✉ Théorique €']) 
    : 400;
  
  // Données pour les graphiques
  const primesChartData = quarterlyRows.map(r => ({
    label: r.Pde,
    value: parseNumber(r['✉ Réelle €']),
  }));
  
  const quantiteChartData = quarterlyRows.map(r => ({
    label: r.Pde,
    value: parseNumber(r['Moy. Qté ☎']),
    value2: parseNumber(r['Moy. Qté ✉@']),
  }));
  
  const qualiteChartData = quarterlyRows.map(r => ({
    label: r.Pde,
    value: parseNumber(r['Moy.Qlé ☎']),
    value2: parseNumber(r['Moy.Qlé ✉@']),
  }));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.welcomeBanner}>
            <Text style={styles.welcomeText}>
              Votre Bilan Prime de Qualité de Service 2025
            </Text>
          </View>
          <Text style={styles.agentName}>
            {agent.nom}
          </Text>
          <Text style={styles.agentInfo}>
            Matricule: {agent.matricule} | Statut: {lastActiveMonth?.Statut || '-'} | Fonction: {lastActiveMonth?.Fct || '-'}
          </Text>
        </View>

        {/* KPIs Row 1 */}
        <View style={styles.kpiSection}>
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>PQS Trimestre en cours</Text>
              <Text style={styles.kpiValue}>
                {primesByQuarter.length > 0 
                  ? formatCurrency(primesByQuarter[primesByQuarter.length - 1].value)
                  : '-'}
              </Text>
              <Text style={styles.kpiSubtext}>
                {primesByQuarter.length > 0 ? primesByQuarter[primesByQuarter.length - 1].period : ''}
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Proportion Prime</Text>
              <Text style={styles.kpiValue}>{formatPercent(avgProportion)}</Text>
              <Text style={styles.kpiSubtext}>Moyenne annuelle</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>TOTAL 2025</Text>
              <Text style={styles.kpiValueLarge}>{formatCurrency(totalPrime)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Jours Travaillés</Text>
              <Text style={styles.kpiValue}>{totalJours.toFixed(0)}</Text>
              <Text style={styles.kpiSubtext}>jours</Text>
            </View>
          </View>
          
          {/* KPIs Row 2 */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCardWide}>
              <Text style={styles.kpiLabel}>Prime Max ({maxPrime.period})</Text>
              <Text style={styles.kpiValue}>{formatCurrency(maxPrime.value)}</Text>
            </View>
            <View style={styles.kpiCardWide}>
              <Text style={styles.kpiLabel}>Moyenne Prime</Text>
              <Text style={styles.kpiValue}>
                {quarterlyRows.length > 0 
                  ? formatCurrency(totalPrime / quarterlyRows.length)
                  : '-'}
              </Text>
            </View>
            <View style={styles.kpiCardWide}>
              <Text style={styles.kpiLabel}>Prime Min ({minPrime.period})</Text>
              <Text style={styles.kpiValue}>
                {minPrime.value !== Infinity ? formatCurrency(minPrime.value) : '-'}
              </Text>
            </View>
          </View>
        </View>

        {/* Chart: Primes Trimestrielles */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Primes PQS Trimestrielles</Text>
          <BarChart 
            data={primesChartData}
            maxValue={500}
            threshold={maxThreshold}
            color1={COLORS.primary}
            showLegend={true}
            legend1="Prime PQS"
          />
        </View>

        {/* Charts Row: Quantité et Qualité */}
        <View style={styles.chartsRow}>
          <View style={styles.chartHalf}>
            <Text style={styles.chartTitle}>Quantité par Trimestre</Text>
            <BarChart 
              data={quantiteChartData}
              maxValue={120}
              threshold={100}
              color1={COLORS.secondary}
              color2={COLORS.primary}
              showLegend={true}
              legend1="Tel"
              legend2="Mail"
            />
          </View>
          <View style={styles.chartHalf}>
            <Text style={styles.chartTitle}>Qualité par Trimestre</Text>
            <BarChart 
              data={qualiteChartData}
              maxValue={120}
              threshold={100}
              color1={COLORS.secondary}
              color2={COLORS.primary}
              showLegend={true}
              legend1="Tel"
              legend2="Mail"
            />
          </View>
        </View>

        {/* Table: Détail mensuel */}
        <View style={styles.tableSection}>
          <Text style={styles.sectionTitle}>Détail Mensuel</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.cellPeriode]}>Mois</Text>
              <Text style={[styles.tableHeaderCell, styles.cellJours]}>Jours</Text>
              <Text style={[styles.tableHeaderCell, styles.cellMoy]}>Qté Tel</Text>
              <Text style={[styles.tableHeaderCell, styles.cellMoy]}>Qté Mail</Text>
              <Text style={[styles.tableHeaderCell, styles.cellMoy]}>Qlé Tel</Text>
              <Text style={[styles.tableHeaderCell, styles.cellMoy]}>Qlé Mail</Text>
              <Text style={[styles.tableHeaderCell, styles.cellPrime]}>Prime</Text>
              <Text style={[styles.tableHeaderCell, styles.cellProp]}>Prop.</Text>
            </View>
            
            {monthlyRows.slice(0, 12).map((row, index) => (
              <View 
                key={row.Pde} 
                style={[
                  styles.tableRow,
                  index % 2 === 1 ? styles.tableRowAlt : {}
                ]}
              >
                <Text style={[styles.tableCell, styles.cellPeriode]}>{row.Pde}</Text>
                <Text style={[styles.tableCell, styles.cellJours]}>
                  {parseNumber(row['JW Pointés']).toFixed(0)}
                </Text>
                <Text style={[styles.tableCell, styles.cellMoy]}>
                  {parseNumber(row['Moy. Qté ☎']).toFixed(1)}
                </Text>
                <Text style={[styles.tableCell, styles.cellMoy]}>
                  {parseNumber(row['Moy. Qté ✉@']).toFixed(1)}
                </Text>
                <Text style={[styles.tableCell, styles.cellMoy]}>
                  {formatPercent(parseNumber(row['Moy.Qlé ☎']))}
                </Text>
                <Text style={[styles.tableCell, styles.cellMoy]}>
                  {formatPercent(parseNumber(row['Moy.Qlé ✉@']))}
                </Text>
                <Text style={[styles.tableCell, styles.cellPrime]}>
                  {formatCurrency(parseNumber(row['✉ Réelle €']))}
                </Text>
                <Text style={[styles.tableCell, styles.cellProp]}>
                  {row['Prop. € SC']}
                </Text>
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
