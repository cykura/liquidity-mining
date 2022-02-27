import { web3 } from "@project-serum/anchor"
import { expectTX } from "@saberhq/chai-solana"
import { SolanaProvider, TransactionEnvelope } from "@saberhq/solana-contrib"
import { Token, MintLayout, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token"

/**
 * Creates two token mints and airdrops to the provider wallet
 * @param provider
 * @returns Mint and ATA addresses
 */
 export async function createMintsAndAirdrop(provider: SolanaProvider): Promise<{
    token0: web3.PublicKey
    token1: web3.PublicKey
    ata0: web3.PublicKey
    ata1: web3.PublicKey
  }> {
    const token0KeyPair = web3.Keypair.fromSecretKey(
      Uint8Array.from([83, 68, 240, 117, 3, 161, 203, 18, 49, 31, 14, 135, 35, 13, 185, 79, 161, 190, 89, 119, 225, 79, 130, 251, 163, 211, 67, 245, 4, 147, 11, 71, 93, 124, 28, 237, 144, 117, 35, 92, 121, 21, 133, 203, 3, 117, 112, 81, 12, 127, 29, 104, 8, 138, 215, 207, 18, 92, 50, 227, 201, 220, 186, 255])
    )
    const token1KeyPair = web3.Keypair.fromSecretKey(
      Uint8Array.from([32, 171, 131, 168, 70, 59, 174, 186, 109, 21, 146, 106, 174, 39, 111, 122, 172, 195, 236, 162, 56, 12, 170, 173, 130, 146, 52, 31, 130, 238, 57, 203, 237, 74, 12, 237, 47, 252, 33, 48, 134, 162, 40, 246, 85, 115, 229, 218, 133, 17, 177, 158, 113, 216, 69, 157, 123, 177, 169, 46, 113, 4, 145, 52])
    )

    const owner = provider.wallet.publicKey
    const lamportsForMint = await Token.getMinBalanceRentForExemptMint(provider.connection)

    // create token mints
    const initMintsTx = new TransactionEnvelope(
      provider,
      [
        web3.SystemProgram.createAccount({
          fromPubkey: owner,
          newAccountPubkey: token0KeyPair.publicKey,
          space: MintLayout.span,
          lamports: lamportsForMint,
          programId: TOKEN_PROGRAM_ID,
        }),
        Token.createInitMintInstruction(
          TOKEN_PROGRAM_ID,
          token0KeyPair.publicKey,
          6,
          owner,
          owner
        ),
        web3.SystemProgram.createAccount({
          fromPubkey: owner,
          newAccountPubkey: token1KeyPair.publicKey,
          space: MintLayout.span,
          lamports: lamportsForMint,
          programId: TOKEN_PROGRAM_ID,
        }),
        Token.createInitMintInstruction(
          TOKEN_PROGRAM_ID,
          token1KeyPair.publicKey,
          6,
          owner,
          owner
        )
      ],
      [token0KeyPair, token1KeyPair]
    )
    await expectTX(initMintsTx, "create token mints").to.be.fulfilled

    // Create token accounts and airdrop
    const ata0 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token0KeyPair.publicKey,
      owner
    )
    const ata1 = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      token1KeyPair.publicKey,
      owner
    )
    const createTokenAccountsTx = new TransactionEnvelope(
      provider,
      [
        Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          token0KeyPair.publicKey,
          ata0,
          owner,
          owner
        ),
        Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          token1KeyPair.publicKey,
          ata1,
          owner,
          owner
        ),
        Token.createMintToInstruction(
          TOKEN_PROGRAM_ID,
          token0KeyPair.publicKey,
          ata0,
          owner,
          [],
          100_000_000
        ),
        Token.createMintToInstruction(
          TOKEN_PROGRAM_ID,
          token1KeyPair.publicKey,
          ata1,
          owner,
          [],
          100_000_000
        )
      ]
    )
    await expectTX(createTokenAccountsTx, "create token accounts and airdrop").to.be.fulfilled

    return {
      token0: token0KeyPair.publicKey,
      token1: token1KeyPair.publicKey,
      ata0,
      ata1,
    }
  }