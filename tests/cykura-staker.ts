import * as chai from "chai"
import { web3, BN } from '@project-serum/anchor'
import { PublicKey } from '@saberhq/solana-contrib'
import { chaiSolana, expectTX } from '@saberhq/chai-solana'
import { assert } from 'chai'
import { createMintsAndAirdrop } from "./utils/createMintsAndAirdrop"
import { setupEscrowAndLockTokens } from "./utils/setupEscrowAndLockTokens"
import { setupWorkspace } from "./utils/setupWorkspace"
import { createCyclosPosition, swapExactInput } from "./utils/createCyclosPosition"
import { DepositWrapper, IncentiveWrapper, RewardWrapper } from "../src"
import { StakeWrapper } from "../src/wrappers/stake"
import { sleep } from "@saberhq/token-utils"

chai.use(chaiSolana)

/**
 * Integration tests for Cykura staker (liquidity mining)
 *
 * For a cyclos pool of [token0, token1, 500 fee], offer a liquidity mining incentive in token0.
 * Token0 is also the governance token which gives a liquidity mining boost.
 */
describe('cykura-staker', () => {
  const cykuraStakerSdk = setupWorkspace()
  const provider = cykuraStakerSdk.provider
  const owner = provider.wallet.publicKey

  // token accounts and ATAs
  let token0: web3.PublicKey
  let token1: web3.PublicKey
  let ata0: web3.PublicKey
  let ata1: web3.PublicKey

  // Tribeca accounts
  let locker: web3.PublicKey
  let escrow: web3.PublicKey

  // Cyclos core
  let ammAccounts: {
    factoryState: PublicKey,
    feeState: PublicKey,
    poolState: PublicKey,
    vault0: PublicKey,
    vault1: PublicKey,
    nftMint: PublicKey,
    nftAccount: PublicKey,
  }

  const rewardAmount = new BN(1_000_000)
  let startTime: BN
  let endTime: BN
  let incentiveWrapper: IncentiveWrapper
  let depositWrapper: DepositWrapper
  let rewardWrapper: RewardWrapper
  let stakeWrapper: StakeWrapper

  it('create token mints and airdrop to wallet', async () => {
    ({ token0, token1, ata0, ata1 } = await createMintsAndAirdrop(provider))
  })
  it('setup locker and escrow', async () => {
    ({ locker, escrow } = await setupEscrowAndLockTokens(provider, token0))
  })

  it('create cyclos pool and position', async () => {
    ammAccounts = await createCyclosPosition(provider, token0, token1)
  })

  it('create a new boosted incentive', async () => {
    const slot = await provider.connection.getSlot()
    const blockTime = await provider.connection.getBlockTime(slot)

    startTime = new BN(blockTime + 2)
    endTime = new BN(blockTime + 10)

    const { wrapper: _incentiveWrapper, tx: createIncentiveTx } = await cykuraStakerSdk.createIncentiveBoosted({
      rewardToken: token0,
      pool: ammAccounts.poolState,
      startTime,
      endTime,
      locker,
      refundee: owner,
    })
    incentiveWrapper = _incentiveWrapper

    await expectTX(createIncentiveTx, "create incentive").to.be.fulfilled

    const incentiveData = await incentiveWrapper.data()
    assert(incentiveData.rewardToken.equals(token0))
    assert(incentiveData.pool.equals(ammAccounts.poolState))
    assert(incentiveData.refundee.equals(owner))
    assert(incentiveData.startTime.eq(startTime))
    assert(incentiveData.endTime.eq(endTime))
    assert(incentiveData.boostLocker.equals(locker))
    assert.equal(incentiveData.numberOfStakes, 0)
  })

  it('add reward in the incentive', async () => {
    const addRewardTx = await incentiveWrapper.addReward(rewardAmount)
    await expectTX(addRewardTx, "add reward").to.be.fulfilled

    const incentiveData = await incentiveWrapper.reload()
    assert(incentiveData.totalRewardUnclaimed.eq(rewardAmount))
  })

  it('deposit and stake NFT', async () => {
    await sleep(2000) // wait till incentive starts

    // deposit and stake in a single TX. To do them separately, you can use `createDeposit()` and `stakeToken()`
    const {
      deposit: _depositWrapper,
      stake: _stakeWrapper,
      tx: createDepositAndStakeTx
    } = await cykuraStakerSdk.depositAndStake(
      ammAccounts.nftAccount,
      incentiveWrapper.incentiveKey
    )
    depositWrapper = _depositWrapper
    stakeWrapper = _stakeWrapper

    await expectTX(createDepositAndStakeTx, "create deposit and stake").to.be.fulfilled
  })

  it('perform a swap to earn liquidity mining reward', async () => {
    await swapExactInput(provider, ammAccounts.poolState)
    await sleep(1000)
  })

  it('unstake and collect reward', async () => {
    // read accumulated reward
    const time = await provider.connection.getBlockTime(
      await provider.connection.getSlot()
    )
    const rewardInfo = await stakeWrapper.getRewardInfo(time)
    console.log(
      'reward',
      rewardInfo.reward.toNumber(),
      'seconds inside x32',
      rewardInfo.secondsInsideX32.toString(),
      'boost percent',
      rewardInfo.boostPercent
    )

    // create a reward account and unstake
    const { reward: _rewardWrapper, tx: unstakeTx } = await stakeWrapper.unstakeToken(depositWrapper)
    rewardWrapper = _rewardWrapper
    await unstakeTx.send()

    await expectTX(unstakeTx, "unstake LP NFT").to.be.fulfilled
    // Should be slightly more than the client side calculation, as time taken for the TX to process
    // is accounted.
    const { rewardsOwed } =  await rewardWrapper.data()
    console.log('reward owed', rewardsOwed.toString())

    // transfer out reward from reward account to the user
    const u64Max = new BN(1).shln(63) // pass u64::MAX to completely transfer entire pending reward
    const claimRewardTx = await rewardWrapper.claimReward(u64Max, token0)
    await expectTX(claimRewardTx, "claim reward").to.be.fulfilled

    // Notes-
    // 1. Use `unstakeTx.combine(claimRewardTx)` to recieve rewards in your wallet in a single TX
    // 2. call withdrawToken if you wish to remove the user from the farm
    // 3. If you wish to harvest the rewards and continue farming, call stakeToken() again.
  })

  it('withdraw token and exit from farm', async () => {
    const withdrawTokenTx = await depositWrapper.withdrawToken()
    await expectTX(withdrawTokenTx, "withdraw token").to.be.fulfilled
  })

  it('end the incentive and reclaim leftover reward', async () => {
    console.log('waiting for incentive to end')
    await sleep(11000)
    const endIncentiveTx = await incentiveWrapper.endIncentive()
    await expectTX(endIncentiveTx, "end incentive").to.be.fulfilled
  })
})
