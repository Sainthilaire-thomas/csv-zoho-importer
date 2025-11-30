// lib/hooks/use-csv-parser.ts
'use client';

import { useCallback } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ParseResult {
  data: Record<string, unknown>[];
  headers: string[];
  totalRows: number;
  fileName: string;
  fileType: 'csv' | 'xlsx' | 'xls';
}

export interface ParseError {
  message: string;
  details?: string[];
}

export function useCsvParser() {
  const parseFile = useCallback(async (file: File): Promise<ParseResult> => {
    const fileName = file.name;
    const extension = fileName.split('.').pop()?.toLowerCase();

    console.log('Parsing fichier:', fileName, 'extension:', extension);

    if (extension === 'csv') {
      return parseCsv(file);
    } else if (extension === 'xlsx' || extension === 'xls') {
      return parseExcel(file);
    } else {
      throw new Error(`Format non supporte: .${extension}`);
    }
  }, []);

  return { parseFile };
}

async function parseCsv(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      complete: (results) => {
        console.log('CSV parse complete, rows:', results.data.length);
        
        if (results.errors.length > 0) {
          const criticalErrors = results.errors.filter(
            (e) => e.type === 'Quotes' || e.type === 'FieldMismatch'
          );
          if (criticalErrors.length > 0) {
            reject(new Error(`Erreur CSV: ${criticalErrors[0].message}`));
            return;
          }
        }

        const headers = results.meta.fields || [];
        
        resolve({
          data: results.data,
          headers,
          totalRows: results.data.length,
          fileName: file.name,
          fileType: 'csv',
        });
      },
      error: (error) => {
        reject(new Error(`Erreur parsing CSV: ${error.message}`));
      },
    });
  });
}

async function parseExcel(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      console.log('Fichier Excel charge, debut du parsing...');
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        console.log('Feuille:', firstSheetName);
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: '',
        });

        console.log('Excel parse complete, rows:', jsonData.length);

        const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

        resolve({
          data: jsonData,
          headers,
          totalRows: jsonData.length,
          fileName: file.name,
          fileType: file.name.endsWith('.xlsx') ? 'xlsx' : 'xls',
        });
      } catch (error) {
        console.error('Erreur parsing Excel:', error);
        reject(new Error(`Erreur parsing Excel: ${error instanceof Error ? error.message : 'Erreur inconnue'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erreur lecture du fichier'));
    };

    reader.readAsArrayBuffer(file);
  });
}
