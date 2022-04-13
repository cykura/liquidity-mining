//! State accounts.

use crate::*;

/// Represents a staking incentive.
#[account]
pub struct Incentive {
    /// The ATA bump.
    pub bump: u8,

    /// The token being distributed as a reward.
    pub reward_token: Pubkey,

    /// The Cykura pool.
    pub pool: Pubkey,

    /// The address which receives any remaining reward tokens when the incentive is ended.
    pub refundee: Pubkey,

    /// The time when the incentive program begins.
    pub start_time: i64,

    /// The time when rewards stop accruing.
    pub end_time: i64,

    /// The amount of reward token not yet claimed by users
    pub total_reward_unclaimed: u64,

    /// Total liquidity-seconds claimed, represented as a UQ32.32
    pub total_seconds_claimed_x32: u64,

    /// The count of deposits that are currently staked for the incentive
    pub number_of_stakes: u32,

    /// The Tribeca locker to calculate reward boost. Boosting is disabled if locker is not provided.
    pub boost_locker: Option<Pubkey>,
}

/// Represents a deposited LP.
#[account]
pub struct Deposit {
    /// The ATA bump.
    pub bump: u8,

    /// The NFT mint.
    pub mint: Pubkey,

    /// The owner of the deposit.
    pub owner: Pubkey,

    /// Counter of how many incentives for which the liquidity is staked.
    pub number_of_stakes: u8,

    /// The lower tick of the range.
    pub tick_lower: i32,

    /// The upper tick of the range.
    pub tick_upper: i32,
}

/// Represents a staked liquidity NFT.
#[account]
pub struct Stake {
    /// The ATA bump.
    pub bump: u8,

    /// The LP NFT mint.
    pub mint: Pubkey,

    /// The incentive of the [Stake].
    pub incentive: Pubkey,

    /// Seconds per liquidity at the time of staking.
    pub seconds_per_liquidity_inside_initial_x32: u64,

    /// Liquidity in the LP NFT.
    pub liquidity: u64,
}

/// The amounts of reward tokens owed to a given address according to the last time all stakes were updated
#[account]
pub struct Reward {
    /// The ATA bump.
    pub bump: u8,

    /// The token being distributed as a reward.
    pub reward_token: Pubkey,

    /// The owner for which the rewards owed are checked.
    pub owner: Pubkey,

    /// The amount of the reward token claimable by the owner
    pub rewards_owed: u64,
}
