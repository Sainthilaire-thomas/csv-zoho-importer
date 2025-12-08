/**
 * @file lib/pdf/types.ts
 * @description Types pour la génération PDF PQS
 */

export interface AgentInfo {
  nom: string;
  matricule: string;
  email?: string;
}

export interface PQSRow {
  Nom: string;
  Mle: string;
  Statut: string;
  Fct: string;
  Pde: string;  // Période: "01-2025", "T1-2025", etc.
  
  // Jours travaillés
  'JW Pointés': string;
  'JW C3T': string;
  
  // Barèmes Quantité
  'Bar. Qté ☎': string;
  'Bar. Qté ✉@': string;
  
  // Barèmes Qualité
  'Bar. Qlé ☎': string;
  'Bar. Qlé ✉@': string;
  
  // Moyennes Quantité
  'Moy. Qté ☎': string;
  'Moy. Qté ✉@': string;
  
  // Moyennes Qualité
  'Moy.Qlé ☎': string;
  'Moy.Qlé ✉@': string;
  
  // Activités
  'Act. ☎': string;
  'Act. ✉@': string;
  'Act. LOG': string;
  'Ttl Activités': string;
  
  // Primes
  'Prop. € SC': string;
  'Prop. € C3T': string;
  '✉ Réelle €': string;
  '✉ Théorique €': string;
  
  // Performance
  'N_Perf.Qlé': string;
  'N_Perf.Qté': string;
  
  [key: string]: string;
}

export interface PQSReportData {
  agent: AgentInfo;
  rows: PQSRow[];
  generatedAt: Date;
}
