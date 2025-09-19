import { BaseAdapter } from '../BaseAdapter';
import { ParsedRow } from '../types';

// Minimal concrete subclass for testing BaseAdapter
export class TestAdapter extends BaseAdapter {
  parseRows(fileContent: Buffer): ParsedRow[] {
    // Return a fixed set of rows for testing
    return [
      {
        date: '2023-01-01',
        interval_values: [1, 2, 3],
        type: 'E1',
        nmi: 'TESTNMI',
        meterSerial: 'TESTSERIAL',
        estimated: false,
      },
      {
        date: '2023-01-01',
        interval_values: [4, 5, 6],
        type: 'E2',
        nmi: 'TESTNMI',
        meterSerial: 'TESTSERIAL',
        estimated: true,
      }
    ];
  }
  isValid(fileContent: Buffer): boolean {
    return true;
  }
  getIntervalLength(rows: ParsedRow[] | Buffer): number {
    return 30;
  }
}
