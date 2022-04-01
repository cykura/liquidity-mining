//! State accounts.

use crate::*;

/// Represents a staking incentive.
#[account]
#[derive(Default)]
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
}

/// Represents a deposited LP.
#[account]
#[derive(Default)]
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
#[derive(Default)]
pub struct Stake {
    pub seconds_per_liquidity_initial_x32: u64,
    pub liquidity: u64,
}
