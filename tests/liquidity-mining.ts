import * as anchor from '@project-serum/anchor';
import { Program, web3 } from '@project-serum/anchor';
import { PublicKey, SolanaProvider } from '@saberhq/solana-contrib';
import { GokiSDK, SmartWalletWrapper } from '@gokiprotocol/client';
import { chaiSolana, expectTX } from '@saberhq/chai-solana';
import * as chai from "chai";
import { LiquidityMining } from '../target/types/liquidity_mining';
import { ASSOCIATED_TOKEN_PROGRAM_ID, createMint, TOKEN_PROGRAM_ID } from '@saberhq/token-utils';
import { Token } from '@solana/spl-token';

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

  // goki smart wallet
  let gokiSdk: GokiSDK
  const smartWalletBase = web3.Keypair.generate();
  const numOwners = 10;
  const ownerA = web3.Keypair.generate();
  const owners = [ownerA.publicKey];
  const threshold = new anchor.BN(1);
  let smartWalletWrapper: SmartWalletWrapper;

  // governance token
  let govTokenMint: PublicKey;
  it('setup goki multisig smart wallet', async () => {
    gokiSdk = GokiSDK.load({ provider: solanaProvider });

    const { smartWalletWrapper: wrapperInner, tx } = await gokiSdk.newSmartWallet(
      {
        numOwners,
        owners,
        threshold,
        base: smartWalletBase,
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


  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });
});
