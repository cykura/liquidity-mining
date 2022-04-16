import { GokiSDK } from "@gokiprotocol/client"
import { web3, BN } from "@project-serum/anchor"
import { expectTX } from "@saberhq/chai-solana"
import { SolanaAugmentedProvider, SolanaProvider } from "@saberhq/solana-contrib"
import { findGovernorAddress, findLockerAddress, findEscrowAddress, TribecaSDK, LockerWrapper, DEFAULT_LOCKER_PARAMS } from "@tribecahq/tribeca-sdk"

/**
 * Sets up a Tribeca escrow and returns necessary addresses
 * Goki (multisig) and Tribeca (governor, locker, escrow) accounts are created
 *
 * @param provider
 */
 export async function setupEscrowAndLockTokens(provider: SolanaAugmentedProvider, govTokenMint: web3.PublicKey): Promise<{
    base: web3.PublicKey
    smartWallet: web3.PublicKey
    governor: web3.PublicKey
    locker: web3.PublicKey
    escrow: web3.PublicKey
  }> {
    const base = web3.Keypair.generate()

    // derive addresses
    const [governor] = await findGovernorAddress(base.publicKey)
    const [locker] = await findLockerAddress(base.publicKey)
    const [escrow] = await findEscrowAddress(locker, provider.wallet.publicKey)

    // goki setup
    const gokiSdk = GokiSDK.load({ provider })
    const { smartWalletWrapper, tx: smartWalletTx } = await gokiSdk.newSmartWallet(
      {
        numOwners: 1,
        owners: [governor],
        threshold: new BN(1),
        base: base,
      }
    )
    await expectTX(smartWalletTx, "create new smartWallet").to.be.fulfilled

    // tribeca governor setup
    const tribecaSdk = TribecaSDK.load({ provider })

    // create governor
    const { wrapper: governorWrapper, tx: createGovernorTx } = await tribecaSdk.govern.createGovernor({
      electorate: locker,
      smartWallet: smartWalletWrapper.key,
      baseKP: base,
    })
    await expectTX(createGovernorTx).to.be.fulfilled

    // create locker
    const { tx: createLockerTx } = await tribecaSdk.createLocker({
      baseKP: base,
      governor: governor,
      govTokenMint,
    })
    await expectTX(createLockerTx).to.be.fulfilled

    const lockerWrapper = await LockerWrapper.load(
      tribecaSdk,
      locker,
      governor
    )

    // create escrow and lock tokens
    const lockTokensTx = await lockerWrapper.lockTokens({
      amount: new BN(10_000),
      duration: new BN(DEFAULT_LOCKER_PARAMS.maxStakeDuration),
    })
    await expectTX(lockTokensTx).to.be.fulfilled

    return {
      base: base.publicKey,
      smartWallet: smartWalletWrapper.key,
      governor,
      locker,
      escrow,
    }
  }