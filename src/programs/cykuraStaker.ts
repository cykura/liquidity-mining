import type { AnchorTypes } from "@saberhq/anchor-contrib";
import type { AccountMeta } from "@solana/web3.js";

import type { CykuraStakerIDL } from "../idls/cykura_staker";
export * from '../idls/cykura_staker'

export type CykuraStakerTypes = AnchorTypes<
CykuraStakerIDL,
  {
    incentive: IncentiveData;
    deposit: DepositData;
    stake: StakeData;
    reward: RewardData;
  }
>;

type Accounts = CykuraStakerTypes["Accounts"]
export type IncentiveData = Accounts["Incentive"];
export type DepositData = Accounts["Deposit"];
export type StakeData = Accounts["Stake"];
export type RewardData = Accounts["Reward"];

export type CykuraStakerProgram = CykuraStakerTypes["Program"];
