import { TransactionEnvelope } from "@saberhq/solana-contrib";
import { getATAAddress, getOrCreateATA } from "@saberhq/token-utils";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import { IncentiveData } from "../../programs";
import { CykuraStakerSDK } from "../../sdk";
import { findStakerAddress } from "./pda";

export class IncentiveWrapper {
  private _incentive: IncentiveData | null = null;

  constructor(readonly sdk: CykuraStakerSDK, readonly incentiveKey: PublicKey) { }

  get provider() {
    return this.sdk.provider;
  }

  get program() {
    return this.sdk.programs.CykuraStaker;
  }

  async reload(): Promise<IncentiveData> {
    return await this.program.account.incentive.fetch(this.incentiveKey);
  }

  async data(): Promise<IncentiveData> {
    if (!this._incentive) {
      this._incentive = await this.reload();
    }
    return this._incentive;
  }

  async addReward({
    reward,
    payerTokenAccount,
  }: {
    reward: BN,
    payerTokenAccount?: PublicKey,
  }) {
    const [staker] = await findStakerAddress()
    const { rewardToken } = await this.data()
    const vault = await getATAAddress({
      mint: rewardToken,
      owner: staker,
    })

    if (!payerTokenAccount) {
      payerTokenAccount = await getATAAddress({
        mint: rewardToken,
        owner: this.provider.wallet.publicKey,
      })
    }

    return {
      tx: new TransactionEnvelope(
        this.provider,
        [
          await this.sdk.programs.CykuraStaker.methods.addReward(
            reward,
          ).accounts({
            incentive: this.incentiveKey,
            vault,
            payer: this.provider.wallet.publicKey,
            payerTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID
          }).instruction()
        ],
      ),
    };
  }

  /**
   * Returns a transaction to end the incentive, transferring leftover balance to the refundee
   *
   * If `refundeeTokenAccount` is not provided, the refundee's ATA is used. A create ATA instruction
   * is appended if the default ATA does not exist.
   */
  async endIncentive({
    refundeeTokenAccount
  }: {
    refundeeTokenAccount?: PublicKey
  }) {
    const [staker] = await findStakerAddress()
    const { rewardToken, refundee } = await this.data()
    const vault = await getATAAddress({
      mint: rewardToken,
      owner: staker,
    })

    const tx = new TransactionEnvelope(
      this.provider,
      [],
    )

    if (!refundeeTokenAccount) {
      const getOrCreateATAResult = await getOrCreateATA({
        provider: this.provider,
        mint: rewardToken,
        owner: refundee,
      })
      refundeeTokenAccount = getOrCreateATAResult.address

      if (getOrCreateATAResult.instruction) {
        tx.append(getOrCreateATAResult.instruction)
      }
    }

    tx.append(
      await this.sdk.programs.CykuraStaker.methods.endIncentive().accounts({
        incentive: this.incentiveKey,
        vault,
        staker,
        refundeeTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID
      }).instruction()
    )

    return { tx }
  }
}
