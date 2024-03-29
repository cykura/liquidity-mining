import { TransactionEnvelope } from '@saberhq/solana-contrib';
import { getATAAddressSync, getOrCreateATA } from '@saberhq/token-utils';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type { PublicKey } from '@solana/web3.js';
import { DepositData } from '../programs';
import { CykuraStakerSDK } from '../sdk';
import { findStakeManagerAddress } from './pda';

export class DepositWrapper {
    private _deposit: DepositData | null = null;

    constructor(
        readonly sdk: CykuraStakerSDK,
        readonly depositKey: PublicKey
    ) {}

    get provider() {
        return this.sdk.provider;
    }

    get program() {
        return this.sdk.programs.CykuraStaker;
    }

    async reload(): Promise<DepositData> {
        return this.program.account.deposit.fetch(this.depositKey);
    }

    async data(): Promise<DepositData> {
        if (!this._deposit) {
            this._deposit = await this.reload();
        }
        return this._deposit;
    }

    // Returns a transaction to withdraw a deposited token
    async withdrawToken(): Promise<TransactionEnvelope> {
        const [stakeManager] = await findStakeManagerAddress();
        const { mint } = await this.data();
        const depositVault = await getATAAddressSync({
            mint,
            owner: stakeManager,
        });

        const { address: to, instruction: createToAccountIx } =
            await getOrCreateATA({
                provider: this.provider,
                mint,
            });

        const tx = new TransactionEnvelope(this.provider, []);
        if (createToAccountIx) {
            tx.append(createToAccountIx);
        }

        tx.append(
            await this.program.methods
                .withdrawToken()
                .accounts({
                    deposit: this.depositKey,
                    depositVault,
                    stakeManager,
                    owner: this.provider.wallet.publicKey,
                    to,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .instruction()
        );

        return tx;
    }

    async transferDeposit(to: PublicKey): Promise<TransactionEnvelope> {
        const { owner } = await this.data();

        return new TransactionEnvelope(this.provider, [
            await this.program.methods
                .transferDeposit()
                .accounts({
                    deposit: this.depositKey,
                    owner,
                    to,
                })
                .instruction(),
        ]);
    }
}
