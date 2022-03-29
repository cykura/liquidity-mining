//! State accounts.

use crate::*;

#[account]
#[derive(Default)]
/// Represents a staking incentive.
pub struct Incentive {
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

    /// The amount of reward tokens to be distributed.
    pub reward: u64,
}
