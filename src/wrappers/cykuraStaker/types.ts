import type { TransactionEnvelope } from "@saberhq/solana-contrib";
import type { PublicKey } from "@solana/web3.js";

import type { IncentiveWrapper } from "./incentive";

export type PendingIncentive = {
  wrapper: IncentiveWrapper;
  tx: TransactionEnvelope;
};

