import { TransactionEnvelope } from "@saberhq/solana-contrib";
import { getATAAddress, getOrCreateATA } from "@saberhq/token-utils";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import { DepositData } from "../programs";
import { CykuraStakerSDK } from "../sdk";
import { findStakerAddress } from "./pda";

export class DepositWrapper {
  private _deposit: DepositData | null = null;

  constructor(
    readonly sdk: CykuraStakerSDK, readonly depositKey: PublicKey) { }

  get provider() {
    return this.sdk.provider;
  }

  get program() {
    return this.sdk.programs.CykuraStaker;
  }

  async reload(): Promise<DepositData> {
    return await this.program.account.deposit.fetch(this.depositKey);
  }

  async data(): Promise<DepositData> {
    if (!this._deposit) {
      this._deposit = await this.reload();
    }
    return this._deposit;
  }

  // Returns a transaction to withdraw a deposited token
  async withdrawToken(): Promise<TransactionEnvelope> {
    const [staker] = await findStakerAddress()
    const { mint } = await this.data()
    const depositVault = await getATAAddress({ mint, owner: staker })

    const { address: to, instruction: createToAccountIx } = await getOrCreateATA({
      provider: this.provider,
      mint
    })

    const tx = new TransactionEnvelope(
      this.provider,
      [],
    )
    if (createToAccountIx) {
      tx.append(createToAccountIx)
    }

    tx.append(
      await this.program.methods.withdrawToken().accounts({
        deposit: this.depositKey,
        depositVault,
        staker,
        owner: this.provider.wallet.publicKey,
        to,
        tokenProgram: TOKEN_PROGRAM_ID,
      }).instruction()
    )

    return tx
  }
}
