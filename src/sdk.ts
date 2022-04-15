import * as anchor from "@project-serum/anchor";
import type { BN } from "@project-serum/anchor";
import { newProgramMap } from "@saberhq/anchor-contrib";
import type { AugmentedProvider, Provider } from "@saberhq/solana-contrib";
import {
  SolanaAugmentedProvider,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import { getATAAddress, getOrCreateATA, getTokenAccount, TOKEN_PROGRAM_ID } from "@saberhq/token-utils";
import { PublicKey, Signer } from "@solana/web3.js";
import { SystemProgram } from "@solana/web3.js";
import { CyclosCore, FACTORY_ADDRESS, IDL as CYCLOS_CORE_IDL, OBSERVATION_SEED, POOL_SEED, POSITION_SEED, TICK_SEED, u16ToSeed, u32ToSeed } from "@cykura/sdk";

import { CykuraStakerPrograms, CYKURA_STAKER_ADDRESSES, CYKURA_STAKER_IDLS } from "./constants";
import { DepositWrapper, findDepositAddress, findIncentiveAddress, findRewardAddress, findStakeAddress, findStakerAddress, IncentiveWrapper, RewardWrapper } from "./wrappers";
import { PendingDeposit, PendingIncentive, PendingReward, PendingStake } from "./wrappers/types";
import { StakeWrapper } from "./wrappers/stake";

/**
 * CykuraStakerSDK.
 */
export class CykuraStakerSDK {
  constructor(
    readonly provider: SolanaAugmentedProvider,
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
   * Returns a wrapper and a transaction to create a boosted liquidity mining incentive
   */
   async createIncentiveBoosted({
    rewardToken,
    pool,
    startTime,
    endTime,
    locker,
    refundee = this.provider.wallet.publicKey,
  }: {
    rewardToken: PublicKey,
    pool: PublicKey,
    startTime: BN,
    endTime: BN,
    locker: PublicKey,
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
          await this.programs.CykuraStaker.methods.createIncentiveBoosted(
            startTime,
            endTime,
          ).accounts({
            incentive,
            rewardToken,
            pool,
            refundee,
            payer: this.provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
            locker,
          }).instruction(),
        ],
      ),
    };
  }

  /**
   * Returns a TX to create an LP token deposit
   */
   async createDeposit(depositorTokenAccount: PublicKey): Promise<PendingDeposit> {
    const tx = new TransactionEnvelope(this.provider, [])
    const { mint } = await getTokenAccount(this.provider, depositorTokenAccount)
    const [deposit] = await findDepositAddress(mint)
    const [staker] = await findStakerAddress()

    const { address: depositVault, instruction: createVaultIx } = await getOrCreateATA({
      provider: this.provider,
      mint,
      owner: staker,
    })
    if (createVaultIx) {
      tx.append(createVaultIx)
    }

    const [tokenizedPosition] = await PublicKey.findProgramAddress([
      POSITION_SEED,
      mint.toBuffer()
    ], FACTORY_ADDRESS)

    tx.append(await this.programs.CykuraStaker.methods.createDeposit().accounts({
      deposit,
      depositorTokenAccount,
      depositVault,
      tokenizedPosition,
      depositor: this.provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).instruction())

    return {
      deposit: new DepositWrapper(this, deposit),
      tx,
      mint,
    }
  }

  /**
   * Returns a TX to stake an LP token
   * TODO use token account instead of mint
   *
   * @param mint Mint address of the LP token
   * @param incentive Incentive address
   * @returns
   */
  async stakeToken(mint: PublicKey, incentive: PublicKey): Promise<PendingStake> {
    const [deposit] = await findDepositAddress(mint)
    const [tokenizedPosition] = await PublicKey.findProgramAddress([
      POSITION_SEED,
      mint.toBuffer()
    ], FACTORY_ADDRESS)
    const [stake] = await findStakeAddress(mint, incentive)

    const cyclosCore = new anchor.Program<CyclosCore>(CYCLOS_CORE_IDL, FACTORY_ADDRESS, anchor.Provider.env())
    const { poolId, tickLower, tickUpper } = await cyclosCore.account.tokenizedPositionState.fetch(tokenizedPosition)
    const { token0, token1, fee, observationIndex } = await cyclosCore.account.poolState.fetch(poolId)

    const [tickLowerState] = await PublicKey.findProgramAddress([
      TICK_SEED,
      token0.toBuffer(),
      token1.toBuffer(),
      u32ToSeed(fee),
      u32ToSeed(tickLower)
    ], FACTORY_ADDRESS)

    const [tickUpperState] = await PublicKey.findProgramAddress([
      TICK_SEED,
      token0.toBuffer(),
      token1.toBuffer(),
      u32ToSeed(fee),
      u32ToSeed(tickUpper)
    ], FACTORY_ADDRESS)

    const [latestObservation] = await  PublicKey.findProgramAddress(
      [
        OBSERVATION_SEED,
        token0.toBuffer(),
        token1.toBuffer(),
        u32ToSeed(fee),
        u16ToSeed(observationIndex)
      ], FACTORY_ADDRESS)

    return {
      stake: new StakeWrapper(this, stake),
      tx: new TransactionEnvelope(
        this.provider,
        [
          await this.programs.CykuraStaker.methods.stakeToken().accounts({
            stake,
            incentive: incentive,
            deposit,
            tokenizedPosition,
            pool: poolId,
            tickLower: tickLowerState,
            tickUpper: tickUpperState,
            latestObservation,
            owner: this.provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          }).instruction(),
        ],
      ),
    }
  }

  async depositAndStake(
    depositorTokenAccount: PublicKey,
    incentive: PublicKey
  ) {
    const { deposit, tx: createDepositTx, mint } = await this.createDeposit(depositorTokenAccount)
    const { stake, tx: stakeTokenTx } = await this.stakeToken(mint, incentive)

    const tx = new TransactionEnvelope(this.provider, [
      ...createDepositTx.instructions,
      ...stakeTokenTx.instructions,
    ])

    return { deposit, stake, tx }
  }

  /**
   * Returns a TX to create a reward account
   */
   async createRewardAccount(
    rewardToken: PublicKey,
    rewardOwner: PublicKey = this.provider.wallet.publicKey
  ): Promise<PendingReward> {
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