import { buildCoderMap } from '@saberhq/anchor-contrib';
import { web3 } from '@project-serum/anchor';
import { CykuraStakerJSON } from './idls/cykura_staker';
import { CykuraStakerProgram, CykuraStakerTypes } from './programs';

/**
 * Cykura staker program types.
 */
export interface CykuraStakerPrograms {
    CykuraStaker: CykuraStakerProgram;
}

// See `Anchor.toml` for all addresses.
export const CYKURA_STAKER_ADDRESSES = {
    CykuraStaker: new web3.PublicKey(
        'LiquB13Cv6ZJsCYaPHY9Gxt1YN46gZx9nLAscgM7YR1'
    ),
};

/**
 * Program IDLs.
 */
export const CYKURA_STAKER_IDLS = {
    CykuraStaker: CykuraStakerJSON,
};

/**
 * Coders.
 */
export const CYKURA_CODERS = buildCoderMap<{
    CykuraStaker: CykuraStakerTypes;
}>(CYKURA_STAKER_IDLS, CYKURA_STAKER_ADDRESSES);

/// The max duration of an incentive in seconds
const MAX_INCENTIVE_DURATION = 63072000;
/// The max amount of seconds into the future the incentive start_time can be set
const MAX_INCENTIVE_START_LEAD_TIME = 2592000;

// DAO parameters for Cykura
// https://tribeca.so/gov/HnV7iBwe3pfeUdmBwmNir8jDWUunsb7CuGSHnnBdMJBC
export const TRIBECA_PARAMS = {
    governor: new web3.PublicKey("HnV7iBwe3pfeUdmBwmNir8jDWUunsb7CuGSHnnBdMJBC"),
    locker: new web3.PublicKey("6vGZ4L4QpDDEU8uet6TGJCJZSLcWg2yjRKFkNFumdZUn"),
    token: new web3.PublicKey("BRLsMczKuaR5w9vSubF4j8HwEGGprVAyyVgS4EX7DKEg"),
    quorum: 2000000000000,
    minVotes: 100000000000,
    timelockDelay: 1,
    votingDelay: 1,
    minStakeDuration: 86400, // 1 day
    maxStakeDuration: 157680000, // 5 years
    maxStakeVoteMultiplier: 10,
}