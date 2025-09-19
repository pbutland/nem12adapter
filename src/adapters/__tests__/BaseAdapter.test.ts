import { TestAdapter } from './TestAdapter';
import { ParsedRow } from '../types';
import { Nem12File } from '../../nem12/types';

describe('BaseAdapter (via TestAdapter)', () => {
  const adapter = new TestAdapter();
  const dummyBuffer = Buffer.from('irrelevant');
  const dummyRows: ParsedRow[] = adapter.parseRows(dummyBuffer);
  const intervalLength = adapter.getIntervalLength(dummyRows);

  it('assembleNem12File returns Nem12File with correct structure', () => {
    const nem12 = adapter.assembleNem12File(dummyRows, intervalLength);
    expect(nem12).toHaveProperty('header');
    expect(nem12).toHaveProperty('nmis');
    expect(nem12).toHaveProperty('trailer');
    expect(Array.isArray(nem12.nmis)).toBe(true);
    expect(nem12.nmis.length).toBe(2);
  });

  it('generateNem12HeaderAndMeterBlocks returns correct headers', () => {
    const { header, nmiHeaders } = adapter.generateNem12HeaderAndMeterBlocks(dummyRows, intervalLength);
    expect(header).toHaveProperty('recordIndicator', '100');
    expect(Array.isArray(nmiHeaders)).toBe(true);
    expect(nmiHeaders.length).toBe(2);
    expect(nmiHeaders[0]).toHaveProperty('recordIndicator', '200');
  });

  it('mapToNem12Intervals returns correct interval blocks', () => {
    const intervals = adapter.mapToNem12Intervals(dummyRows, intervalLength);
    expect(intervals).toHaveProperty('E1');
    expect(intervals).toHaveProperty('E2');
    expect(Array.isArray(intervals.E1)).toBe(true);
    expect(Array.isArray(intervals.E2)).toBe(true);
    expect(intervals.E1.length).toBe(1);
    expect(intervals.E2.length).toBe(1);
  });

  it('convertToNem12 returns Nem12File', () => {
    const nem12 = adapter.convertToNem12(dummyBuffer);
    expect(nem12).toHaveProperty('header');
    expect(nem12).toHaveProperty('nmis');
    expect(nem12).toHaveProperty('trailer');
  });
});
