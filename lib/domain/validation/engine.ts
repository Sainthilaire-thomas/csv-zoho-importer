// lib/domain/validation/engine.ts
import type {
  ValidationResult,
  ValidationError,
  TableValidationConfig,
  ColumnValidationConfig,
  ParsedRow,
  RuleType,
} from '@/types';
import {
  ValidationRuleBase,
  RequiredRule,
  DateRule,
  NumberRule,
  EmailRule,
} from './rules';

type RuleConstructor = new (config: { enabled: boolean; params?: Record<string, unknown>; message?: string }) => ValidationRuleBase;

export class ValidationEngine {
  private ruleRegistry: Map<RuleType, RuleConstructor> = new Map();

  constructor() {
    this.registerBuiltInRules();
  }

  private registerBuiltInRules(): void {
    this.ruleRegistry.set('required', RequiredRule);
    this.ruleRegistry.set('date', DateRule);
    this.ruleRegistry.set('number', NumberRule);
    this.ruleRegistry.set('email', EmailRule);
  }

  registerRule(type: RuleType, constructor: RuleConstructor): void {
    this.ruleRegistry.set(type, constructor);
  }

  validate(
    data: Record<string, unknown>[],
    config: TableValidationConfig
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const parsedRows: ParsedRow[] = [];
    let validRows = 0;
    let errorRows = 0;

    // Créer un map des règles par colonne
    const columnRulesMap = new Map<string, ValidationRuleBase[]>();
    
    for (const columnConfig of config.columns) {
      const rules: ValidationRuleBase[] = [];
      
      for (const ruleConfig of columnConfig.rules) {
        const RuleClass = this.ruleRegistry.get(ruleConfig.type);
        if (RuleClass && ruleConfig.enabled) {
          rules.push(
            new RuleClass({
              enabled: ruleConfig.enabled,
              params: ruleConfig.params,
              message: ruleConfig.message,
            })
          );
        }
      }
      
      columnRulesMap.set(columnConfig.columnName, rules);
    }

    // Valider chaque ligne
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const lineNumber = i + 2; // +2 car ligne 1 = headers, index commence à 0
      const rowErrors: ValidationError[] = [];

      // Valider chaque colonne configurée
      for (const [columnName, rules] of columnRulesMap) {
        const value = row[columnName];

        for (const rule of rules) {
          const error = rule.execute({
            line: lineNumber,
            column: columnName,
            value,
          });

          if (error) {
            rowErrors.push(error);
            errors.push(error);
          }
        }
      }

      const isRowValid = rowErrors.length === 0;

      if (isRowValid) {
        validRows++;
      } else {
        errorRows++;
      }

      // Ajouter à parsedRows pour preview (limiter à 50 lignes)
      if (parsedRows.length < 50) {
        parsedRows.push({
          _lineNumber: lineNumber,
          _isValid: isRowValid,
          _errors: rowErrors,
          ...row,
        });
      }
    }

    return {
      isValid: errorRows === 0,
      totalRows: data.length,
      validRows,
      errorRows,
      errors,
      preview: parsedRows,
    };
  }
}

// Export une instance singleton
export const validationEngine = new ValidationEngine();
