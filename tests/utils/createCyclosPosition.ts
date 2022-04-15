import * as anchor from '@project-serum/anchor'
import { web3, BN } from '@project-serum/anchor'
import { expectTX } from '@saberhq/chai-solana'
import { PublicKey, SolanaAugmentedProvider, TransactionEnvelope } from "@saberhq/solana-contrib"
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from '@solana/spl-token'
import {
  BITMAP_SEED,
  CyclosCore,
  FACTORY_ADDRESS,
  FeeAmount,
  FEE_SEED,
  IDL,
  OBSERVATION_SEED,
  Pool,
  POOL_SEED,
  POSITION_SEED,
  TICK_SEED,
  TICK_SPACINGS,
  u16ToSeed,
  u32ToSeed,
} from '@cykura/sdk'
import { createATAInstruction, getATAAddress } from '@saberhq/token-utils'
import { CurrencyAmount, Token as UniToken } from '@cykura/sdk-core'
import JSBI from 'jsbi'
import SolanaTickDataProvider from './SolanaTickDataProvider'

export async function createCyclosPosition(
  provider: SolanaAugmentedProvider,
  token0: web3.PublicKey,
  token1: web3.PublicKey
) {
  const cyclosCore = new anchor.Program<CyclosCore>(IDL, new web3.PublicKey('cysPXAjehMpVKUapzbMCCnpFxUFFryEWEaLgnb9NrR8'), anchor.Provider.env())
  const owner = provider.wallet.publicKey

  // pool parameters
  const initialPriceX32 = new anchor.BN(1).shln(32) // price = 1, tick = 0
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
      systemProgram: web3.SystemProgram.programId,
      rent: web3.SYSVAR_RENT_PUBKEY,
    }
  })

  const amount0Desired = new anchor.BN(1_000_000)
  const amount1Desired = new anchor.BN(1_000_000)
  const amount0Minimum = new anchor.BN(100_000)
  const amount1Minimum = new anchor.BN(100_000)
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

  await cyclosCore.rpc.mintTokenizedPosition(
    amount0Desired,
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
    instructions: [
      createATAInstruction({
        address: vault0,
        mint: token0,
        owner: poolState,
        payer: provider.walletKey
      }),
      createATAInstruction({
        address: vault1,
        mint: token1,
        owner: poolState,
        payer: provider.walletKey
      })
    ]
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

export async function swapExactInput(
  provider: SolanaAugmentedProvider,
  poolState: web3.PublicKey,
) {
  // no sdk = ngmi

  const cyclosCore = new anchor.Program<CyclosCore>(IDL, new web3.PublicKey('cysPXAjehMpVKUapzbMCCnpFxUFFryEWEaLgnb9NrR8'), anchor.Provider.env())
  const owner = provider.wallet.publicKey

  const deadline = new BN(Date.now() / 1000 + 10_000)

  const {
    token0,
    token1,
    fee,
    observationIndex,
    observationCardinalityNext,
    sqrtPriceX32,
    liquidity,
    tick
  } = await cyclosCore.account.poolState.fetch(poolState)

  const [factoryState] = await PublicKey.findProgramAddress([], cyclosCore.programId)

  const lastObservationAState = (await PublicKey.findProgramAddress(
    [
      OBSERVATION_SEED,
      token0.toBuffer(),
      token1.toBuffer(),
      u32ToSeed(fee),
      u16ToSeed(observationIndex)
    ],
    cyclosCore.programId
  ))[0]

  const nextObservationAState = (await PublicKey.findProgramAddress(
    [
      OBSERVATION_SEED,
      token0.toBuffer(),
      token1.toBuffer(),
      u32ToSeed(fee),
      u16ToSeed((observationIndex + 1) % observationCardinalityNext)
    ],
    cyclosCore.programId
  ))[0]

  const tickDataProvider = new SolanaTickDataProvider(cyclosCore, {
    token0,
    token1,
    fee,
  })
  await tickDataProvider.eagerLoadCache(tick, TICK_SPACINGS[fee])

  const uniToken0 = new UniToken(0, token0, 6)
  const uniToken1 = new UniToken(0, token1, 6)
  const uniPoolA = new Pool(
    uniToken0,
    uniToken1,
    fee,
    JSBI.BigInt(sqrtPriceX32),
    JSBI.BigInt(liquidity),
    tick,
    tickDataProvider
  )

  const amountIn = new BN(1_000_000)
  const amountOutMinimum = new BN(0)
  const [expectedAmountOut, expectedNewPool, swapAccounts] = uniPoolA.getOutputAmount(
    CurrencyAmount.fromRawAmount(uniToken0, amountIn.toNumber())
  )
  console.log('amount in', CurrencyAmount.fromRawAmount(uniToken0, amountIn.toNumber()).toFixed())
  console.log('expected amount out', expectedAmountOut.toFixed())
  const minterWallet0 = await getATAAddress({
    mint: token0,
    owner: provider.walletKey,
  })
  const minterWallet1 = await getATAAddress({
    mint: token1,
    owner: provider.walletKey,
  })
  const vault0 = await getATAAddress({
    mint: token0,
    owner: poolState,
  })
  const vault1 = await getATAAddress({
    mint: token1,
    owner: poolState,
  })

  await cyclosCore.rpc.exactInput(
    deadline,
    amountIn,
    amountOutMinimum,
    Buffer.from([2]),
    {
      accounts: {
        signer: owner,
        factoryState,
        inputTokenAccount: minterWallet0,
        coreProgram: FACTORY_ADDRESS,
        tokenProgram: TOKEN_PROGRAM_ID,
      }, remainingAccounts: [{
        pubkey: poolState,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: minterWallet1, // outputTokenAccount
        isSigner: false,
        isWritable: true
      }, {
        pubkey: vault0, // input vault
        isSigner: false,
        isWritable: true
      }, {
        pubkey: vault1, // output vault
        isSigner: false,
        isWritable: true
      }, {
        pubkey: lastObservationAState,
        isSigner: false,
        isWritable: true
      },
      ...swapAccounts,
      {
        pubkey: nextObservationAState,
        isSigner: false,
        isWritable: true
      },
      ]
    }
  )
}