import * as chai from "chai"
import * as anchor from "@project-serum/anchor"
import { web3, BN } from '@project-serum/anchor'
import { chaiSolana, expectTX } from '@saberhq/chai-solana'
import { createMintAndVault, Token } from "@saberhq/token-utils"
import { setupWorkspace } from "./bonded-cys-utils/setupWorkspace"
import { PublicKey } from "@saberhq/solana-contrib"
import { createTestCys } from "./bonded-cys-utils/testToken"

chai.use(chaiSolana)

describe('bonded cys', () => {
  const provider = setupWorkspace()

  let cys: PublicKey
  let vault: PublicKey

  it('mint test cys', async () => {
    console.log('minting test cys')

    const testCys = await createTestCys(provider)
    cys = testCys.cys
    vault = testCys.ata

    console.log('test CYS', cys.toString())

  })


})