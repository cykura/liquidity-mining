import * as anchor from '@project-serum/anchor'
import { Program } from "@project-serum/anchor"
import { SolanaProvider } from "@saberhq/solana-contrib"
import { LiquidityMining } from "../../target/types/liquidity_mining"

export function setupWorkspace() {
  const anchorProvider = anchor.Provider.env()
  console.log('anchor owner', anchorProvider.wallet.publicKey.toString())
  anchor.setProvider(anchor.Provider.env())
  const provider = SolanaProvider.init({
    connection: anchorProvider.connection,
    wallet: anchorProvider.wallet,
    opts: anchorProvider.opts,
  })

  const program = anchor.workspace.LiquidityMining as Program<LiquidityMining>

  return { program, provider }
}