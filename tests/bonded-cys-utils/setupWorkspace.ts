import * as anchor from "@project-serum/anchor";
import { chaiSolana } from "@saberhq/chai-solana";
import {
  SolanaProvider,
} from "@saberhq/solana-contrib";
import chai from "chai";

chai.use(chaiSolana);

export function setupWorkspace() {
  const anchorProvider = anchor.Provider.env()
  anchor.setProvider(anchorProvider)

  const provider = SolanaProvider.init({
    connection: anchorProvider.connection,
    wallet: anchorProvider.wallet,
    opts: anchorProvider.opts,
  })

  return provider
}
