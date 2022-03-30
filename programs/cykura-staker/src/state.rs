//! State accounts.

use crate::*;

#[account]
#[derive(Default)]
/// Represents a staking incentive.
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
