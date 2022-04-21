import { BN } from '@project-serum/anchor';
import invariant from 'tiny-invariant';

export interface RewardOwed {
    reward: BN;
    secondsInsideX32: BN;
    boostPercent?: number;
}

export function computeRewardAmount({
    totalRewardUnclaimed,
    totalSecondsClaimedX32,
    startTime,
    endTime,
    liquidity,
    secondsPerLiquidityInsideInitialX32,
    secondsPerLiquidityInsideX32,
    currentTime,
}: {
    totalRewardUnclaimed: BN;
    totalSecondsClaimedX32: BN;
    startTime: BN;
    endTime: BN;
    liquidity: BN;
    secondsPerLiquidityInsideInitialX32: BN;
    secondsPerLiquidityInsideX32: BN;
    currentTime: BN;
}): RewardOwed {
    // this should never be called before the start time
    invariant(currentTime.gte(startTime));

    const secondsInsideX32 = secondsPerLiquidityInsideX32
        .sub(secondsPerLiquidityInsideInitialX32)
        .mul(liquidity);

    const totalSecondsUnlaimedX32 = BN.max(currentTime, endTime)
        .sub(startTime)
        .shln(32)
        .sub(totalSecondsClaimedX32);

    const reward = totalRewardUnclaimed
        .mul(secondsInsideX32)
        .div(totalSecondsUnlaimedX32);

    return { reward, secondsInsideX32 };
}

export function computeRewardAmountBoosted({
    totalRewardUnclaimed,
    totalSecondsClaimedX32,
    startTime,
    endTime,
    liquidity,
    secondsPerLiquidityInsideInitialX32,
    secondsPerLiquidityInsideX32,
    currentTime,
    totalPoolLiquidity,
    votingPower,
    totalVotingPower,
}: {
    totalRewardUnclaimed: BN;
    totalSecondsClaimedX32: BN;
    startTime: BN;
    endTime: BN;
    liquidity: BN;
    secondsPerLiquidityInsideInitialX32: BN;
    secondsPerLiquidityInsideX32: BN;
    currentTime: BN;
    totalPoolLiquidity: BN;
    votingPower: BN;
    totalVotingPower: BN;
}): RewardOwed {
    // this should never be called before the start time
    invariant(currentTime.gte(startTime));

    const effectiveLiquidity = BN.min(
        liquidity
            .muln(4)
            .add(
                totalPoolLiquidity
                    .mul(votingPower)
                    .div(totalVotingPower)
                    .muln(6)
            )
            .divn(10),
        liquidity
    );
    const secondsInsideX32 = secondsPerLiquidityInsideX32
        .sub(secondsPerLiquidityInsideInitialX32)
        .mul(effectiveLiquidity);

    const totalSecondsUnlaimedX32 = BN.max(endTime, currentTime)
        .sub(startTime)
        .shln(32)
        .sub(totalSecondsClaimedX32);

    const reward = totalRewardUnclaimed
        .mul(secondsInsideX32)
        .div(totalSecondsUnlaimedX32);

    const boostPercent = computeBoostPercent(
        liquidity,
        totalPoolLiquidity,
        votingPower,
        totalVotingPower
    );
    return { reward, secondsInsideX32, boostPercent };
}

/**
 * Compute boost percent for a user's LP position. Max boost is 250%
 *
 * @param liquidity The liquidity in the LP NFT
 * @param poolLiquidity The total liquidity in the pool
 * @param votingPower The voting power of the user's wallet
 * @param totalVotingPower Total voting power inside the boosting locker
 * @returns
 */
export function computeBoostPercent(
    liquidity: BN,
    poolLiquidity: BN,
    votingPower: BN,
    totalVotingPower: BN
): number {
    const baseLiquidity = liquidity.muln(4).divn(10);
    const effectiveLiquidity = BN.min(
        baseLiquidity.add(
            poolLiquidity
                .mul(votingPower)
                .div(totalVotingPower)
                .muln(6)
                .divn(10)
        ),
        liquidity
    );

    const boostPercent = effectiveLiquidity
        .muln(100)
        .div(baseLiquidity)
        .toNumber();
    return boostPercent;
}
