import * as anchor from '@project-serum/anchor'
import { Program } from "@project-serum/anchor"
import { SolanaProvider } from "@saberhq/solana-contrib"
import { CykuraStaker } from "../../target/types/cykura_staker"

export function setupWorkspace() {
  const anchorProvider = anchor.Provider.env()
  console.log('anchor owner', anchorProvider.wallet.publicKey.toString())
  anchor.setProvider(anchor.Provider.env())
  const provider = SolanaProvider.init({
    connection: anchorProvider.connection,
    wallet: anchorProvider.wallet,
    opts: anchorProvider.opts,
  })

  const program = anchor.workspace.CykuraStaker as Program<CykuraStaker>

  return { program, provider }
}