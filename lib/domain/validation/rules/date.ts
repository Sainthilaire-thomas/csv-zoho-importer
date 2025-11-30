// lib/domain/validation/rules/date.ts
import { ValidationRuleBase, type ValidationRuleConfig } from './base';
import type { RuleType } from '@/types';

interface DateRuleParams {
  formats?: string[];
  min?: string;
  max?: string;
}

export class DateRule extends ValidationRuleBase {
  readonly type: RuleType = 'date';
  readonly defaultMessage = 'Format de date invalide';

  private readonly defaultFormats = [
    'DD/MM/YYYY',
    'YYYY-MM-DD',
    'DD-MM-YYYY',
    'MM/DD/YYYY',
  ];

  constructor(config: Omit<ValidationRuleConfig, 'type'>) {
    super({ ...config, type: 'date' });
  }

  validate(value: unknown, params?: DateRuleParams): boolean {
    if (value === null || value === undefined || value === '') {
      return true; // Les champs vides sont gérés par RequiredRule
    }

    const strValue = String(value).trim();
    const formats = params?.formats ?? this.defaultFormats;

    // Essayer de parser la date avec chaque format
    for (const format of formats) {
      if (this.matchesFormat(strValue, format)) {
        const parsedDate = this.parseDate(strValue, format);
        if (parsedDate && this.isValidDate(parsedDate)) {
          // Vérifier min/max si définis
          if (params?.min && parsedDate < this.parseDate(params.min, format)!) {
            return false;
          }
          if (params?.max && parsedDate > this.parseDate(params.max, format)!) {
            return false;
          }
          return true;
        }
      }
    }

    return false;
  }

  private matchesFormat(value: string, format: string): boolean {
    const patterns: Record<string, RegExp> = {
      'DD/MM/YYYY': /^\d{2}\/\d{2}\/\d{4}$/,
      'YYYY-MM-DD': /^\d{4}-\d{2}-\d{2}$/,
      'DD-MM-YYYY': /^\d{2}-\d{2}-\d{4}$/,
      'MM/DD/YYYY': /^\d{2}\/\d{2}\/\d{4}$/,
    };

    return patterns[format]?.test(value) ?? false;
  }

  private parseDate(value: string, format: string): Date | null {
    try {
      let day: number, month: number, year: number;

      switch (format) {
        case 'DD/MM/YYYY':
        case 'DD-MM-YYYY':
          [day, month, year] = value.split(/[\/\-]/).map(Number);
          break;
        case 'YYYY-MM-DD':
          [year, month, day] = value.split('-').map(Number);
          break;
        case 'MM/DD/YYYY':
          [month, day, year] = value.split('/').map(Number);
          break;
        default:
          return null;
      }

      const date = new Date(year, month - 1, day);
      return date;
    } catch {
      return null;
    }
  }

  private isValidDate(date: Date): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }
}
