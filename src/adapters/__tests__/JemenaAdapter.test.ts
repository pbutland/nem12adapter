import fs from 'fs';
import path from 'path';
import { JemenaAdapter } from '../JemenaAdapter';
import { ParsedRow } from '../types';

describe('JemenaAdapter', () => {
  it('isValid: returns true for valid Jemena CSV', () => {
    const valid = Buffer.from(
      'NMI,METER SERIAL NUMBER,CON/GEN,DATE,ESTIMATED?\n9999999999,55555555,Consumption,2023-07-19,No,0.0562,0.0250,0.0187,0.0125,0.0125,0.0062,0.0125,0.0125,0.0125,0.0125,0.0062,0.0125,0.1250,0.7437,0.5625,0.0187,0.0625,0.0562,0.0562,0.2437,0.3375,0.0625,0.0562,0.1250,0.0625,0.0562,0.0562,0.1875,0.0562,0.0562,0.0562,0.0562,0.0562,0.0562,0.1750,0.0437,0.2000,0.0562,0.0437,0.0937,0.0937,0.0500,0.0437,0.0500,0.3562,0.5250,0.0312,0.0125'
    );
    expect(new JemenaAdapter().isValid(valid)).toBe(true);
  });

  it('isValid: returns false for invalid CSV', () => {
    const invalid = Buffer.from('foo,bar,baz\n1,2,3');
    expect(new JemenaAdapter().isValid(invalid)).toBe(false);
  });

  it('parseRows: parses valid Jemena CSV row', () => {
    const buf = Buffer.from(
      'NMI,METER SERIAL NUMBER,CON/GEN,DATE,ESTIMATED?,00:00 - 00:30,00:30 - 01:00,01:00 - 01:30\n' +
      '6001204490,000000000000321347,Consumption,2023-07-19,No,0.0562,0.0250,0.0187\n' +
      '6001204490,000000000000321347,Controlled Load Consumption,2023-07-19,Yes,1.5187,1.5562,1.5375'
    );
    const rows = new JemenaAdapter().parseRows(buf);
    expect(rows).toEqual([
      {
        date: '2023-07-19',
        interval_values: [0.0562, 0.025, 0.0187],
        type: 'E1',
        nmi: '6001204490',
        meterSerial: '000000000000321347',
        estimated: false,
      },
      {
        date: '2023-07-19',
        interval_values: [1.5187, 1.5562, 1.5375],
        type: 'E2',
        nmi: '6001204490',
        meterSerial: '000000000000321347',
        estimated: true,
      }
    ]);
  });

  it('parseRows: ignores unrelated row types', () => {
    const buf = Buffer.from(
      'NMI,METER SERIAL NUMBER,CON/GEN,DATE,ESTIMATED?,00:00 - 00:30\n' +
      '6001204490,000000000000321347,OtherType,2023-07-19,No,0.0562\n' +
      '6001204490,000000000000321347,Consumption,2023-07-19,No,0.1234'
    );
    const rows = new JemenaAdapter().parseRows(buf);
    expect(rows.length).toBe(1);
    expect(rows[0].type).toBe('E1');
  });

  it('parseRows: returns empty array for empty or header-only buffer', () => {
    const buf = Buffer.from('NMI,METER SERIAL NUMBER,CON/GEN,DATE,ESTIMATED?\n');
    expect(new JemenaAdapter().parseRows(buf)).toEqual([]);
    expect(new JemenaAdapter().parseRows(Buffer.from(''))).toEqual([]);
  });

  describe('getIntervalLength', () => {
    it('maps rows to NEM12 interval records for E1 and E2', () => {
      const rows: Array<ParsedRow> = [
        {
          date: '2023-07-19',
          interval_values: [0.1, 0.2, 0.3],
          type: 'E1',
          nmi: '6001204490',
          meterSerial: '000000000000321347',
          estimated: false,
        },
        {
          date: '2023-07-19',
          interval_values: [1.1, 1.2, 1.3],
          type: 'E2',
          nmi: '6001204490',
          meterSerial: '000000000000321347',
          estimated: true,
        }
      ];
      const intervalLength = 30;
      const expectedIntervals = Math.round(1440 / intervalLength);
      const result = new JemenaAdapter().mapToNem12Intervals(rows, intervalLength);
      expect(result.E1).toEqual([
        {
          recordIndicator: '300',
          intervalDate: '20230719',
          intervalValues: [0.1, 0.2, 0.3, ...Array(expectedIntervals - 3).fill(0)],
          qualityMethod: 'A',
        }
      ]);
      expect(result.E2).toEqual([
        {
          recordIndicator: '300',
          intervalDate: '20230719',
          intervalValues: [1.1, 1.2, 1.3, ...Array(expectedIntervals - 3).fill(0)],
          qualityMethod: 'A',
        }
      ]);
    });

    it('pads missing intervals with zeros', () => {
      const rows: Array<ParsedRow> = [
        {
          date: '2023-07-20',
          interval_values: [0.5],
          type: 'E1',
          nmi: '6001204490',
          meterSerial: '000000000000321347',
          estimated: false,
        }
      ];
      const intervalLength = 30;
      const expectedIntervals = Math.round(1440 / intervalLength);
      const result = new JemenaAdapter().mapToNem12Intervals(rows, intervalLength);
      expect(result.E1[0].intervalValues.length).toBe(expectedIntervals);
      expect(result.E1[0].intervalValues.slice(1)).toEqual(Array(expectedIntervals - 1).fill(0));
    });
  });
  it('returns correct interval length for typical header', () => {
    const buf = Buffer.from(
      'NMI,METER SERIAL NUMBER,CON/GEN,DATE,ESTIMATED?,00:00 - 00:30,00:30 - 01:00,01:00 - 01:30\n' +
      '6001204490,000000000000321347,Consumption,2023-07-19,No,0.0562,0.0250,0.0187'
    );
    expect(new JemenaAdapter().getIntervalLength(buf)).toBe(30);
  });

  it('throws for malformed interval column', () => {
    const buf = Buffer.from(
      'NMI,METER SERIAL NUMBER,CON/GEN,DATE,ESTIMATED?,badcolumn\n6001204490,000000000000321347,Consumption,2023-07-19,No,0.0562'
    );
    expect(() => new JemenaAdapter().getIntervalLength(buf)).toThrow('No interval columns found');
  });

  it('throws for inconsistent interval lengths', () => {
    const buf = Buffer.from(
      'NMI,METER SERIAL NUMBER,CON/GEN,DATE,ESTIMATED?,00:00 - 00:30,00:30 - 01:15\n6001204490,000000000000321347,Consumption,2023-07-19,No,0.0562,0.0250'
    );
    expect(() => new JemenaAdapter().getIntervalLength(buf)).toThrow('Inconsistent interval lengths detected');
  });

  it('convertToNem12: CSV matches snapshot', () => {
    const adapter = new JemenaAdapter();
    const buf = fs.readFileSync(path.join(__dirname, '../../../data/jemena_data.csv'));
    const nem12 = adapter.convertToNem12(buf);
    expect(nem12.toString()).toMatchSnapshot();
  });
});
