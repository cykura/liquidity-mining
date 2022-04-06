import type { TransactionEnvelope } from "@saberhq/solana-contrib";
import type { PublicKey } from "@solana/web3.js";
import { DepositWrapper } from "./deposit";

import type { IncentiveWrapper } from "./incentive";

export type PendingIncentive = {
  wrapper: IncentiveWrapper;
  tx: TransactionEnvelope;
};

export type PendingDeposit = {
  deposit: DepositWrapper;
  tx: TransactionEnvelope;
};
