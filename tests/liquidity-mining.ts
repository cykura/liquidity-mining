import * as anchor from '@project-serum/anchor';
import { Program, web3 } from '@project-serum/anchor';
import { SolanaProvider } from '@saberhq/solana-contrib';
import { GokiSDK, SmartWalletWrapper } from '@gokiprotocol/client';
import { chaiSolana, expectTX } from '@saberhq/chai-solana';
import * as chai from "chai";
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

  let gokiSdk: GokiSDK
  const smartWalletBase = web3.Keypair.generate();
  const numOwners = 10; // Big enough.

  const ownerA = web3.Keypair.generate();
  const owners = [ownerA.publicKey];

  const threshold = new anchor.BN(1);

  let smartWalletWrapper: SmartWalletWrapper;

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

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });
});
