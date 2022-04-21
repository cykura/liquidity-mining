import {
    CyclosCore,
    IDL as CYCLOS_CORE_IDL,
    FACTORY_ADDRESS,
    POSITION_SEED,
    TICK_SEED,
    u32ToSeed,
    u16ToSeed,
    OBSERVATION_SEED,
    PoolState,
    TickState,
    ObservationState,
    snapshotCumulativesInside,
} from '@cykura/sdk';
import * as anchor from '@project-serum/anchor';
import { BN } from '@project-serum/anchor';
import { TransactionEnvelope } from '@saberhq/solana-contrib';
import { makeAnchorProvider } from '@saberhq/anchor-contrib';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import {
    findEscrowAddress,
    LockerWrapper,
    TribecaSDK,
    VoteEscrow,
} from '@tribecahq/tribeca-sdk';
import { StakeData } from '../programs';
import {
    computeBoostPercent,
    computeRewardAmount,
    computeRewardAmountBoosted,
    RewardOwed,
} from '../rewardMath';
import { CykuraStakerSDK } from '../sdk';
import { DepositWrapper } from './deposit';
import { IncentiveWrapper } from './incentive';
import { findDepositAddress, findRewardAddress } from './pda';
import { RewardWrapper } from './reward';
import { PendingUnstake } from './types';

export class StakeWrapper {
    private _stake: StakeData | null = null;

    constructor(readonly sdk: CykuraStakerSDK, readonly stakeKey: PublicKey) {}

    get provider() {
        return this.sdk.provider;
    }

    get program() {
        return this.sdk.programs.CykuraStaker;
    }

    async reload(): Promise<StakeData> {
        return this.program.account.stake.fetch(this.stakeKey);
    }

    async data(): Promise<StakeData> {
        if (!this._stake) {
            this._stake = await this.reload();
        }
        return this._stake;
    }

    /**
     * Returns a TX to unstake from an incentive, boosted or otherwise. The reward account is created
     * if it does not already exist.
     *
     * @param deposit
     * @returns
     */
    async unstakeToken(deposit: DepositWrapper): Promise<PendingUnstake> {
        const tx = new TransactionEnvelope(this.provider, []);

        const { mint: nftMint, incentive } = await this.data();
        const incentiveWrapper = new IncentiveWrapper(this.sdk, incentive);
        const { boostLocker, rewardToken: incentiveRewardToken } =
            await incentiveWrapper.data();

        if (!boostLocker) {
            console.log(`Could not find boostlocker, fails`);
            return Promise.resolve({
                reward: new RewardWrapper(this.sdk, PublicKey.default),
                tx,
            });
        }

        const [reward] = await findRewardAddress(
            incentiveRewardToken,
            this.provider.wallet.publicKey
        );
        const rewardData = await this.provider.getAccountInfo(reward);
        if (!rewardData) {
            const { tx: createRewardAccountTx } =
                await this.sdk.createRewardAccount(
                    incentiveRewardToken,
                    this.provider.wallet.publicKey
                );
            tx.append(...createRewardAccountTx.instructions);
        }

        // @ts-ignore
        const cyclosCore = new anchor.Program<CyclosCore>(
            CYCLOS_CORE_IDL,
            FACTORY_ADDRESS,
            makeAnchorProvider(this.provider.provider)
        );
        const [tokenizedPosition] = await PublicKey.findProgramAddress(
            [POSITION_SEED, nftMint.toBuffer()],
            FACTORY_ADDRESS
        );

        const { poolId, tickLower, tickUpper } =
            await cyclosCore.account.tokenizedPositionState.fetch(
                tokenizedPosition
            );
        const { token0, token1, fee, observationIndex } =
            await cyclosCore.account.poolState.fetch(poolId);

        const [tickLowerState] = await PublicKey.findProgramAddress(
            [
                TICK_SEED,
                token0.toBuffer(),
                token1.toBuffer(),
                u32ToSeed(fee),
                u32ToSeed(tickLower),
            ],
            FACTORY_ADDRESS
        );

        const [tickUpperState] = await PublicKey.findProgramAddress(
            [
                TICK_SEED,
                token0.toBuffer(),
                token1.toBuffer(),
                u32ToSeed(fee),
                u32ToSeed(tickUpper),
            ],
            FACTORY_ADDRESS
        );

        const [latestObservation] = await PublicKey.findProgramAddress(
            [
                OBSERVATION_SEED,
                token0.toBuffer(),
                token1.toBuffer(),
                u32ToSeed(fee),
                u16ToSeed(observationIndex),
            ],
            FACTORY_ADDRESS
        );

        if (incentive) {
            const [escrow] = await findEscrowAddress(
                boostLocker,
                this.provider.walletKey
            );

            tx.append(
                await this.sdk.programs.CykuraStaker.methods
                    .unstakeTokenBoosted()
                    .accounts({
                        stake: this.stakeKey,
                        incentive,
                        locker: boostLocker,
                        escrow,
                        deposit: deposit.depositKey,
                        reward,
                        pool: poolId,
                        tickLower: tickLowerState,
                        tickUpper: tickUpperState,
                        latestObservation,
                        signer: this.provider.walletKey,
                    })
                    .instruction()
            );
        } else {
            tx.append(
                await this.sdk.programs.CykuraStaker.methods
                    .unstakeToken()
                    .accounts({
                        stake: this.stakeKey,
                        incentive,
                        deposit: deposit.depositKey,
                        reward,
                        pool: poolId,
                        tickLower: tickLowerState,
                        tickUpper: tickUpperState,
                        latestObservation,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .instruction()
            );
        }

        return {
            tx,
            reward: new RewardWrapper(this.sdk, reward),
        };
    }

    /**
     * Calculate unclaimed rewards for a stake
     */
    async getRewardInfo(time: number): Promise<RewardOwed> {
        const {
            mint,
            incentive,
            liquidity,
            secondsPerLiquidityInsideInitialX32,
        } = await this.data();
        const incentiveWrapper = new IncentiveWrapper(this.sdk, incentive);
        const {
            totalRewardUnclaimed,
            totalSecondsClaimedX32,
            startTime,
            endTime,
            boostLocker,
        } = await incentiveWrapper.data();

        const [tokenizedPosition] = await PublicKey.findProgramAddress(
            [POSITION_SEED, mint.toBuffer()],
            FACTORY_ADDRESS
        );

        // @ts-ignore
        const cyclosCore = new anchor.Program<CyclosCore>(
            CYCLOS_CORE_IDL,
            FACTORY_ADDRESS,
            makeAnchorProvider(this.provider.provider)
        );
        const {
            poolId,
            tickLower,
            tickUpper,
            liquidity: totalPoolLiquidity,
        } = await cyclosCore.account.tokenizedPositionState.fetch(
            tokenizedPosition
        );
        const { token0, token1, fee, observationIndex } =
            await cyclosCore.account.poolState.fetch(poolId);

        const [tickLowerState] = await PublicKey.findProgramAddress(
            [
                TICK_SEED,
                token0.toBuffer(),
                token1.toBuffer(),
                u32ToSeed(fee),
                u32ToSeed(tickLower),
            ],
            FACTORY_ADDRESS
        );

        const [tickUpperState] = await PublicKey.findProgramAddress(
            [
                TICK_SEED,
                token0.toBuffer(),
                token1.toBuffer(),
                u32ToSeed(fee),
                u32ToSeed(tickUpper),
            ],
            FACTORY_ADDRESS
        );

        const [latestObservation] = await PublicKey.findProgramAddress(
            [
                OBSERVATION_SEED,
                token0.toBuffer(),
                token1.toBuffer(),
                u32ToSeed(fee),
                u16ToSeed(observationIndex),
            ],
            FACTORY_ADDRESS
        );

        const poolData = (await cyclosCore.account.poolState.fetch(
            poolId
        )) as any;

        const tickLowerData = (await cyclosCore.account.tickState.fetch(
            tickLowerState
        )) as any;
        const tickUpperData = (await cyclosCore.account.tickState.fetch(
            tickUpperState
        )) as any;
        const latestObservationData =
            (await cyclosCore.account.observationState.fetch(
                latestObservation
            )) as any;

        const { secondsPerLiquidityInsideX32 } = snapshotCumulativesInside({
            poolState: poolData,
            tickLower: tickLowerData,
            tickUpper: tickUpperData,
            latestObservation: latestObservationData,
            time,
        });

        if (boostLocker) {
            const [depositKey] = await findDepositAddress(mint);
            const deposit = new DepositWrapper(this.sdk, depositKey);
            const { owner } = await deposit.data();

            const tribecaSdk = TribecaSDK.load({ provider: this.provider });
            const { governor } =
                await tribecaSdk.programs.LockedVoter.account.locker.fetch(
                    boostLocker
                );

            // Total voting power
            const lockerWrapper = new LockerWrapper(
                tribecaSdk,
                boostLocker,
                governor
            );
            const { lockedSupply, params: lockerParams } =
                await lockerWrapper.data();
            const totalVotingPower = lockedSupply.muln(
                lockerParams.maxStakeVoteMultiplier
            );

            // Voting power of the user
            const [escrowKey] = await findEscrowAddress(boostLocker, owner);
            const escrowWrapper = new VoteEscrow(
                tribecaSdk,
                boostLocker,
                governor,
                escrowKey,
                owner
            );
            const votingPower = await escrowWrapper.calculateVotingPower();

            console.log(
                'locked supply',
                lockedSupply.toString(),
                'voting power',
                votingPower.toString(),
                'total voting power',
                totalVotingPower.toString()
            );
            return computeRewardAmountBoosted({
                totalRewardUnclaimed,
                totalSecondsClaimedX32,
                startTime,
                endTime,
                liquidity,
                secondsPerLiquidityInsideInitialX32,
                secondsPerLiquidityInsideX32,
                currentTime: new BN(time),
                totalPoolLiquidity,
                votingPower,
                totalVotingPower,
            });
        } else {
            return computeRewardAmount({
                totalRewardUnclaimed,
                totalSecondsClaimedX32,
                startTime,
                endTime,
                liquidity,
                secondsPerLiquidityInsideInitialX32,
                secondsPerLiquidityInsideX32,
                currentTime: new BN(time),
            });
        }
    }
}
