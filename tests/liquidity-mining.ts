import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { LiquidityMining } from '../target/types/liquidity_mining';

describe('liquidity-mining', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.LiquidityMining as Program<LiquidityMining>;

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });
});
