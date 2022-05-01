import type { AnchorTypes } from '@saberhq/anchor-contrib';
import type { BondedCysIDL } from '../idls/bonded_cys';

export * from '../idls/bonded_cys';

export type BondedCysTypes = AnchorTypes<
  BondedCysIDL,
  {}
>;

type Accounts = BondedCysTypes['Accounts'];

export type BondedCysProgram = BondedCysTypes['Program'];
