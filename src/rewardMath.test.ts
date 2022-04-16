import { BN } from "@project-serum/anchor"
import { assert } from "chai"
import { computeRewardAmountBoosted } from "./rewardMath"

describe('rewardMath', () => {
    it('computeRewardAmountBoosted', () => {
        const amt = computeRewardAmountBoosted({
            totalRewardUnclaimed: new BN(1000000),
            totalSecondsClaimedX32: new BN(0),
            startTime: new BN(1650101377),
            endTime: new BN(1650101385),
            liquidity: new BN(100505830),
            secondsPerLiquidityInsideInitialX32: new BN(256),
            secondsPerLiquidityInsideX32: new BN(299),
            currentTime: new BN(1650101382),
            totalPoolLiquidity: new BN(100505830),
            votingPower: new BN(634),
            totalVotingPower: new BN(100000),
        })
        assert(amt.reward.eqn(50790))
    })
})