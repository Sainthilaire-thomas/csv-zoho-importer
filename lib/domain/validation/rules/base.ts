// lib/domain/validation/rules/base.ts
import type { RuleType, ValidationError } from '@/types';

export interface ValidationContext {
  line: number;
  column: string;
  value: unknown;
}

export interface ValidationRuleConfig {
  type: RuleType;
  enabled: boolean;
  params?: Record<string, unknown>;
  message?: string;
}

export abstract class ValidationRuleBase {
  abstract readonly type: RuleType;
  abstract readonly defaultMessage: string;

  protected config: ValidationRuleConfig;

  constructor(config: ValidationRuleConfig) {
    this.config = config;
  }

  abstract validate(value: unknown, params?: Record<string, unknown>): boolean;

  execute(context: ValidationContext): ValidationError | null {
    if (!this.config.enabled) {
      return null;
    }

    const isValid = this.validate(context.value, this.config.params);

    if (isValid) {
      return null;
    }

    return {
      line: context.line,
      column: context.column,
      value: String(context.value ?? ''),
      rule: this.type,
      message: this.config.message ?? this.defaultMessage,
    };
  }
}
