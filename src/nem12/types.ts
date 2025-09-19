import e from "express";

// Serializer function to convert Nem12File to NEM12 text format
export function serializeNem12(file: Nem12File): string {
  const lines: string[] = [];

  // 100 header
  const h = file.header;
  lines.push([
    '100',
    h.versionHeader,
    h.dateTime.toISOString().replace(/[-:]/g, '').slice(0, 15),
    h.fromParticipant,
    h.toParticipant
  ].join(','));

  // 200/300/400 records
  for (const nmiBlock of file.nmis) {
    const n = nmiBlock.nmiHeader;
    lines.push([
      '200',
      n.nmi,
      n.nmiConfiguration,
      n.registerId,
      n.nmiSuffix,
      n.mdmDataStreamIdentifier ?? '',
      n.meterSerialNumber,
      n.uom,
      n.intervalLength.toString(),
      n.nextScheduledReadDate ? n.nextScheduledReadDate.toISOString().replace(/[-:]/g, '').slice(0, 15) : ''
    ].join(','));

    for (const block of nmiBlock.intervalBlocks) {
      // Serialize 300 record
      lines.push([
        '300',
        block.intervalDate,
        ...block.intervalValues.map(v => v !== null ? v.toString() : ''),
        ...block.qualityMethod,
        block.reasonCode ?? '',
        block.reasonDescription ?? '',
        block.updateDateTime ? block.updateDateTime.toISOString().replace(/[-:]/g, '').slice(0, 15) : '',
        block.msatsLoadDateTime ? block.msatsLoadDateTime.toISOString().replace(/[-:]/g, '').slice(0, 15) : ''
      ].filter((_, i) => i < 55 || Boolean(_)).join(','));
    }
    // Optionally serialize 400 records if present
    if (nmiBlock.eventRecords) {
      for (const event of nmiBlock.eventRecords) {
        lines.push([
          '400',
          event.startInterval,
          event.endInterval,
          event.qualityMethod,
          event.reasonCode ?? '',
          event.reasonDescription ?? ''
        ].join(','));
      }
    }
  }

  // 900 trailer
  const t = file.trailer;
  lines.push(['900'].filter(Boolean).join(','));

  return lines.join('\n');
}

// Add default toString implementation to Nem12File
export function withNem12ToString(file: Omit<Nem12File, 'toString'>): Nem12File {
  return {
    ...file,
    toString() {
      return serializeNem12(this);
    }
  };
}

// Record 100 — File Header
export interface Record100 {
  recordIndicator: '100';
  versionHeader: string; // e.g. 'NEM12'
  dateTime: Date;
  fromParticipant: string;
  toParticipant: string;
}

// Record 200 — NMI Header
export interface Record200 {
  recordIndicator: '200';
  nmi: string;
  nmiConfiguration: string;
  registerId: string;
  nmiSuffix: string;
  mdmDataStreamIdentifier?: string;
  meterSerialNumber?: string;
  uom: string;
  intervalLength: number;
  nextScheduledReadDate?: Date;
}

// Record 300 — Interval Data (NEM12 spec)
export interface Record300 {
  recordIndicator: '300';
  intervalDate: string; // YYYYMMDD
  intervalValues: (number | null)[];
  qualityMethod: string;
  reasonCode?: number;
  reasonDescription?: string;
  updateDateTime?: Date;
  msatsLoadDateTime?: Date;
}

// Record 400 — Event/Quality Data
export interface Record400 {
  recordIndicator: '400';
  startInterval: number;
  endInterval: number;
  qualityMethod: string;
  reasonCode?: number;
  reasonDescription?: string;
}

// Record 900 — File Trailer
export interface Record900 {
  recordIndicator: '900';
}

// Top-level NEM12 file structure
export interface Nem12File {
  header: Record100;
  nmis: Array<{
    nmiHeader: Record200;
    intervalBlocks: Record300[];
    eventRecords?: Record400[];
  }>;
  trailer: Record900;
  toString(): string;
}
