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
  }

  let startTime: BN
  let endTime: BN

  it('create token mints and airdrop to wallet', async () => {
    ({ token0, token1, ata0, ata1 } = await createMintsAndAirdrop(provider))
  })
  it('setup locker and escrow', async () => {
    ({ locker, escrow } = await setupEscrowAndLockTokens(provider, token0))
  })

  it('create cyclos pool and position', async () => {
    ammAccounts = await createCyclosPosition(provider, token0, token1)
  })

  it('create a new incentive', async () => {
    const slot = await provider.connection.getSlot()
    const blockTime = await provider.connection.getBlockTime(slot)
    console.log('block time', blockTime)

    startTime = new BN(blockTime + 10)
    endTime = new BN(blockTime + 20)

    const { wrapper: incentiveWrapper, tx: createIncentiveTx } = await cykuraStakerSdk.createIncentiveBoosted({
      rewardToken: token0,
      pool: ammAccounts.poolState,
      startTime,
      endTime,
      locker,
      refundee: owner,
    })
    // console.log('sending tx')
    // console.log('signer', owner.toString())
    // await createIncentiveTx.send()
    await expectTX(createIncentiveTx, "create incentive").to.be.fulfilled;

    const incentiveData = await incentiveWrapper.data()
    console.log('incentive data', incentiveWrapper)
    assert(incentiveData.rewardToken.equals(token0))
    assert(incentiveData.pool.equals(ammAccounts.poolState))
    assert(incentiveData.refundee.equals(owner))

    assert(incentiveData.startTime.eq(startTime))
    assert(incentiveData.endTime.eq(endTime))
    assert(incentiveData.boostLocker.equals(locker))
  })
})
