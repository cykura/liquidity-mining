import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { SolanaProvider } from '@saberhq/solana-contrib';
import { GokiSDK } from '@gokiprotocol/client';
import { LiquidityMining } from '../target/types/liquidity_mining';

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
  it('setup goki multisig smart wallet', async () => {
    gokiSdk = GokiSDK.load({ provider: solanaProvider })
  })

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });
});
