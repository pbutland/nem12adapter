import { BaseAdapter } from './BaseAdapter';

/**
 * Adapter for converting Origin files to NEM12 format.
 */
export class OriginAdapter extends BaseAdapter {

  isValid(fileContent: Buffer): boolean {
    const text = fileContent.toString();
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return false;
    const header = lines[0].trim();
    if (!header.startsWith('Usage Type,Amount Used,From (date/time),To (date/time)')) return false;
    // Check for at least one data row with expected format
    return lines.slice(1).some(line => {
      const cols = line.split(',');
      return cols.length === 4 &&
        cols[0] === 'Consumption' &&
        /T\d{2}:\d{2}:\d{2}/.test(cols[2]) &&
        /T\d{2}:\d{2}:\d{2}/.test(cols[3]);
    });
  }

  getIntervalLength(fileContent: Buffer): number {
    const text = fileContent.toString();
    const lines = text.split(/\r?\n/).slice(1).filter(l => l.trim()); // skip header
    for (const line of lines) {
      const cols = line.split(',');
      if (cols.length !== 4) continue;
      // From (date/time) is cols[2], To (date/time) is cols[3]
      const from = new Date(cols[2]);
      const to = new Date(cols[3]);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) continue;
      const diff = (to.getTime() - from.getTime()) / 60000;
      if (diff > 0) return Math.round(diff);
    }
    throw new Error('Unable to determine interval length from file content');
  }

  parseRows(fileContent: Buffer): Array<import('./types').ParsedRow> {
    const text = fileContent.toString();
    const lines = text.split(/\r?\n/).slice(1).filter(l => l.trim()); // skip header
    const nmi = '9999999999';
    const meterSerial = '55555555';
    // Group intervals by day
    const dayMap: Record<string, number[]> = {};
    lines.forEach(line => {
      const cols = line.split(',');
      if (cols.length !== 4) return;
      const date = cols[2].slice(0, 10); // From (date/time) column
      const value = parseFloat(cols[1]);
      if (!date || isNaN(value)) return;
      if (!dayMap[date]) dayMap[date] = [];
      dayMap[date].push(value);
    });
    // Use 'E1' as type for all rows (or could alternate if needed)
    return Object.entries(dayMap).map(([date, interval_values]) => ({
      date,
      interval_values,
      type: 'E1',
      nmi,
      meterSerial,
      estimated: false,
    }));
  }
}
