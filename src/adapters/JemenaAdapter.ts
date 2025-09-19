import { BaseAdapter } from './BaseAdapter';
import { ParsedRow } from './types';

/**
 * Adapter for converting Jemena/AusNet files to NEM12 format.
 */
export class JemenaAdapter extends BaseAdapter {
  
  getIntervalLength(fileContent: Buffer): number {
    const text = fileContent.toString();
    const lines = text.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
    if (lines.length < 1) throw new Error('No header found');
    const header = lines[0].split(',');
    // Find all interval columns (e.g., "00:00 - 00:30")
    const intervalCols = header.filter((h: string) => /\d{2}:\d{2} - \d{2}:\d{2}/.test(h));
    if (intervalCols.length < 1) throw new Error('No interval columns found');
    // Parse first interval
    const match = intervalCols[0].match(/(\d{2}):(\d{2}) - (\d{2}):(\d{2})/);
    if (!match) throw new Error('Malformed interval column');
    const startHour = parseInt(match[1], 10);
    const startMin = parseInt(match[2], 10);
    const endHour = parseInt(match[3], 10);
    const endMin = parseInt(match[4], 10);
    const start = startHour * 60 + startMin;
    const end = endHour * 60 + endMin;
    let intervalLength = end - start;
    if (intervalLength <= 0) intervalLength += 1440; // handle midnight wrap
    // Optionally check all intervals are consistent
    for (const col of intervalCols) {
      const m = col.match(/(\d{2}):(\d{2}) - (\d{2}):(\d{2})/);
      if (!m) throw new Error('Malformed interval column');
      const s = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      const e = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
      let len = e - s;
      if (len <= 0) len += 1440;
      if (len !== intervalLength) throw new Error('Inconsistent interval lengths detected');
    }
    return intervalLength;
  }

  isValid(fileContent: Buffer): boolean {
    const text = fileContent.toString();
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return false;
    const header = lines[0].trim();
    if (!header.startsWith('NMI,METER SERIAL NUMBER,CON/GEN,DATE,ESTIMATED?')) return false;
    // Check for at least one data row with expected format
    return lines.slice(1).some(line => {
      const cols = line.split(',');
      return cols.length > 10 &&
        (cols[2] === 'Consumption' || cols[2] === 'Controlled Load Consumption') &&
        /^\d{4}-\d{2}-\d{2}$/.test(cols[3]);
    });
  }

  parseRows(fileContent: Buffer): Array<ParsedRow> {
    const text = fileContent.toString();
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    const header = lines[0].split(',');
    // Find where interval columns start (first time range column)
    const intervalStartIdx = header.findIndex(h => /\d{2}:\d{2} - \d{2}:\d{2}/.test(h));
    return lines.slice(1).map(line => {
      const cols = line.split(',');
      const nmi = cols[0];
      const meterSerial = cols[1];
      const type = { 'Consumption': 'E1', 'Controlled Load Consumption': 'E2' }[cols[2]] ?? undefined;
      const date = cols[3];
      const estimated = (cols[4] || '').toLowerCase() === 'yes';
      const interval_values = cols.slice(intervalStartIdx).map(v => {
        const num = Number(v);
        return isNaN(num) ? 0 : num;
      });
      return {
        date,
        interval_values,
        type,
        nmi,
        meterSerial,
        estimated,
      } as ParsedRow;
    }).filter(r => r.type !== undefined); // filter out unknown consumption types
  }
}
