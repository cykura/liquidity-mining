import { web3 } from "@project-serum/anchor"
import { expectTX } from "@saberhq/chai-solana"
import { SolanaAugmentedProvider, TransactionEnvelope } from "@saberhq/solana-contrib"
import { Token, MintLayout, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token"

/**
 * Creates a token mint on the provided keypair, and mints tokens on the provider's ATA
 * @param provider
 * @param keypair
 * @returns ATA address
 */
export async function createNewToken(provider: SolanaAugmentedProvider, keypair: web3.Keypair) {
  const owner = provider.wallet.publicKey
  const lamportsForMint = await Token.getMinBalanceRentForExemptMint(provider.connection)

  const ata = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    keypair.publicKey,
    owner
  )

  // create token mints
  const initMintsTx = new TransactionEnvelope(
    provider,
    [
      web3.SystemProgram.createAccount({
        fromPubkey: owner,
        newAccountPubkey: keypair.publicKey,
        space: MintLayout.span,
        lamports: lamportsForMint,
        programId: TOKEN_PROGRAM_ID,
      }),
      Token.createInitMintInstruction(
        TOKEN_PROGRAM_ID,
        keypair.publicKey,
        6,
        owner,
        owner
      ),
      Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        keypair.publicKey,
        ata,
        owner,
        owner
      ),
      Token.createMintToInstruction(
        TOKEN_PROGRAM_ID,
        keypair.publicKey,
        ata,
        owner,
        [],
        100_000_000
      ),
    ],
    [keypair]
  )
  await expectTX(initMintsTx, "create testnet cys").to.be.fulfilled

  return ata
}

// pubkey- 4UyKKoK5s2cur87ARnu1gZKcWnUoYjAZPv2HAXgzzfuk
export const testCys = web3.Keypair.fromSecretKey(
  Uint8Array.from([171, 77, 109, 151, 34, 228, 133, 224, 158, 44, 234, 225, 183, 68, 52, 238, 247, 87, 14, 61, 213, 50, 225, 52, 131, 108, 171, 116, 227, 164, 1, 242, 51, 189, 107, 84, 33, 132, 136, 7, 173, 200, 244, 236, 3, 74, 47, 7, 183, 156, 72, 155, 105, 37, 72, 246, 213, 43, 40, 193, 82, 167, 110, 35])
)

// pubkey- 6Qj6NpbXLyVCwA4Qsjr7JdwvwkLhokouB3bSb3ZhhtHE
export const bondedCys = web3.Keypair.fromSecretKey(
  Uint8Array.from([244, 23, 32, 210, 195, 84, 41, 38, 60, 127, 231, 213, 34, 107, 81, 75, 65, 249, 212, 183, 76, 186, 92, 38, 2, 202, 43, 112, 35, 110, 134, 227, 80, 94, 99, 57, 203, 219, 86, 52, 12, 182, 13, 236, 15, 136, 163, 168, 147, 212, 170, 190, 236, 17, 85, 94, 200, 185, 93, 147, 91, 166, 237, 25])
)
