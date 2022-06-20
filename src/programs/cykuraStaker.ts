import type { AnchorTypes } from '@saberhq/anchor-contrib';
import type { CykuraStaker } from '../idls/cykura_staker';

export * from '../idls/cykura_staker';

export type IncentiveData = Accounts['incentive'];
export type DepositData = Accounts['deposit'];
export type StakeData = Accounts['stake'];
export type RewardData = Accounts['reward'];

export type CykuraStakerTypes = AnchorTypes<
    CykuraStaker,
    {
        incentive: IncentiveData;
        deposit: DepositData;
        stake: StakeData;
        reward: RewardData;
    }
>;

type Accounts = CykuraStakerTypes['Accounts'];

export type CykuraStakerProgram = CykuraStakerTypes['Program'];
