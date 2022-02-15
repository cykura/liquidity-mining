import * as chai from "chai";
import * as anchor from '@project-serum/anchor';
import { Program, web3 } from '@project-serum/anchor';
import { PublicKey, SolanaProvider, TransactionEnvelope } from '@saberhq/solana-contrib';
import { GokiSDK, SmartWalletWrapper } from '@gokiprotocol/client';
import { chaiSolana, expectTX } from '@saberhq/chai-solana';
import { ASSOCIATED_TOKEN_PROGRAM_ID, createMint, TOKEN_PROGRAM_ID } from '@saberhq/token-utils';
import { Token } from '@solana/spl-token';
import { findEscrowAddress, findGovernorAddress, findLockerAddress, GovernorWrapper, LockerWrapper, TribecaSDK } from '@tribecahq/tribeca-sdk';
import { LiquidityMining } from '../target/types/liquidity_mining';

chai.use(chaiSolana);

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
  let escrowKey: PublicKey;
  let governorWrapper: GovernorWrapper;
  let lockerWrapper: LockerWrapper;

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
    const { tx: createLockerTx } = await tribecaSdk.createLocker({
      baseKP: base,
      governor: governorKey,
      govTokenMint,
    });
    await expectTX(createLockerTx).to.be.fulfilled;

    lockerWrapper = await LockerWrapper.load(
      tribecaSdk,
      lockerKey,
      governorKey
    );
  })

  it('setup escrow and lock tokens', async () => {
    // automatically creates escrow if it doesn't exist, and locks tokens inside
    const lockTokensTx = await lockerWrapper.lockTokens({
      amount: new anchor.BN(1e6),
      duration: new anchor.BN(2592000)
    });

    await expectTX(lockTokensTx).to.be.fulfilled;
  })

  it('extend lockup duration', async () => {
    // TODO
  })

  it('withdraw tokens from lockup', async () => {
    // TODO
  })

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });
});
