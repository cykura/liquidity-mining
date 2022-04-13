import * as anchor from '@project-serum/anchor'
import { web3, BN } from '@project-serum/anchor'
import { expectTX } from '@saberhq/chai-solana'
import { SolanaAugmentedProvider, TransactionEnvelope } from "@saberhq/solana-contrib"
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from '@solana/spl-token'
import {
  BITMAP_SEED,
  CyclosCore,
  FeeAmount,
  FEE_SEED,
  IDL,
  OBSERVATION_SEED,
  POOL_SEED,
  POSITION_SEED,
  TICK_SEED,
  TICK_SPACINGS,
  u16ToSeed,
  u32ToSeed
} from '@cykura/sdk'

export async function createCyclosPosition(
  provider: SolanaAugmentedProvider,
  token0: web3.PublicKey,
  token1: web3.PublicKey
) {
  const cyclosCore = new anchor.Program<CyclosCore>(IDL, new web3.PublicKey('cysPXAjehMpVKUapzbMCCnpFxUFFryEWEaLgnb9NrR8'), anchor.Provider.env())
  const owner = provider.wallet.publicKey

  // pool parameters
  const initialPriceX32 = new anchor.BN(1).shln(31) // price = 1, tick = 0
  const fee = FeeAmount.HIGH
  const tickLower = -200
  const tickUpper = 200
  const tickSpacing = TICK_SPACINGS[fee]
  const wordPosLower = Math.floor(tickLower / tickSpacing) >> 8
  const wordPosUpper = Math.floor(tickUpper / tickSpacing) >> 8

  // derive accounts
  const [factoryState] = await web3.PublicKey.findProgramAddress([], cyclosCore.programId)

  const [initialObservationState] = await web3.PublicKey.findProgramAddress(
    [
      OBSERVATION_SEED,
      token0.toBuffer(),
      token1.toBuffer(),
      u32ToSeed(fee),
      u16ToSeed(0)
    ],
    cyclosCore.programId
  )
  const [feeState] = await web3.PublicKey.findProgramAddress(
    [FEE_SEED, u32ToSeed(fee)],
    cyclosCore.programId
  )

  const [poolState] = await web3.PublicKey.findProgramAddress(
    [
      POOL_SEED,
      token0.toBuffer(),
      token1.toBuffer(),
      u32ToSeed(fee)
    ],
    cyclosCore.programId
  )

  const [tickLowerState] = await web3.PublicKey.findProgramAddress([
    TICK_SEED,
    token0.toBuffer(),
    token1.toBuffer(),
    u32ToSeed(fee),
    u32ToSeed(tickLower)
  ],
    cyclosCore.programId
  )
  const [tickUpperState] = await web3.PublicKey.findProgramAddress([
    TICK_SEED,
    token0.toBuffer(),
    token1.toBuffer(),
    u32ToSeed(fee),
    u32ToSeed(tickUpper)
  ],
    cyclosCore.programId
  )

  const [bitmapLowerState] = await web3.PublicKey.findProgramAddress([
    BITMAP_SEED,
    token0.toBuffer(),
    token1.toBuffer(),
    u32ToSeed(fee),
    u16ToSeed(wordPosLower),
  ],
    cyclosCore.programId
  )
  const [bitmapUpperState] = await web3.PublicKey.findProgramAddress([
    BITMAP_SEED,
    token0.toBuffer(),
    token1.toBuffer(),
    u32ToSeed(fee),
    u16ToSeed(wordPosUpper),
  ],
    cyclosCore.programId
  )

  const [corePositionState] = await web3.PublicKey.findProgramAddress([
    POSITION_SEED,
    token0.toBuffer(),
    token1.toBuffer(),
    u32ToSeed(fee),
    factoryState.toBuffer(),
    u32ToSeed(tickLower),
    u32ToSeed(tickUpper)
  ],
    cyclosCore.programId
  )

  const nftMintKeypair = new web3.Keypair()
  const [tokenizedPositionState] = await web3.PublicKey.findProgramAddress([
    POSITION_SEED,
    nftMintKeypair.publicKey.toBuffer()
  ],
    cyclosCore.programId
  )

  const vault0 = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    token0,
    poolState,
    true
  )
  const vault1 = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    token1,
    poolState,
    true
  )

  const ata0 = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    token0,
    owner
  )
  const ata1 = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    token1,
    owner
  )

  const positionNftAccount = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    nftMintKeypair.publicKey,
    owner,
  )

  // create accounts
  await cyclosCore.rpc.initFactory({
    accounts: {
      owner,
      factoryState,
      systemProgram: web3.SystemProgram.programId,
    }
  })

  await cyclosCore.rpc.enableFeeAmount(fee, tickSpacing, {
    accounts: {
      owner,
      factoryState,
      feeState,
      systemProgram: web3.SystemProgram.programId,
    }
  })

  await cyclosCore.rpc.createAndInitPool(initialPriceX32, {
    accounts: {
      poolCreator: owner,
      token0: token0,
      token1: token1,
      feeState,
      poolState,
      initialObservationState,
      vault0,
      vault1,
      systemProgram: web3.SystemProgram.programId,
      rent: web3.SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    }
  })

  const amount0Desired = new anchor.BN(1_000_000)
  const amount1Desired = new anchor.BN(1_000_000)
  const amount0Minimum = new anchor.BN(0)
  const amount1Minimum = new anchor.BN(0)
  const deadline = new BN(Date.now() / 1000 + 10_000)


  // initialize tick and bitmap accounts

  const createAccountsTx = new TransactionEnvelope(
    provider,
    [
      cyclosCore.instruction.initTickAccount(tickLower, {
        accounts: {
          signer: owner,
          poolState: poolState,
          tickState: tickLowerState,
          systemProgram: web3.SystemProgram.programId,
        }
      }),
      cyclosCore.instruction.initTickAccount(tickUpper, {
        accounts: {
          signer: owner,
          poolState: poolState,
          tickState: tickUpperState,
          systemProgram: web3.SystemProgram.programId,
        }
      }),
      cyclosCore.instruction.initBitmapAccount(wordPosLower, {
        accounts: {
          signer: owner,
          poolState: poolState,
          bitmapState: bitmapLowerState,
          systemProgram: web3.SystemProgram.programId,
        }
      }),
      cyclosCore.instruction.initBitmapAccount(wordPosUpper, {
        accounts: {
          signer: owner,
          poolState: poolState,
          bitmapState: bitmapUpperState,
          systemProgram: web3.SystemProgram.programId,
        }
      }),
      cyclosCore.instruction.initPositionAccount({
        accounts: {
          signer: owner,
          recipient: factoryState,
          poolState,
          tickLowerState,
          tickUpperState,
          positionState: corePositionState,
          systemProgram: web3.SystemProgram.programId,
        }
      })
    ]
  )
  await expectTX(createAccountsTx).to.be.fulfilled

  await cyclosCore.rpc.mintTokenizedPosition(amount0Desired,
    amount1Desired,
    amount0Minimum,
    amount1Minimum,
    deadline, {
    accounts: {
      minter: owner,
      recipient: owner,
      factoryState,
      nftMint: nftMintKeypair.publicKey,
      nftAccount: positionNftAccount,
      poolState: poolState,
      corePositionState,
      tickLowerState,
      tickUpperState,
      bitmapLowerState,
      bitmapUpperState,
      tokenAccount0: ata0,
      tokenAccount1: ata1,
      vault0: vault0,
      vault1: vault1,
      lastObservationState: initialObservationState,
      tokenizedPositionState,
      coreProgram: cyclosCore.programId,
      systemProgram: web3.SystemProgram.programId,
      rent: web3.SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    },
    remainingAccounts: [{
      pubkey: initialObservationState,
      isSigner: false,
      isWritable: true
    }],
    signers: [nftMintKeypair],
  })

  return {
    factoryState,
    feeState,
    poolState,
    vault0,
    vault1,
    nftMint: nftMintKeypair.publicKey,
    nftAccount: positionNftAccount,
  }
}