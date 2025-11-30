// lib/domain/validation/rules/required.ts
import { ValidationRuleBase, type ValidationRuleConfig } from './base';
import type { RuleType } from '@/types';

export class RequiredRule extends ValidationRuleBase {
  readonly type: RuleType = 'required';
  readonly defaultMessage = 'Ce champ est requis';

  constructor(config: Omit<ValidationRuleConfig, 'type'>) {
    super({ ...config, type: 'required' });
  }

  validate(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    return true;
  }
}
