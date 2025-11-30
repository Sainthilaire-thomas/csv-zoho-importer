// lib/domain/validation/rules/email.ts
import { ValidationRuleBase, type ValidationRuleConfig } from './base';
import type { RuleType } from '@/types';

export class EmailRule extends ValidationRuleBase {
  readonly type: RuleType = 'email';
  readonly defaultMessage = 'Format email invalide';

  // Regex standard pour validation email
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(config: Omit<ValidationRuleConfig, 'type'>) {
    super({ ...config, type: 'email' });
  }

  validate(value: unknown): boolean {
    if (value === null || value === undefined || value === '') {
      return true; // Les champs vides sont gérés par RequiredRule
    }

    const strValue = String(value).trim().toLowerCase();

    return this.emailRegex.test(strValue);
  }
}
