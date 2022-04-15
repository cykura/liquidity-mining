import type { PublicKey, TransactionEnvelope } from "@saberhq/solana-contrib";
import { DepositWrapper } from "./deposit";

import type { IncentiveWrapper } from "./incentive";
import { RewardWrapper } from "./reward";
import { StakeWrapper } from "./stake";

export type PendingIncentive = {
  wrapper: IncentiveWrapper;
  tx: TransactionEnvelope;
};

export type PendingDeposit = {
  deposit: DepositWrapper;
  tx: TransactionEnvelope;
  mint: PublicKey;
};

export type PendingReward = {
  reward: RewardWrapper;
  tx: TransactionEnvelope;
};

export type PendingStake = {
  stake: StakeWrapper;
  tx: TransactionEnvelope;
};

export type PendingUnstake = {
  reward: RewardWrapper;
  tx: TransactionEnvelope;
};

export type PendingDepositAndStake = {
  deposit: DepositWrapper;
  stake: StakeWrapper;
  tx: TransactionEnvelope;
};
