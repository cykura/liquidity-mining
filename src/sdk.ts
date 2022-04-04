import type { BN } from "@project-serum/anchor";
import { newProgramMap } from "@saberhq/anchor-contrib";
import type { AugmentedProvider, Provider } from "@saberhq/solana-contrib";
import {
  SolanaAugmentedProvider,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import type { PublicKey, Signer } from "@solana/web3.js";
import { SystemProgram } from "@solana/web3.js";

import { CykuraStakerPrograms, CYKURA_STAKER_ADDRESSES, CYKURA_STAKER_IDLS } from "./constants";
import { findIncentiveAddress, IncentiveWrapper } from "./wrappers/cykuraStaker";
import { PendingIncentive } from "./wrappers/cykuraStaker/types";

/**
 * TribecaSDK.
 */
export class CykuraStakerSDK {
  constructor(
    readonly provider: AugmentedProvider,
    readonly programs: CykuraStakerPrograms
  ) {}

  /**
   * Creates a new instance of the SDK with the given keypair.
   */
  withSigner(signer: Signer): CykuraStakerSDK {
    return CykuraStakerSDK.load({
      provider: this.provider.withSigner(signer),
    });
  }

  /**
   * Loads the SDK.
   * @returns
   */
  static load({ provider }: { provider: Provider }): CykuraStakerSDK {
    const programs: CykuraStakerPrograms = newProgramMap<CykuraStakerPrograms>(
      provider,
      CYKURA_STAKER_IDLS,
      CYKURA_STAKER_ADDRESSES
    );
    return new CykuraStakerSDK(new SolanaAugmentedProvider(provider), programs);
  }

  async createIncentive({
    rewardToken,
    pool,
    startTime,
    endTime,
    refundee = this.provider.wallet.publicKey,
  }: {
    rewardToken: PublicKey,
    pool: PublicKey,
    startTime: BN,
    endTime: BN,
    refundee: PublicKey,
  }): Promise<PendingIncentive> {
    const [incentive] = await findIncentiveAddress(
      rewardToken,
      pool,
      refundee,
      startTime,
      endTime
    )
    const wrapper = new IncentiveWrapper(this, incentive);

    return {
      wrapper,
      tx: new TransactionEnvelope(
        this.provider,
        [
          await this.programs.CykuraStaker.methods.initializeElectorate(
            startTime,
            endTime,
          ).accounts({
            incentive,
            rewardToken,
            pool,
            refundee,
            payer: this.provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          }).instruction(),
        ],
      ),
    };
  }

}