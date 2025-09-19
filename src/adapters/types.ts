export interface ParsedRow {
  date: string;
  interval_values: number[]; //KWHs
  type: 'E2' | 'E1';
  nmi: string;
  meterSerial: string;
  estimated: boolean;
}