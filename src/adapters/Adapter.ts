import { Nem12File } from '../nem12/types';

export interface Adapter {
  isValid(fileContent: Buffer): boolean;
  convertToNem12(fileContent: Buffer): Nem12File;
}
