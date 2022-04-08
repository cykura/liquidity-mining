import type { BN } from "@project-serum/anchor";
import { newProgramMap } from "@saberhq/anchor-contrib";
import type { AugmentedProvider, Provider } from "@saberhq/solana-contrib";
import {
  SolanaAugmentedProvider,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import { getATAAddress, getTokenAccount, TOKEN_PROGRAM_ID } from "@saberhq/token-utils";
import { PublicKey, Signer } from "@solana/web3.js";
import { SystemProgram } from "@solana/web3.js";
import { FACTORY_ADDRESS, POSITION_SEED } from "@cykura/sdk";

import { CykuraStakerPrograms, CYKURA_STAKER_ADDRESSES, CYKURA_STAKER_IDLS } from "./constants";
import { DepositWrapper, findDepositAddress, findIncentiveAddress, findRewardAddress, findStakerAddress, IncentiveWrapper, RewardWrapper } from "./wrappers";
import { PendingDeposit, PendingIncentive, PendingReward } from "./wrappers/types";

/**
 * CykuraStakerSDK.
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

  /**
   * Returns a wrapper and a transaction to create a liquidity mining incentive
   */
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
          await this.programs.CykuraStaker.methods.createIncentive(
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

  /**
   * Returns a TX to create an LP token deposit
   */
   async createDeposit({
    depositorTokenAccount,
  }: {
    depositorTokenAccount: PublicKey,
  }): Promise<PendingDeposit> {
    const { mint } = await getTokenAccount(this.provider, depositorTokenAccount)
    const [deposit] = await findDepositAddress(mint)
    const [staker] = await findStakerAddress()
    const depositVault = await getATAAddress({ mint, owner: staker })
    const [tokenizedPosition] = await PublicKey.findProgramAddress([
      POSITION_SEED,
      mint.toBuffer()
    ], FACTORY_ADDRESS)

    return {
      deposit: new DepositWrapper(this, deposit),
      tx: new TransactionEnvelope(
        this.provider,
        [
          await this.programs.CykuraStaker.methods.createDeposit().accounts({
            deposit,
            depositorTokenAccount,
            depositVault,
            tokenizedPosition,
            depositor: this.provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          }).instruction(),
        ],
      ),
    }
  }

  /**
   * Returns a TX to create a reward account
   */
   async createRewardAccount({
    rewardToken,
    rewardOwner = this.provider.wallet.publicKey,
  }: {
    rewardToken: PublicKey,
    rewardOwner?: PublicKey,
  }): Promise<PendingReward> {
    const [reward] = await findRewardAddress(rewardToken, rewardOwner)

    return {
      reward: new RewardWrapper(this, reward),
      tx: new TransactionEnvelope(
        this.provider,
        [
          await this.programs.CykuraStaker.methods.createRewardAccount().accounts({
            reward,
            rewardToken,
            rewardOwner,
            payer: this.provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          }).instruction(),
        ],
      ),
    }
  }
}