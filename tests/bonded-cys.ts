import * as chai from "chai"
import * as anchor from "@project-serum/anchor"
import { web3, BN } from '@project-serum/anchor'
import { chaiSolana, expectTX } from '@saberhq/chai-solana'
import { createMint, createMintAndVault, createMintInstructions, getATAAddress, getMintInfo, getTokenAccount } from "@saberhq/token-utils"
import { setupWorkspace } from "./utils/setupWorkspace"
import { PublicKey, TransactionEnvelope } from "@saberhq/solana-contrib"
import { findBondManager } from "../src"
import { bondedCys, createNewToken, testCys } from "./bonded-cys-utils/testToken"
import { assert } from "chai"
import { MintLayout, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token"

chai.use(chaiSolana)

describe('bonded cys', () => {
  const sdk = setupWorkspace()
  const provider = sdk.provider

  let cys = testCys.publicKey
  let cysWallet: PublicKey
  let bCys = bondedCys.publicKey
  let bondManager: PublicKey
  let escrow: PublicKey
  let bondedCysWallet: PublicKey

  const bondAmount = new BN(100)

  it('mint test cys', async () => {
    cysWallet = await createNewToken(provider, testCys)
  })

  it('setup bonded CYS mint', async () => {
    [bondManager] = await findBondManager()
    escrow = await getATAAddress({ mint: cys, owner: bondManager })
    bondedCysWallet = await getATAAddress({ mint: bCys, owner: provider.walletKey })
    console.log('bonded cys wallet', bondedCysWallet.toString())

    const lamportsForMint = await Token.getMinBalanceRentForExemptMint(provider.connection)
    // create a token mint with the bond manager as the minting authority
    const createBondedCysTx = new TransactionEnvelope(
      provider,
      [
        web3.SystemProgram.createAccount({
          fromPubkey: provider.walletKey,
          newAccountPubkey: bCys,
          space: MintLayout.span,
          lamports: lamportsForMint,
          programId: TOKEN_PROGRAM_ID,
        }),
        Token.createInitMintInstruction(
          TOKEN_PROGRAM_ID,
          bCys,
          6,
          bondManager,
          undefined,
        )
      ],
      [bondedCys]
    )
    await expectTX(createBondedCysTx, "create BCYS mint").to.be.fulfilled
  })

  it('bond CYS', async () => {
    const bondTx = await sdk.bond(bondAmount)
    await expectTX(bondTx, "bond CYS").to.be.fulfilled

    const escrowData = await getTokenAccount(provider, escrow)
    const bondedCysWalletData = await getTokenAccount(provider, bondedCysWallet)
    assert(escrowData.amount.eq(bondAmount))
    assert(bondedCysWalletData.amount.eq(bondAmount))
  })

})