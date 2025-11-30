// lib/domain/validation/rules/number.ts
import { ValidationRuleBase, type ValidationRuleConfig } from './base';
import type { RuleType } from '@/types';

interface NumberRuleParams {
  min?: number;
  max?: number;
  integer?: boolean;
  positive?: boolean;
  decimalSeparator?: '.' | ',';
}

export class NumberRule extends ValidationRuleBase {
  readonly type: RuleType = 'number';
  readonly defaultMessage = 'Doit être un nombre valide';

  constructor(config: Omit<ValidationRuleConfig, 'type'>) {
    super({ ...config, type: 'number' });
  }

  validate(value: unknown, params?: NumberRuleParams): boolean {
    if (value === null || value === undefined || value === '') {
      return true; // Les champs vides sont gérés par RequiredRule
    }

    let strValue = String(value).trim();

    // Gérer le séparateur décimal
    const separator = params?.decimalSeparator ?? ',';
    if (separator === ',') {
      strValue = strValue.replace(',', '.');
    }

    // Supprimer les espaces (séparateurs de milliers)
    strValue = strValue.replace(/\s/g, '');

    const num = parseFloat(strValue);

    if (isNaN(num)) {
      return false;
    }

    // Vérifier si c'est un entier
    if (params?.integer && !Number.isInteger(num)) {
      return false;
    }

    // Vérifier si positif
    if (params?.positive && num < 0) {
      return false;
    }

    // Vérifier min
    if (params?.min !== undefined && num < params.min) {
      return false;
    }

    // Vérifier max
    if (params?.max !== undefined && num > params.max) {
      return false;
    }

    return true;
  }
}
