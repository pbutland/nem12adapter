import fs from 'fs';
import path from 'path';
import { OriginAdapter } from '../OriginAdapter';

describe('OriginAdapter', () => {
  it('isValid: returns true for valid Origin CSV', () => {
    const valid = Buffer.from(
      'Usage Type,Amount Used,From (date/time),To (date/time)\n' +
      'Consumption,1.23,2023-01-01T00:00:00,2023-01-01T00:30:00\n'
    );
    expect(new OriginAdapter().isValid(valid)).toBe(true);
  });

  it('isValid: returns false for invalid CSV', () => {
    const invalid = Buffer.from('foo,bar,baz\n1,2,3');
    expect(new OriginAdapter().isValid(invalid)).toBe(false);
  });

  describe('getIntervalLength', () => {
    const adapter = new OriginAdapter();

    it('returns correct interval for valid Origin CSV', () => {
      const buf = Buffer.from(
        'Usage Type,Amount Used,From (date/time),To (date/time)\n' +
        'Consumption,1.23,2023-01-01T00:00:00,2023-01-01T00:30:00\n' +
        'Consumption,2.34,2023-01-01T00:30:00,2023-01-01T01:00:00\n'
      );
      expect(adapter.getIntervalLength(buf)).toBe(30);
    });

    it('throws error for missing valid rows', () => {
      const buf = Buffer.from(
        'Usage Type,Amount Used,From (date/time),To (date/time)\n' +
        'foo,bar,baz,qux\n'
      );
      expect(() => adapter.getIntervalLength(buf)).toThrow('Unable to determine interval length');
    });

    it('throws error for empty file', () => {
      const buf = Buffer.from('');
      expect(() => adapter.getIntervalLength(buf)).toThrow('Unable to determine interval length');
    });

    it('returns correct interval for real file', () => {
      const buf = fs.readFileSync(path.join(__dirname, '../../../data/origin_data.csv'));
      const interval = adapter.getIntervalLength(buf);
      expect(typeof interval).toBe('number');
      expect(interval).toBeGreaterThan(0);
    });
  });

  describe('parseRows', () => {
    const adapter = new OriginAdapter();

    it('parses valid Origin CSV rows with alternating types', () => {
      const buf = Buffer.from(
        'Usage Type,Amount Used,From (date/time),To (date/time)\n' +
        'Consumption,1.23,2023-01-01T00:00:00,2023-01-01T00:30:00\n' +
        'Consumption,2.34,2023-01-01T00:30:00,2023-01-01T01:00:00\n' +
        'Consumption,3.45,2023-01-01T01:00:00,2023-01-01T01:30:00\n'
      );
      const rows = adapter.parseRows(buf);
      expect(rows).toEqual([
        {
          date: '2023-01-01',
          interval_values: [1.23, 2.34, 3.45],
          type: 'E1',
          nmi: '9999999999',
          meterSerial: '55555555',
          estimated: false,
        }
      ]);
    });

    it('returns empty array for empty or header-only buffer', () => {
      const buf = Buffer.from('Usage Type,Amount Used,From (date/time),To (date/time)\n');
      expect(adapter.parseRows(buf)).toEqual([]);
      expect(adapter.parseRows(Buffer.from(''))).toEqual([]);
    });

    it('ignores malformed rows', () => {
      const buf = Buffer.from(
        'Usage Type,Amount Used,From (date/time),To (date/time)\n' +
        'Consumption,1.23,2023-01-01T00:00:00\n' + // missing To
        'Consumption,2.34,2023-01-01T00:30:00,2023-01-01T01:00:00\n'
      );
      const rows = adapter.parseRows(buf);
      expect(rows.length).toBe(1);
      expect(rows[0].interval_values[0]).toBe(2.34);
    });

    it('parses real Origin CSV file', () => {
      const buf = fs.readFileSync(path.join(__dirname, '../../../data/origin_data.csv'));
      const rows = adapter.parseRows(buf);
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0]).toHaveProperty('date');
      expect(rows[0]).toHaveProperty('interval_values');
      expect(rows[0]).toHaveProperty('type');
    });
  });

  it('convertToNem12: CSV matches snapshot', () => {
    const adapter = new OriginAdapter();
    const buf = fs.readFileSync(path.join(__dirname, '../../../data/origin_data.csv'));
    const nem12 = adapter.convertToNem12(buf);
    expect(nem12.toString()).toMatchSnapshot();
  });
});
