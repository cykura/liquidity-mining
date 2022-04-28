import { web3 } from "@project-serum/anchor"
import { expectTX } from "@saberhq/chai-solana"
import { SolanaAugmentedProvider, SolanaProvider, TransactionEnvelope } from "@saberhq/solana-contrib"
import { Token, MintLayout, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token"

/**
 * Creates test CYS and airdrops to the provider wallet
 * @param provider
 * @returns Mint and ATA addresses
 */
export async function createTestCys(provider: SolanaProvider): Promise<{
  cys: web3.PublicKey
  ata: web3.PublicKey
}> {
  // pubkey- 4UyKKoK5s2cur87ARnu1gZKcWnUoYjAZPv2HAXgzzfuk
  const testnetCys = web3.Keypair.fromSecretKey(
    Uint8Array.from([171, 77, 109, 151, 34, 228, 133, 224, 158, 44, 234, 225, 183, 68, 52, 238, 247, 87, 14, 61, 213, 50, 225, 52, 131, 108, 171, 116, 227, 164, 1, 242, 51, 189, 107, 84, 33, 132, 136, 7, 173, 200, 244, 236, 3, 74, 47, 7, 183, 156, 72, 155, 105, 37, 72, 246, 213, 43, 40, 193, 82, 167, 110, 35])
  )

  const owner = provider.wallet.publicKey
  const lamportsForMint = await Token.getMinBalanceRentForExemptMint(provider.connection)

  const ata = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    testnetCys.publicKey,
    owner
  )

  // create token mints
  const initMintsTx = new TransactionEnvelope(
    provider,
    [
      web3.SystemProgram.createAccount({
        fromPubkey: owner,
        newAccountPubkey: testnetCys.publicKey,
        space: MintLayout.span,
        lamports: lamportsForMint,
        programId: TOKEN_PROGRAM_ID,
      }),
      Token.createInitMintInstruction(
        TOKEN_PROGRAM_ID,
        testnetCys.publicKey,
        6,
        owner,
        owner
      ),
      Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        testnetCys.publicKey,
        ata,
        owner,
        owner
      ),
      Token.createMintToInstruction(
        TOKEN_PROGRAM_ID,
        testnetCys.publicKey,
        ata,
        owner,
        [],
        100_000_000
      ),
    ],
    [testnetCys]
  )
  await expectTX(initMintsTx, "create testnet cys").to.be.fulfilled

  return {
    cys: testnetCys.publicKey,
    ata,
  }
}