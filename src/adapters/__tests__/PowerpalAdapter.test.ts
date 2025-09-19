import fs from 'fs';
import path from 'path';
import { PowerpalAdapter } from '../PowerpalAdapter';

describe('PowerpalAdapter', () => {
  it('isValid: returns true for valid Powerpal CSV', () => {
    const valid = Buffer.from(
      'datetime_utc,datetime_local,watt_hours,cost_dollars,is_peak\n2024-07-27 00:00:00,2024-07-27 10:00:00,0.0000000000,0.0008190972,false'
    );
    expect(new PowerpalAdapter().isValid(valid)).toBe(true);
  });

  it('isValid: returns false for invalid CSV', () => {
    const invalid = Buffer.from('foo,bar,baz\n1,2,3');
    expect(new PowerpalAdapter().isValid(invalid)).toBe(false);
  });

  describe('getIntervalLength', () => {
    const adapter = new PowerpalAdapter();

    it('returns correct interval for valid Powerpal CSV', () => {
      const buf = Buffer.from(
        'datetime_utc,datetime_local,watt_hours,cost_dollars,is_peak\n' +
        '2024-07-27 00:00:00,2024-07-27 10:00:00,0.0000000000,0.0008190972,false\n' +
        '2024-07-27 00:01:00,2024-07-27 10:01:00,0.0000000000,0.0008190972,false\n'
      );
      expect(adapter.getIntervalLength(buf)).toBe(1);
    });

    it('returns 0 for missing valid rows', () => {
      const buf = Buffer.from(
        'datetime_utc,datetime_local,watt_hours,cost_dollars,is_peak\n' +
        'foo,bar,baz,qux,quux\n'
      );
      expect(adapter.getIntervalLength(buf)).toBe(0);
    });

    it('returns 0 for empty file', () => {
      const buf = Buffer.from('');
      expect(adapter.getIntervalLength(buf)).toBe(0);
    });

    it('returns correct interval for real file', () => {
      const buf = fs.readFileSync(path.join(__dirname, '../../../data/powerpal_data_1min.csv'));
      const interval = adapter.getIntervalLength(buf);
      expect(typeof interval).toBe('number');
      expect(interval).toBeGreaterThan(0);
    });
  });

  describe('parseRows', () => {
    const adapter = new PowerpalAdapter();

    it('parses valid Powerpal CSV rows', () => {
      const buf = Buffer.from(
        'datetime_utc,datetime_local,watt_hours,cost_dollars,is_peak\n' +
        '2024-07-27 00:00:00,2024-07-27 10:00:00,1.23,0.0008190972,false\n' +
        '2024-07-27 00:01:00,2024-07-27 10:01:00,2.34,0.0008190972,false\n'
      );
      const rows = adapter.parseRows(buf);
      expect(rows).toEqual([
        {
          date: '2024-07-27',
          interval_values: [0.00123, 0.00234],
          type: 'E1',
          nmi: '9999999999',
          meterSerial: '55555555',
          estimated: false,
        }
      ]);
    });

    it('returns empty array for empty or header-only buffer', () => {
      const buf = Buffer.from('datetime_utc,datetime_local,watt_hours,cost_dollars,is_peak\n');
      expect(adapter.parseRows(buf)).toEqual([]);
      expect(adapter.parseRows(Buffer.from(''))).toEqual([]);
    });
  });

  it('convertToNem12: 1min interval CSV matches snapshot', () => {
    const adapter = new PowerpalAdapter();
    const buf = fs.readFileSync(path.join(__dirname, '../../../data/powerpal_data_1min.csv'));
    const nem12 = adapter.convertToNem12(buf);
    expect(nem12.toString()).toMatchSnapshot();
  });

  it('convertToNem12: 30min interval CSV matches snapshot', () => {
    const adapter = new PowerpalAdapter();
    const buf = fs.readFileSync(path.join(__dirname, '../../../data/powerpal_data_30min.csv'));
    const nem12 = adapter.convertToNem12(buf);
    expect(nem12.toString()).toMatchSnapshot();
  });

  it('convertToNem12: 60min interval CSV matches snapshot', () => {
    const adapter = new PowerpalAdapter();
    const buf = fs.readFileSync(path.join(__dirname, '../../../data/powerpal_data_60min.csv'));
    const nem12 = adapter.convertToNem12(buf);
    expect(nem12.toString()).toMatchSnapshot();
  });
});
