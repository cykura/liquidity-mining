import { BN } from "@project-serum/anchor";
import invariant from 'tiny-invariant';

export interface RewardOwed {
  reward: BN,
  secondsInsideX32: BN,
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
  totalRewardUnclaimed: BN,
  totalSecondsClaimedX32: BN,
  startTime: BN,
  endTime: BN,
  liquidity: BN,
  secondsPerLiquidityInsideInitialX32: BN,
  secondsPerLiquidityInsideX32: BN,
  currentTime: BN,
}): RewardOwed {
  // this should never be called before the start time
  invariant(currentTime.gte(startTime));

  const secondsInsideX32 = secondsPerLiquidityInsideX32
    .sub(secondsPerLiquidityInsideInitialX32)
    .mul(liquidity)

  const totalSecondsUnlaimedX32 = BN.max(currentTime, endTime)
    .sub(startTime)
    .shln(32)
    .sub(totalSecondsClaimedX32)

  const reward = totalRewardUnclaimed.mul(secondsInsideX32).div(totalSecondsUnlaimedX32)

  return { reward, secondsInsideX32 }
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
  totalRewardUnclaimed: BN,
  totalSecondsClaimedX32: BN,
  startTime: BN,
  endTime: BN,
  liquidity: BN,
  secondsPerLiquidityInsideInitialX32: BN,
  secondsPerLiquidityInsideX32: BN,
  currentTime: BN,
  totalPoolLiquidity: BN,
  votingPower: BN,
  totalVotingPower: BN,
}): RewardOwed {
  // this should never be called before the start time
  invariant(currentTime.gte(startTime));

  const effectiveLiquidity = BN.min(
    liquidity.muln(0.4)
      .add(
        totalPoolLiquidity.mul(votingPower).div(totalVotingPower).muln(0.6)
      ),
    liquidity
  )
  const secondsInsideX32 = secondsPerLiquidityInsideX32
    .sub(secondsPerLiquidityInsideInitialX32)
    .mul(effectiveLiquidity)

  const adjustedCurrentTime = endTime.gt(currentTime) ? endTime : currentTime
  const totalSecondsUnlaimedX32 = adjustedCurrentTime
    .sub(startTime)
    .shln(32)
    .sub(totalSecondsClaimedX32)

  const reward = totalRewardUnclaimed.mul(secondsInsideX32).div(totalSecondsUnlaimedX32)

  return { reward, secondsInsideX32 }
}

/**
 * Compute boost percent for a user's LP position
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
  totalVotingPower: BN,
): number {
  const effectiveLiquidity = BN.min(
    liquidity.muln(0.4)
      .add(
        poolLiquidity.mul(votingPower).div(totalVotingPower).muln(0.6)
      ),
    liquidity
  )

  const boost = effectiveLiquidity.sub(liquidity)
  const boostPercent = boost.div(liquidity).muln(100).toNumber()

  return boostPercent
}