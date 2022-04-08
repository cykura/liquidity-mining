import type { TransactionEnvelope } from "@saberhq/solana-contrib";
import { DepositWrapper } from "./deposit";

import type { IncentiveWrapper } from "./incentive";
import { RewardWrapper } from "./reward";

export type PendingIncentive = {
  wrapper: IncentiveWrapper;
  tx: TransactionEnvelope;
};

export type PendingDeposit = {
  deposit: DepositWrapper;
  tx: TransactionEnvelope;
};

export type PendingReward = {
  reward: RewardWrapper;
  tx: TransactionEnvelope;
};

