import { Adapter } from '../adapters/Adapter';
import { JemenaAdapter } from '../adapters/JemenaAdapter';
import { OriginAdapter } from '../adapters/OriginAdapter';
import { PowerpalAdapter } from '../adapters/PowerpalAdapter';
import { Nem12File } from './types';

const adapters: Adapter[] = [new JemenaAdapter(), new OriginAdapter(), new PowerpalAdapter()];

export async function detectAdapterAndConvert(fileContent: Buffer): Promise<Nem12File> {
  for (const adapter of adapters) {
    if (adapter.isValid(fileContent)) {
      return adapter.convertToNem12(fileContent);
    }
  }
  throw new Error('Unsupported file format');
}

