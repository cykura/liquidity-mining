import { BN } from '@project-serum/anchor';
import { TransactionEnvelope } from '@saberhq/solana-contrib';
import {
    getATAAddressSync,
    getOrCreateATA,
    MAX_U64,
    TOKEN_PROGRAM_ID,
    u64,
} from '@saberhq/token-utils';
import type { PublicKey } from '@solana/web3.js';
import { RewardData } from '../programs';
import { CykuraStakerSDK } from '../sdk';
import { findStakeManagerAddress } from './pda';

export class RewardWrapper {
    private _reward: RewardData | null = null;

    constructor(readonly sdk: CykuraStakerSDK, readonly rewardKey: PublicKey) {}

    get provider() {
        return this.sdk.provider;
    }

    get program() {
        return this.sdk.programs.CykuraStaker;
    }

    async reload(): Promise<RewardData> {
        return this.program.account.reward.fetch(this.rewardKey);
    }

    async data(): Promise<RewardData> {
        if (!this._reward) {
            this._reward = await this.reload();
        }
        return this._reward;
    }

    /**
     * Returns a TX to claim accrued reward
     * @param rewardRequested The amount of reward to transfer out. Pass u64::MAX to transfer entire pending amount.
     * @param rewardToken The reward token. This field is optional if the reward account is created
     * @param to The token account to receive reward. If the field is not provided, the provider wallet's
     * ATA is used and a create ATA instruction appended.
     */
    async claimReward(
        rewardRequested: BN,
        rewardToken?: PublicKey,
        to?: PublicKey
    ) {
        if (!rewardToken) {
            ({ rewardToken } = await this.data());
        }
        const [stakeManager] = await findStakeManagerAddress();
        const vault = await getATAAddressSync({
            mint: rewardToken,
            owner: stakeManager,
        });

        const tx = new TransactionEnvelope(this.provider, []);

        if (!to) {
            const { address: _to, instruction: createToAccountIx } =
                await getOrCreateATA({
                    provider: this.provider,
                    mint: rewardToken,
                });
            to = _to;
            if (createToAccountIx) {
                tx.append(createToAccountIx);
            }
        }

        console.log('stake manager', stakeManager);
        tx.append(
            await this.program.methods
                .claimReward(rewardRequested)
                .accounts({
                    reward: this.rewardKey,
                    owner: this.provider.walletKey,
                    vault,
                    stakeManager,
                    to,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .instruction()
        );

        return tx;
    }
}
