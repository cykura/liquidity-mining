import * as chai from "chai";
import * as anchor from '@project-serum/anchor';
import { Program, web3 } from '@project-serum/anchor';
import { PublicKey, SignerWallet, SolanaProvider, TransactionEnvelope } from '@saberhq/solana-contrib';
import { GokiSDK, SmartWalletWrapper } from '@gokiprotocol/client';
import { chaiSolana, expectTX } from '@saberhq/chai-solana';
import { ASSOCIATED_TOKEN_PROGRAM_ID, createMint, getATAAddress, getOrCreateATA, getTokenAccount, sleep, TOKEN_PROGRAM_ID } from '@saberhq/token-utils';
import { Token } from '@solana/spl-token';
import { findEscrowAddress, findGovernorAddress, findLockerAddress, GovernorWrapper, LockerWrapper, TribecaSDK, DEFAULT_LOCKER_PARAMS, findWhitelistAddress, VoteEscrow } from '@tribecahq/tribeca-sdk';
import { LiquidityMining } from '../target/types/liquidity_mining';
import { Buffer } from 'buffer';
import { expect } from 'chai';
import { BN } from '@project-serum/anchor';

chai.use(chaiSolana);


const expectLockedSupply = async (
  locker: LockerWrapper,
  expectedSupply: BN
): Promise<void> => {
  const lockerData = await locker.reload();
  expect(lockerData.lockedSupply).to.bignumber.eq(expectedSupply);
};

describe('liquidity-mining', () => {
  const anchorProvider = anchor.Provider.env();
  anchor.setProvider(anchorProvider);

  const solanaProvider = SolanaProvider.init({
    connection: anchorProvider.connection,
    wallet: anchorProvider.wallet,
    opts: anchorProvider.opts,
  });

  const program = anchor.workspace.LiquidityMining as Program<LiquidityMining>;

  // base address to derive smart wallet and governor addresses
  const base = web3.Keypair.generate();

  // goki smart wallet
  let gokiSdk: GokiSDK
  const numOwners = 10;
  const ownerA = web3.Keypair.generate();
  let owners: PublicKey[];
  // const owners = [ownerA.publicKey];
  const threshold = new anchor.BN(1);
  let smartWalletWrapper: SmartWalletWrapper;

  // governance token
  let govTokenMint: PublicKey;

  // Tribeca governor
  let tribecaSdk: TribecaSDK;
  let lockerKey: PublicKey;
  let governorKey: PublicKey;
  let escrowATA: PublicKey;
  let escrowKey: PublicKey;
  let governorWrapper: GovernorWrapper;
  let lockerWrapper: LockerWrapper;

  const lockedAmt = new anchor.BN(1e6);

  it('derive addresses', async () => {
    [governorKey] = await findGovernorAddress(base.publicKey);
    [lockerKey] = await findLockerAddress(base.publicKey);
    [escrowKey] = await findEscrowAddress(lockerKey, anchorProvider.wallet.publicKey);

    owners = [governorKey]
  })

  it('setup goki multisig smart wallet', async () => {
    gokiSdk = GokiSDK.load({ provider: solanaProvider });

    const { smartWalletWrapper: wrapperInner, tx } = await gokiSdk.newSmartWallet(
      {
        numOwners,
        owners,
        threshold,
        base: base,
      }
    );
    await expectTX(tx, "create new smartWallet").to.be.fulfilled;
    smartWalletWrapper = wrapperInner;
  })

  it('governance token setup', async () => {
    govTokenMint = await createMint(gokiSdk.provider);

    let ata = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      govTokenMint,
      gokiSdk.provider.walletKey
    );

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

    escrowATA = await getATAAddress({
      mint: govTokenMint,
      owner: escrowKey,
    });
  })

  it('Governor and locker setup', async () => {
    tribecaSdk = TribecaSDK.load({ provider: solanaProvider });

    // create governor
    const { wrapper: governorWrapperInner, tx: createGovernorTx } = await tribecaSdk.govern.createGovernor({
      electorate: lockerKey,
      smartWallet: smartWalletWrapper.key,
      baseKP: base,
    })
    await expectTX(createGovernorTx).to.be.fulfilled;
    governorWrapper = governorWrapperInner;

    // create locker
    const { locker, tx: createLockerTx } = await tribecaSdk.createLocker({
      baseKP: base,
      governor: governorKey,
      govTokenMint,
      minStakeDuration: new anchor.BN(1e6),
    });
    await expectTX(createLockerTx).to.be.fulfilled;

    lockerWrapper = await LockerWrapper.load(
      tribecaSdk,
      lockerKey,
      governorKey
    );

    const eleData = await lockerWrapper.data();

    console.log(
      eleData.base.toString(),
      "\ntokenMint: ",eleData.tokenMint.toString(),
      eleData.governor.toString(),
      eleData.lockedSupply.toString()
      )
  })

  it('setup escrow and lock tokens', async () => {
    // automatically creates escrow if it doesn't exist, and locks tokens inside
    const lockTokensTx = await lockerWrapper.lockTokens({
      amount: lockedAmt,
      duration: new anchor.BN(1e6),
    });

    await expectTX(lockTokensTx).to.be.fulfilled;
    await expectLockedSupply(lockerWrapper, lockedAmt);

    const escrowWrapper = new VoteEscrow( 
      tribecaSdk,
      lockerKey,
      governorKey,
      escrowKey,
      anchorProvider.wallet.publicKey,
    );
    console.log("Voting power: ", await escrowWrapper.calculateVotingPower());
 
    const escData = await lockerWrapper.fetchEscrow(escrowKey);
    console.log("Amount after lockup: ", escData.amount.toString());
    console.log("Escrow start: ", escData.escrowStartedAt.toString());
    console.log("Escrow End: ", escData.escrowEndsAt.toString());
    console.log("lockup time: ", escData.escrowEndsAt.sub(escData.escrowStartedAt).toString());

    const escrowtokenAccInfo = await getTokenAccount(tribecaSdk.provider, escrowATA);
    expect(escrowtokenAccInfo.amount).to.bignumber.eq(lockedAmt);
  })

  it('extend lockup duration', async () => {
    // There is no separate function for extending time period so we have to call lockTokens() function again
    const lockTokensTx = await lockerWrapper.lockTokens({
      amount: new anchor.BN(0),
      duration: new anchor.BN(1e7),
    });
    await expectTX(lockTokensTx).to.be.fulfilled;
    await expectLockedSupply(lockerWrapper, lockedAmt);

    const escrow = await lockerWrapper.fetchEscrow(escrowKey);
    console.log("Escrow start after update: ", escrow.escrowStartedAt.toString());
    console.log("Escrow End after update: ", escrow.escrowEndsAt.toString());
    console.log("New extended time: ", escrow.escrowEndsAt.sub(escrow.escrowStartedAt).toString());
  })

  // it('withdraw tokens from lockup', async () => {
  //   // The tokens are withdrawn from the escrow
  //   await sleep(2500);
  //   const { locker } = lockerWrapper;
  //   const lockData = await lockerWrapper.data();

  //   const [escKey, bump] = await findEscrowAddress(locker, anchorProvider.wallet.publicKey);
  //   const escrowATA = await getATAAddress({
  //     mint: lockData.tokenMint,
  //     owner: escKey,
  //   });
  //   const fEscrow = await lockerWrapper.fetchEscrow(escKey);
  //   console.log("Extended time: ", fEscrow.escrowEndsAt.sub(fEscrow.escrowStartedAt).toString());

  //   const exitTx = await lockerWrapper.exit({ authority: anchorProvider.wallet.publicKey });
  //   await expectTX(exitTx, "exit lock up").to.be.fulfilled;

  //   const tokenAcc = await getTokenAccount(tribecaSdk.provider, escrowATA);
  //   expect(tokenAcc.amount).to.bignumber.eq(new anchor.BN(0));
  //   await expectLockedSupply(lockerWrapper, new anchor.BN(0));
  // })

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({
      accounts: {
        locker: lockerKey,
        escrow: escrowKey,
      }
    });
    console.log("Your transaction signature: \t", tx);
  });
});
