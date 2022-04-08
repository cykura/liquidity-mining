import { TransactionEnvelope } from "@saberhq/solana-contrib";
import { getATAAddress, getOrCreateATA, TOKEN_PROGRAM_ID } from "@saberhq/token-utils";
import type { PublicKey } from "@solana/web3.js";
import { RewardData } from "../programs";
import { CykuraStakerSDK } from "../sdk";
import { findStakerAddress } from "./pda";

export class RewardWrapper {
  private _reward: RewardData | null = null;

  constructor(
    readonly sdk: CykuraStakerSDK, readonly rewardKey: PublicKey) { }

  get provider() {
    return this.sdk.provider;
  }

  get program() {
    return this.sdk.programs.CykuraStaker;
  }

  async reload(): Promise<RewardData> {
    return await this.program.account.reward.fetch(this.rewardKey);
  }

  async data(): Promise<RewardData> {
    if (!this._reward) {
      this._reward = await this.reload();
    }
    return this._reward;
  }

  /**
   * Returns a TX to claim accrued reward
   * @param to The token account to receive reward. If the field is not provided, the provider wallet's
   * ATA is used and a create ATA instruction appended.
   */
  async claimReward(to?: PublicKey) {
    const { owner, rewardToken } = await this.data()
    const [staker] = await findStakerAddress()
    const vault = await getATAAddress({
      mint: rewardToken,
      owner: staker,
    })

    const tx = new TransactionEnvelope(
      this.provider,
      [],
    )

    if (!to) {
      const { address: _to, instruction: createToAccountIx } = await getOrCreateATA({
        provider: this.provider,
        mint: rewardToken,
      })
      to = _to
      if (createToAccountIx) {
        tx.append(createToAccountIx)
      }
    }

    tx.append(
      await this.program.methods.withdrawToken().accounts({
        reward: this.rewardKey,
        owner,
        vault,
        staker,
        to,
        tokenProgram: TOKEN_PROGRAM_ID,
      }).instruction()
    )

    return tx
  }
}
