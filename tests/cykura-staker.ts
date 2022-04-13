import * as chai from "chai"
import * as anchor from '@project-serum/anchor'
import { Program, web3, BN } from '@project-serum/anchor'
import { PublicKey, TransactionEnvelope } from '@saberhq/solana-contrib'
import { chaiSolana, expectTX } from '@saberhq/chai-solana'
import { assert, expect } from 'chai'
import { createMintsAndAirdrop } from "./utils/createMintsAndAirdrop"
import { setupEscrowAndLockTokens } from "./utils/setupEscrowAndLockTokens"
import { setupWorkspace } from "./utils/setupWorkspace"
import { createCyclosPosition } from "./utils/createCyclosPosition"
import { DepositWrapper, IncentiveWrapper, RewardWrapper } from "../src"
import { StakeWrapper } from "../src/wrappers/stake"

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

    startTime = new BN(blockTime + 10)
    endTime = new BN(blockTime + 20)

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
  })

  it('add reward in the incentive', async () => {
    const addRewardTx = await incentiveWrapper.addReward(rewardAmount)
    await expectTX(addRewardTx, "add reward").to.be.fulfilled

    const incentiveData = await incentiveWrapper.reload()
    assert(incentiveData.totalRewardUnclaimed.eq(rewardAmount))
  })

  it('deposit NFT in staker', async () => {
    const { deposit: _depositWrapper, tx: createDepositTx } = await cykuraStakerSdk.createDeposit(ammAccounts.nftAccount)
    depositWrapper = _depositWrapper
    await createDepositTx.send()

    const depositData = await depositWrapper.data()
  })
})
