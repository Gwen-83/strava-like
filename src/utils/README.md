# Utils - Architecture nettoyée

## Structure organisée par responsabilité

### Constants & Configuration
- **`constants.ts`** - Constantes globales (vitesses de ref, facteurs, seuils FTP)
- **`dateHelpers.ts`** - Utilitaires pour la manipulation des dates

### Calculations centralisées
- **`trainingLoadCalculator.ts`** - Moteur principal de calcul
  - Charge d'entraînement (training load)
  - Références de vitesse par sport
  - Statistiques d'activités
  - Métriques agrégées

### Agrégations & Comparaisons
- **`aggregates.ts`** - Groupement des données par période
  - Distance par semaine
  - Dénivelé par mois
  - Charge d'entraînement
  
- **`comparisons.ts`** - Comparaisons périodiques
  - Actuelle vs précédente période
  - Filtrage par période

### Prédictions de Performance
- **`performanceCoherence.ts`** - Analyse de cohérence
  - Score de consistance d'entraînement sur 3 semaines
  
- **`performanceRunning.ts`** - Prédictions course à pied
  - Temps normalisé au dénivelé
  - Estimation Riegel
  - Prédictions multidistances
  
- **`performanceCycling.ts`** - Estimation FTP cyclisme
  - Estimation FTP (Functional Threshold Power)
  - Calibration FTP
  - Prédictions puissance

### Façade & Rétro-compatibilité
- **`activityAnalytics.ts`** - Réexporte depuis trainingLoadCalculator (backwards compat)
- **`guess.ts`** - Point d'entrée pour les prédictions consolidées

## Dépendances

```
guess.ts (façade)
├── performanceCoherence.ts
├── performanceRunning.ts
├── performanceCycling.ts
└── trainingLoadCalculator.ts
    ├── constants.ts
    ├── dateHelpers.ts
    └── trainingLoadCalculator.ts

aggregates.ts
├── trainingLoadCalculator.ts
└── dateHelpers.ts

comparisons.ts
├── trainingLoadCalculator.ts
└── dateHelpers.ts

activityAnalytics.ts (compat)
└── trainingLoadCalculator.ts
```

## Usage

```typescript
// Import depuis guess (point d'entrée recommandé)
import { predictPerformance, computeCoherence } from "../utils/guess"

// Ou directement depuis les modules spécialisés
import { estimateCyclingFTP } from "../utils/performanceCycling"
import { groupByWeek } from "../utils/aggregates"
import { computeRefSpeeds } from "../utils/trainingLoadCalculator"
```
