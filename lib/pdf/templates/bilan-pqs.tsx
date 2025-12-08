/**
 * @file lib/pdf/templates/bilan-pqs.tsx
 * @description Template PDF pour le bilan PQS conseiller - Configurable
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
import { PDFTemplateConfig, DEFAULT_CONFIG } from '../config';

// Fonction pour créer les styles dynamiques
function createStyles(colors: PDFTemplateConfig['colors']) {
  return StyleSheet.create({
    page: {
      padding: 30,
      fontSize: 10,
      fontFamily: 'Helvetica',
      backgroundColor: '#ffffff',
    },
    header: {
      marginBottom: 20,
    },
    welcomeBanner: {
      backgroundColor: colors.primary,
      padding: 12,
      borderRadius: 4,
      marginBottom: 10,
    },
    welcomeText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    agentName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.accent,
      marginTop: 5,
    },
    agentInfo: {
      fontSize: 10,
      color: '#64748b',
      marginTop: 2,
    },
    kpiSection: {
      marginBottom: 20,
    },
    kpiRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    kpiCard: {
      padding: 10,
      backgroundColor: '#f1f5f9',
      borderRadius: 4,
      alignItems: 'center',
    },
    kpiLabel: {
      fontSize: 8,
      color: '#64748b',
      marginBottom: 4,
      textAlign: 'center',
    },
    kpiValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
    },
    kpiValueLarge: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.primary,
    },
    kpiSubtext: {
      fontSize: 7,
      color: '#64748b',
      marginTop: 4,
      textAlign: 'center',
    },
    chartSection: {
      marginBottom: 15,
    },
    chartTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#1e293b',
      marginBottom: 8,
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
      color: '#64748b',
    },
    chartsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    chartHalf: {
      width: '48%',
    },
    tableSection: {
      marginTop: 15,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#1e293b',
      marginBottom: 8,
      borderBottom: '1 solid #f1f5f9',
      paddingBottom: 4,
    },
    table: {
      marginTop: 5,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: colors.primary,
      padding: 6,
    },
    tableHeaderCell: {
      color: '#ffffff',
      fontSize: 7,
      fontWeight: 'bold',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottom: '1 solid #f1f5f9',
      padding: 5,
    },
    tableRowAlt: {
      backgroundColor: '#f1f5f9',
    },
    tableCell: {
      fontSize: 7,
      color: '#1e293b',
    },
    footer: {
      position: 'absolute',
      bottom: 20,
      left: 30,
      right: 30,
      fontSize: 8,
      color: '#64748b',
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTop: '1 solid #f1f5f9',
      paddingTop: 10,
    },
  });
}

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

// Bar Chart Component
interface BarChartProps {
  data: { label: string; value: number; value2?: number }[];
  maxValue: number;
  threshold?: number;
  color1: string;
  color2: string;
  thresholdColor: string;
  showLegend?: boolean;
  legend1?: string;
  legend2?: string;
  width?: number;
}

function BarChart({ 
  data, 
  maxValue, 
  threshold,
  color1,
  color2,
  thresholdColor,
  showLegend = false,
  legend1 = 'Tel',
  legend2 = 'Mail',
  width = 500,
}: BarChartProps) {
  const chartWidth = width;
  const chartHeight = 80;
  const hasGrouped = data[0]?.value2 !== undefined;
  const barWidth = hasGrouped ? 20 : 35;
  const gap = hasGrouped ? 4 : 0;
  const groupWidth = barWidth * (hasGrouped ? 2 : 1) + gap;
  const spacing = (chartWidth - data.length * groupWidth) / (data.length + 1);

  return (
    <View>
      {showLegend && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
            <View style={{ width: 10, height: 10, marginRight: 4, backgroundColor: color1 }} />
            <Text style={{ fontSize: 7, color: '#64748b' }}>{legend1}</Text>
          </View>
          {hasGrouped && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
              <View style={{ width: 10, height: 10, marginRight: 4, backgroundColor: color2 }} />
              <Text style={{ fontSize: 7, color: '#64748b' }}>{legend2}</Text>
            </View>
          )}
          {threshold && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
              <View style={{ width: 10, height: 10, marginRight: 4, backgroundColor: thresholdColor }} />
              <Text style={{ fontSize: 7, color: '#64748b' }}>Seuil</Text>
            </View>
          )}
        </View>
      )}
      <Svg width={chartWidth} height={chartHeight + 20}>
        {threshold && (
          <Line
            x1={0}
            y1={chartHeight - (threshold / maxValue) * chartHeight}
            x2={chartWidth}
            y2={chartHeight - (threshold / maxValue) * chartHeight}
            stroke={thresholdColor}
            strokeWidth={1}
            strokeDasharray="4,2"
          />
        )}
        
        {data.map((item, index) => {
          const x = spacing + index * (groupWidth + spacing);
          const height1 = Math.min((item.value / maxValue) * chartHeight, chartHeight);
          const height2 = item.value2 !== undefined 
            ? Math.min((item.value2 / maxValue) * chartHeight, chartHeight) 
            : 0;

          return (
            <React.Fragment key={index}>
              <Rect
                x={x}
                y={chartHeight - height1}
                width={barWidth}
                height={Math.max(height1, 1)}
                fill={color1}
              />
              
              {item.value2 !== undefined && (
                <Rect
                  x={x + barWidth + gap}
                  y={chartHeight - height2}
                  width={barWidth}
                  height={Math.max(height2, 1)}
                  fill={color2}
                />
              )}
            </React.Fragment>
          );
        })}
      </Svg>
      {/* Labels sous le graphique */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: -15 }}>
        {data.map((item, index) => (
          <Text key={index} style={{ fontSize: 7, color: '#64748b', textAlign: 'center' }}>
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Main Document
interface BilanPQSDocumentProps {
  data: PQSReportData;
  config?: PDFTemplateConfig;
}

export function BilanPQSDocument({ data, config = DEFAULT_CONFIG }: BilanPQSDocumentProps) {
  const { agent, rows, generatedAt } = data;
  const styles = createStyles(config.colors);
  
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
  
  const primesByQuarter = quarterlyRows.map(r => ({
    period: r.Pde,
    value: parseNumber(r['✉ Réelle €']),
  }));
  const maxPrime = primesByQuarter.reduce(
    (max, p) => p.value > max.value ? p : max, 
    { period: '-', value: 0 }
  );
  const minPrime = primesByQuarter.reduce(
    (min, p) => (p.value < min.value && p.value > 0) ? p : min, 
    { period: '-', value: Infinity }
  );
  
  const lastActiveMonth = [...monthlyRows]
    .reverse()
    .find(r => parseNumber(r['JW Pointés']) > 0);
  
  const maxThreshold = quarterlyRows.length > 0 
    ? parseNumber(quarterlyRows[0]['✉ Théorique €']) 
    : 400;
  
  // Données graphiques
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

  // Compter les KPIs actifs pour calculer la largeur
  const activeKpisRow1 = [
    config.kpis.primeTrimestreCours,
    config.kpis.proportionPrime,
    config.kpis.totalAnnee,
    config.kpis.joursTravailles,
  ].filter(Boolean).length;
  
  const activeKpisRow2 = [
    config.kpis.primeMax,
    config.kpis.primeMoyenne,
    config.kpis.primeMin,
  ].filter(Boolean).length;

  const kpiWidth1 = activeKpisRow1 > 0 ? `${Math.floor(100 / activeKpisRow1) - 2}%` : '23%';
  const kpiWidth2 = activeKpisRow2 > 0 ? `${Math.floor(100 / activeKpisRow2) - 2}%` : '32%';

  // Colonnes actives du tableau
  const activeColumns = Object.entries(config.tableColumns)
    .filter(([_, active]) => active)
    .map(([key]) => key);
  const colWidth = `${Math.floor(100 / activeColumns.length)}%`;

  // Footer avec remplacement de {date}
  const footerLeft = config.footerLeft.replace('{date}', formatDate(generatedAt));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.welcomeBanner}>
            <Text style={styles.welcomeText}>{config.title}</Text>
          </View>
          <Text style={styles.agentName}>{agent.nom}</Text>
          <Text style={styles.agentInfo}>
            Matricule: {agent.matricule} | Statut: {lastActiveMonth?.Statut || '-'} | Fonction: {lastActiveMonth?.Fct || '-'}
          </Text>
        </View>

        {/* KPIs */}
        {config.sections.kpis && (
          <View style={styles.kpiSection}>
            <View style={styles.kpiRow}>
              {config.kpis.primeTrimestreCours && (
                <View style={[styles.kpiCard, { width: kpiWidth1 }]}>
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
              )}
              {config.kpis.proportionPrime && (
                <View style={[styles.kpiCard, { width: kpiWidth1 }]}>
                  <Text style={styles.kpiLabel}>Proportion Prime</Text>
                  <Text style={styles.kpiValue}>{formatPercent(avgProportion)}</Text>
                  <Text style={styles.kpiSubtext}>Moyenne annuelle</Text>
                </View>
              )}
              {config.kpis.totalAnnee && (
                <View style={[styles.kpiCard, { width: kpiWidth1 }]}>
                  <Text style={styles.kpiLabel}>TOTAL 2025</Text>
                  <Text style={styles.kpiValueLarge}>{formatCurrency(totalPrime)}</Text>
                </View>
              )}
              {config.kpis.joursTravailles && (
                <View style={[styles.kpiCard, { width: kpiWidth1 }]}>
                  <Text style={styles.kpiLabel}>Jours Travaillés</Text>
                  <Text style={styles.kpiValue}>{totalJours.toFixed(0)}</Text>
                  <Text style={styles.kpiSubtext}>jours</Text>
                </View>
              )}
            </View>
            
            {(config.kpis.primeMax || config.kpis.primeMoyenne || config.kpis.primeMin) && (
              <View style={styles.kpiRow}>
                {config.kpis.primeMax && (
                  <View style={[styles.kpiCard, { width: kpiWidth2 }]}>
                    <Text style={styles.kpiLabel}>Prime Max ({maxPrime.period})</Text>
                    <Text style={styles.kpiValue}>{formatCurrency(maxPrime.value)}</Text>
                  </View>
                )}
                {config.kpis.primeMoyenne && (
                  <View style={[styles.kpiCard, { width: kpiWidth2 }]}>
                    <Text style={styles.kpiLabel}>Moyenne Prime</Text>
                    <Text style={styles.kpiValue}>
                      {quarterlyRows.length > 0 
                        ? formatCurrency(totalPrime / quarterlyRows.length)
                        : '-'}
                    </Text>
                  </View>
                )}
                {config.kpis.primeMin && (
                  <View style={[styles.kpiCard, { width: kpiWidth2 }]}>
                    <Text style={styles.kpiLabel}>Prime Min ({minPrime.period})</Text>
                    <Text style={styles.kpiValue}>
                      {minPrime.value !== Infinity ? formatCurrency(minPrime.value) : '-'}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Chart: Primes */}
        {config.sections.chartPrimes && primesChartData.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.chartTitle}>Primes PQS Trimestrielles</Text>
            <BarChart 
              data={primesChartData}
              maxValue={500}
              threshold={maxThreshold}
              color1={config.colors.primary}
              color2={config.colors.secondary}
              thresholdColor={config.colors.threshold}
              showLegend={true}
              legend1="Prime PQS"
            />
          </View>
        )}

        {/* Charts Row: Quantité et Qualité */}
        {(config.sections.chartQuantite || config.sections.chartQualite) && (
          <View style={styles.chartsRow}>
            {config.sections.chartQuantite && (
              <View style={styles.chartHalf}>
                <Text style={styles.chartTitle}>Quantité par Trimestre</Text>
                <BarChart 
                  data={quantiteChartData}
                  maxValue={120}
                  threshold={100}
                  color1={config.colors.secondary}
                  color2={config.colors.primary}
                  thresholdColor={config.colors.threshold}
                  showLegend={true}
                  legend1="Tel"
                  legend2="Mail"
                  width={250}
                />
              </View>
            )}
            {config.sections.chartQualite && (
              <View style={styles.chartHalf}>
                <Text style={styles.chartTitle}>Qualité par Trimestre</Text>
                <BarChart 
                  data={qualiteChartData}
                  maxValue={120}
                  threshold={100}
                  color1={config.colors.secondary}
                  color2={config.colors.primary}
                  thresholdColor={config.colors.threshold}
                  showLegend={true}
                  legend1="Tel"
                  legend2="Mail"
                  width={250}
                />
              </View>
            )}
          </View>
        )}

        {/* Table */}
        {config.sections.tableMonthly && (
          <View style={styles.tableSection}>
            <Text style={styles.sectionTitle}>Détail Mensuel</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                {config.tableColumns.periode && (
                  <Text style={[styles.tableHeaderCell, { width: colWidth }]}>Mois</Text>
                )}
                {config.tableColumns.jours && (
                  <Text style={[styles.tableHeaderCell, { width: colWidth, textAlign: 'right' }]}>Jours</Text>
                )}
                {config.tableColumns.qteTel && (
                  <Text style={[styles.tableHeaderCell, { width: colWidth, textAlign: 'right' }]}>Qté Tel</Text>
                )}
                {config.tableColumns.qteMail && (
                  <Text style={[styles.tableHeaderCell, { width: colWidth, textAlign: 'right' }]}>Qté Mail</Text>
                )}
                {config.tableColumns.qleTel && (
                  <Text style={[styles.tableHeaderCell, { width: colWidth, textAlign: 'right' }]}>Qlé Tel</Text>
                )}
                {config.tableColumns.qleMail && (
                  <Text style={[styles.tableHeaderCell, { width: colWidth, textAlign: 'right' }]}>Qlé Mail</Text>
                )}
                {config.tableColumns.prime && (
                  <Text style={[styles.tableHeaderCell, { width: colWidth, textAlign: 'right' }]}>Prime</Text>
                )}
                {config.tableColumns.proportion && (
                  <Text style={[styles.tableHeaderCell, { width: colWidth, textAlign: 'right' }]}>Prop.</Text>
                )}
              </View>
              
              {monthlyRows.slice(0, 12).map((row, index) => (
                <View 
                  key={row.Pde} 
                  style={[
                    styles.tableRow,
                    index % 2 === 1 ? styles.tableRowAlt : {}
                  ]}
                >
                  {config.tableColumns.periode && (
                    <Text style={[styles.tableCell, { width: colWidth }]}>{row.Pde}</Text>
                  )}
                  {config.tableColumns.jours && (
                    <Text style={[styles.tableCell, { width: colWidth, textAlign: 'right' }]}>
                      {parseNumber(row['JW Pointés']).toFixed(0)}
                    </Text>
                  )}
                  {config.tableColumns.qteTel && (
                    <Text style={[styles.tableCell, { width: colWidth, textAlign: 'right' }]}>
                      {parseNumber(row['Moy. Qté ☎']).toFixed(1)}
                    </Text>
                  )}
                  {config.tableColumns.qteMail && (
                    <Text style={[styles.tableCell, { width: colWidth, textAlign: 'right' }]}>
                      {parseNumber(row['Moy. Qté ✉@']).toFixed(1)}
                    </Text>
                  )}
                  {config.tableColumns.qleTel && (
                    <Text style={[styles.tableCell, { width: colWidth, textAlign: 'right' }]}>
                      {formatPercent(parseNumber(row['Moy.Qlé ☎']))}
                    </Text>
                  )}
                  {config.tableColumns.qleMail && (
                    <Text style={[styles.tableCell, { width: colWidth, textAlign: 'right' }]}>
                      {formatPercent(parseNumber(row['Moy.Qlé ✉@']))}
                    </Text>
                  )}
                  {config.tableColumns.prime && (
                    <Text style={[styles.tableCell, { width: colWidth, textAlign: 'right' }]}>
                      {formatCurrency(parseNumber(row['✉ Réelle €']))}
                    </Text>
                  )}
                  {config.tableColumns.proportion && (
                    <Text style={[styles.tableCell, { width: colWidth, textAlign: 'right' }]}>
                      {row['Prop. € SC']}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>{footerLeft}</Text>
          <Text>{config.footerRight}</Text>
        </View>
      </Page>
    </Document>
  );
}
