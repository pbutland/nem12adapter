import { BaseAdapter } from './BaseAdapter';
import { ParsedRow } from './types';
import { Nem12File, Record100, Record200, Record300, Record400, Record900, withNem12ToString } from '../nem12/types';

/**
 * Adapter for converting Powerpal files to NEM12 format.
 */
export class PowerpalAdapter extends BaseAdapter {

  isValid(fileContent: Buffer): boolean {
    const text = fileContent.toString();
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return false;
    const header = lines[0].trim();
    if (!header.startsWith('datetime_utc,datetime_local,watt_hours,cost_dollars,is_peak')) return false;
    // Check for at least one data row with expected format
    return lines.slice(1).some(line => {
      const cols = line.split(',');
      return cols.length === 5 &&
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(cols[0]) &&
        !isNaN(Number(cols[2]));
    });
  }

  getIntervalLength(fileContent: Buffer): number {
    const text = fileContent.toString();
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return 0;
    const header = lines[0].trim();
    if (!header.startsWith('datetime_utc,datetime_local,watt_hours,cost_dollars,is_peak')) return 0;
    let firstDate: Date | null = null;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length !== 5) continue;
      const dtStr = cols[0];
      const dt = new Date(dtStr.replace(' ', 'T'));
      if (isNaN(dt.getTime())) continue;
      if (!firstDate) {
        firstDate = dt;
        continue;
      }
      const diffMs = dt.getTime() - firstDate.getTime();
      if (diffMs > 0) {
        return Math.round(diffMs / 60000); // ms to minutes
      }
    }
    return 0;
  }

  parseRows(fileContent: Buffer): Array<ParsedRow> {
    const text = fileContent.toString();
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];
    const header = lines[0].trim();
    if (!header.startsWith('datetime_utc,datetime_local,watt_hours,cost_dollars,is_peak')) return [];
    const nmi = '9999999999';
    const meterSerial = '55555555';
    const estimated = false;
    // Group intervals by date
    const dayMap: Record<string, number[]> = {};
    lines.slice(1).forEach(line => {
      const cols = line.split(',');
      if (cols.length !== 5) return;
      const date = cols[0].slice(0, 10);
      const value = parseFloat(cols[2]);
      if (!date || isNaN(value)) return;
      if (!dayMap[date]) dayMap[date] = [];
      // Convert watt hours to kilowatt hours by dividing by 1000
      dayMap[date].push(value / 1000);
    });
    return Object.entries(dayMap).map(([date, interval_values]) => ({
      date,
      interval_values,
      type: 'E1',
      nmi,
      meterSerial,
      estimated,
    }));
  }
}
