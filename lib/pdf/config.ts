/**
 * @file lib/pdf/config.ts
 * @description Configuration du template PDF PQS
 */

export interface PDFTemplateConfig {
  // Métadonnées
  title: string;
  subtitle: string;
  footerLeft: string;
  footerRight: string;

  // Couleurs
  colors: {
    primary: string;      // Couleur principale (barres, headers)
    secondary: string;    // Couleur secondaire (barres groupées)
    accent: string;       // Couleur accent (nom agent)
    threshold: string;    // Couleur ligne seuil
  };

  // Sections à afficher
  sections: {
    kpis: boolean;
    chartPrimes: boolean;
    chartQuantite: boolean;
    chartQualite: boolean;
    tableMonthly: boolean;
  };

  // Colonnes du tableau mensuel
  tableColumns: {
    periode: boolean;
    jours: boolean;
    qteTel: boolean;
    qteMail: boolean;
    qleTel: boolean;
    qleMail: boolean;
    prime: boolean;
    proportion: boolean;
  };

  // KPIs à afficher
  kpis: {
    primeTrimestreCours: boolean;
    proportionPrime: boolean;
    totalAnnee: boolean;
    joursTravailles: boolean;
    primeMax: boolean;
    primeMoyenne: boolean;
    primeMin: boolean;
  };
}

// Configuration par défaut
export const DEFAULT_CONFIG: PDFTemplateConfig = {
  title: 'Votre Bilan Prime de Qualité de Service 2025',
  subtitle: '',
  footerLeft: 'Généré le {date}',
  footerRight: 'RATP - Service Client',

  colors: {
    primary: '#0891b2',
    secondary: '#eab308',
    accent: '#7c3aed',
    threshold: '#f97316',
  },

  sections: {
    kpis: true,
    chartPrimes: true,
    chartQuantite: true,
    chartQualite: true,
    tableMonthly: true,
  },

  tableColumns: {
    periode: true,
    jours: true,
    qteTel: true,
    qteMail: true,
    qleTel: true,
    qleMail: true,
    prime: true,
    proportion: true,
  },

  kpis: {
    primeTrimestreCours: true,
    proportionPrime: true,
    totalAnnee: true,
    joursTravailles: true,
    primeMax: true,
    primeMoyenne: true,
    primeMin: true,
  },
};

// Libellés pour l'interface
export const CONFIG_LABELS = {
  sections: {
    kpis: 'Indicateurs clés (KPIs)',
    chartPrimes: 'Graphique Primes Trimestrielles',
    chartQuantite: 'Graphique Quantité',
    chartQualite: 'Graphique Qualité',
    tableMonthly: 'Tableau détail mensuel',
  },
  tableColumns: {
    periode: 'Période',
    jours: 'Jours travaillés',
    qteTel: 'Quantité Téléphone',
    qteMail: 'Quantité Mail',
    qleTel: 'Qualité Téléphone',
    qleMail: 'Qualité Mail',
    prime: 'Prime (€)',
    proportion: 'Proportion (%)',
  },
  kpis: {
    primeTrimestreCours: 'Prime trimestre en cours',
    proportionPrime: 'Proportion prime moyenne',
    totalAnnee: 'Total annuel',
    joursTravailles: 'Jours travaillés',
    primeMax: 'Prime maximum',
    primeMoyenne: 'Prime moyenne',
    primeMin: 'Prime minimum',
  },
  colors: {
    primary: 'Couleur principale',
    secondary: 'Couleur secondaire',
    accent: 'Couleur accent',
    threshold: 'Couleur seuil',
  },
};
