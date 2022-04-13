import * as anchor from '@project-serum/anchor'
import { chaiSolana } from '@saberhq/chai-solana'
import { SolanaProvider } from "@saberhq/solana-contrib"
import chai from "chai"
import { CykuraStakerSDK } from '../../src'

chai.use(chaiSolana)

export function setupWorkspace() {
  const anchorProvider = anchor.Provider.env()
  console.log('anchor owner', anchorProvider.wallet.publicKey.toString())
  anchor.setProvider(anchor.Provider.env())
  const provider = SolanaProvider.init({
    connection: anchorProvider.connection,
    wallet: anchorProvider.wallet,
    opts: anchorProvider.opts,
  })

  return CykuraStakerSDK.load({
    provider,
  });
}