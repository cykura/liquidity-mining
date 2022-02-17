import { GokiSDK } from '@gokiprotocol/client'
import * as anchor from '@project-serum/anchor'
import { web3 } from '@project-serum/anchor'
import { SolanaProvider } from '@saberhq/solana-contrib'
import { ASSOCIATED_TOKEN_PROGRAM_ID, createMint, getATAAddress, TOKEN_PROGRAM_ID } from '@saberhq/token-utils'
import { Token } from '@solana/spl-token'
import { findEscrowAddress, findGovernorAddress, findLockerAddress, LockerWrapper, TribecaSDK } from '@tribecahq/tribeca-sdk'
import keypairFile from './keypair.json'



async function main() {

  const keypair = web3.Keypair.fromSeed(Uint8Array.from(keypairFile.slice(0, 32)))
  console.log('pubkey', keypair.publicKey.toString())
  const wallet = new anchor.Wallet(keypair)
  const connection = new web3.Connection('http://127.0.0.1:8899')
  const anchorProvider = new anchor.Provider(connection, wallet, {})
  anchor.setProvider(anchorProvider)

  const solanaProvider = SolanaProvider.init({
    connection,
    wallet,
    opts: {},
  })

  // base address to derive smart wallet and governor addresses
  const base = web3.Keypair.generate()

  const numOwners = 10
  const ownerA = web3.Keypair.generate()
  // const owners = [ownerA.publicKey];
  const threshold = new anchor.BN(1)

  const lockedAmt = new anchor.BN(1e6)

  // derive addresses -----------------

  const [governorKey] = await findGovernorAddress(base.publicKey)
  const [lockerKey] = await findLockerAddress(base.publicKey)
  const [escrowKey] = await findEscrowAddress(lockerKey, anchorProvider.wallet.publicKey)

  const owners = [governorKey]

  // setup goki multisig smart wallet -----------------

  const gokiSdk = GokiSDK.load({ provider: solanaProvider })

  const { smartWalletWrapper, tx: createSmartWalletTx } = await gokiSdk.newSmartWallet(
    {
      numOwners,
      owners,
      threshold,
      base,
    }
  )
  // Transaction simulation failed: Blockhash not found 
  // let txSig = (await createSmartWalletTx.confirm()).signature;
  const txBuild = createSmartWalletTx.build();
  txBuild.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  let txSig = await anchorProvider.send(txBuild, createSmartWalletTx.signers)
  console.log(`create new smartWallet: ${txSig}`);


  // governance token setup -------------------

  const govTokenMint = await createMint(gokiSdk.provider)

  let ata = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    govTokenMint,
    gokiSdk.provider.walletKey
  )

  // create an ATA for the provider wallet and mint tokens there
  let mintTokenTx = new web3.Transaction()
  mintTokenTx.add(
    Token.createAssociatedTokenAccountInstruction(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      govTokenMint,
      ata,
      gokiSdk.provider.walletKey,
      gokiSdk.provider.walletKey
    )
  )
  mintTokenTx.add(
    Token.createMintToInstruction(
      TOKEN_PROGRAM_ID,
      govTokenMint,
      ata,
      gokiSdk.provider.walletKey,
      [],
      1e8
    )
  )
  await anchorProvider.send(mintTokenTx)

  const escrowATA = await getATAAddress({
    mint: govTokenMint,
    owner: escrowKey,
  })

  // Governor and locker setup ---------------------

  const tribecaSdk = TribecaSDK.load({ provider: solanaProvider })

  // create governor
  const { wrapper: governorWrapper , tx: createGovernorTx } = await tribecaSdk.govern.createGovernor({
    electorate: lockerKey,
    smartWallet: smartWalletWrapper.key,
    baseKP: base,
  })
  txSig = (await createGovernorTx.confirm()).signature;
  console.log(`create new governor: ${txSig}`);

  // create locker
  const { locker, tx: createLockerTx } = await tribecaSdk.createLocker({
    baseKP: base,
    governor: governorKey,
    govTokenMint,
    minStakeDuration: new anchor.BN(1),
  })
  txSig = (await createLockerTx.confirm()).signature;
  console.log(`create new locker: ${txSig}`);

  const lockerWrapper = await LockerWrapper.load(
    tribecaSdk,
    lockerKey,
    governorKey
  )

  const eleData = await lockerWrapper.data()

  console.log(
    eleData.base.toString(),
    "\ntokenMint: ", eleData.tokenMint.toString(),
    eleData.governor.toString(),
    eleData.lockedSupply.toString()
  )

}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err)
    process.exit(-1)
  }
)