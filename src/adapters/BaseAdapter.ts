import { Adapter } from './Adapter';
import { ParsedRow } from './types';
import { Nem12File, Record100, Record200, Record300, withNem12ToString } from '../nem12/types';

export abstract class BaseAdapter implements Adapter {
  /**
   * Parses file contents and returns array of daily `ParsedRow` data objects.
   */
  abstract parseRows(fileContent: Buffer): ParsedRow[];

  /**
   * Returns `true` if the adapter can process the file.
   */
  abstract isValid(fileContent: Buffer): boolean;

  /**
   * Determines interval length (in minutes) from `fileContent`.
   * Returns interval length in minutes, or throws if inconsistent or not found.
   */
  abstract getIntervalLength(fileContent: Buffer): number;

  /**
   * Assembles the Nem12File object from parsed rows and interval length.
   */
  assembleNem12File(
    rows: Array<ParsedRow>,
    intervalLength: number
  ): Nem12File {
    const { header, nmiHeaders } = this.generateNem12HeaderAndMeterBlocks(rows, intervalLength);
    const intervals = this.mapToNem12Intervals(rows, intervalLength);
  const nmis: Array<{ nmiHeader: Record200; intervalBlocks: Record300[] }> = [];
    nmiHeaders.forEach((header) => {
      if (header.nmiConfiguration === 'E1' && intervals.E1.length > 0) {
        nmis.push({ nmiHeader: header, intervalBlocks: intervals.E1 });
      }
      if (header.nmiConfiguration === 'E2' && intervals.E2.length > 0) {
        nmis.push({ nmiHeader: header, intervalBlocks: intervals.E2 });
      }
    });
    return {
      header,
      nmis,
      trailer: { recordIndicator: '900' },
      toString() {
        return withNem12ToString(this).toString();
      }
    };
  }
  /**
   * Generates NEM12 header and meter blocks for E1 and E2 loads.
   */
  generateNem12HeaderAndMeterBlocks(
    rows: Array<ParsedRow>,
    intervalLength: number
  ): {
    header: Record100;
    nmiHeaders: Record200[];
  } {
    // Find min date from data
    const minDateStr = rows.length > 0 ? rows[0].date : '';
    const minDate = minDateStr ? new Date(minDateStr) : new Date();
    minDate.setHours(0, 0, 0, 0);

    const header = {
      recordIndicator: '100' as const,
      versionHeader: 'NEM12',
      dateTime: minDate,
      fromParticipant: 'SPANMDP',
      toParticipant: 'SPANMDP',
    };

    // E1 and E2 meter blocks, only if there is data
    const nmi = rows.length > 0 ? rows[0].nmi : '9999999999';
    const meterSerialNumber = rows.length > 0 ? rows[0].meterSerial : '55555555';
    const uom = 'KWH';
    const hasE1 = rows.some(r => r.type === 'E1');
    const hasE2 = rows.some(r => r.type === 'E2');
    const nmiHeaders: Record200[] = [];
    if (hasE1) {
      nmiHeaders.push({
        recordIndicator: '200' as const,
        nmi,
        nmiConfiguration: 'E1',
        registerId: 'E1',
        nmiSuffix: 'E1',
        mdmDataStreamIdentifier: '',
        meterSerialNumber,
        uom,
        intervalLength,
        nextScheduledReadDate: undefined,
      });
    }
    if (hasE2) {
      nmiHeaders.push({
        recordIndicator: '200' as const,
        nmi,
        nmiConfiguration: 'E2',
        registerId: 'E2',
        nmiSuffix: 'E2',
        mdmDataStreamIdentifier: '',
        meterSerialNumber,
        uom,
        intervalLength,
        nextScheduledReadDate: undefined,
      });
    }
    return { header, nmiHeaders };
  }
  /**
   * Maps parsed rows to NEM12 Record300 interval records for E1 and E2 loads.
   * Returns: { E1: Record300[], E2: Record300[] }
   */
  mapToNem12Intervals(
    rows: Array<ParsedRow>,
    intervalLength: number
  ): { E1: Record300[]; E2: Record300[] } {
    // Group rows by type and date
    const grouped: { [load: string]: { [date: string]: Array<typeof rows[0]> } } = { E1: {}, E2: {} };
    rows.forEach(row => {
      const date = row.date.replace(/-/g, ''); // YYYYMMDD
      const loadType = row.type;
      if (!grouped[loadType][date]) grouped[loadType][date] = [];
      grouped[loadType][date].push(row);
    });

    function buildBlocks(loadType: 'E1' | 'E2') {
      return Object.entries(grouped[loadType]).map(([date, dayRows]) => {
        const intervalValues: (number | null)[] = dayRows[0]?.interval_values ? [...dayRows[0].interval_values] : [];
        // Pad missing intervals with zero if needed
        const expectedIntervals = Math.round(1440 / intervalLength);
        while (intervalValues.length < expectedIntervals) intervalValues.push(0);
        return {
          recordIndicator: '300' as const,
          intervalDate: date,
          intervalValues,
          qualityMethod: 'A', // Actual
        };
      });
    }

    return {
      E1: buildBlocks('E1'),
      E2: buildBlocks('E2'),
    };
  }

    /**
   * Converts CSV buffer to Nem12File, with error handling.
   */
  convertToNem12(fileContent: Buffer): Nem12File {
    try {
      const rows =this.parseRows(fileContent);
      if (!rows.length) throw new Error('No valid data rows found');
      const intervalLength = this.getIntervalLength(fileContent);
      return this.assembleNem12File(rows, intervalLength);
    } catch (err: any) {
      throw new Error(`Failed to convert CSV to Nem12File: ${err.message}`);
    }
  }
}