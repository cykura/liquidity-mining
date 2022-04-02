use anchor_lang::AccountsClose;
use cyclos_core::states::oracle::ObservationState;
use cyclos_core::states::pool::{SnapshotCumulative, POOL_SEED};
use cyclos_core::states::tick::TickState;
use cyclos_core::states::tick::TICK_SEED;

use crate::reward_math::RewardOwed;
use crate::ErrorCode;
use crate::*;
use std::ops::Deref;

/// Accounts for [cykura_staker::unstake_token].
#[derive(Accounts)]
pub struct UnstakeToken<'info> {
    /// [Stake]
    #[account(mut, has_one = incentive)]
    pub stake: Account<'info, Stake>,

    #[account(mut)]
    pub incentive: Account<'info, Incentive>,

    #[account(mut, constraint = deposit.mint == stake.mint)]
    pub deposit: Account<'info, Deposit>,

    #[account(
        mut,
        constraint = reward.reward_token == incentive.reward_token,
        constraint = reward.owner == deposit.owner
    )]
    pub reward: Account<'info, Reward>,

    /// The liquidity pool to which the LP position belongs.
    #[account(address = incentive.pool)]
    pub pool: AccountLoader<'info, PoolState>,

    /// The lower tick account of the position.
    #[account(
        seeds = [
            TICK_SEED.as_bytes(),
            pool.load()?.token_0.as_ref(),
            pool.load()?.token_1.as_ref(),
            &pool.load()?.fee.to_be_bytes(),
            &deposit.tick_lower.to_be_bytes()
        ],
        bump = tick_lower.load()?.bump,
    )]
    pub tick_lower: AccountLoader<'info, TickState>,

    /// The upper tick account of the position.
    #[account(
        seeds = [
            TICK_SEED.as_bytes(),
            pool.load()?.token_0.as_ref(),
            pool.load()?.token_1.as_ref(),
            &pool.load()?.fee.to_be_bytes(),
            &deposit.tick_upper.to_be_bytes()
        ],
        bump = tick_upper.load()?.bump,
    )]
    pub tick_upper: AccountLoader<'info, TickState>,

    /// The latest oracle observation for the pool.
    #[account(
        seeds = [
            POOL_SEED.as_bytes(),
            pool.load()?.token_0.as_ref(),
            pool.load()?.token_1.as_ref(),
            &pool.load()?.fee.to_be_bytes()
        ],
        bump = latest_observation.load()?.bump,
        constraint = latest_observation.load()?.index == pool.load()?.observation_index @ErrorCode::NotLatestObservation,
    )]
    pub latest_observation: AccountLoader<'info, ObservationState>,

    /// The instruction signer. The must be the owner of the deposit, if end time has not passed.
    pub signer: Signer<'info>,
}

impl<'info> UnstakeToken<'info> {
    /// Unstakes a Cykura LP token
    pub fn unstake_token(&mut self, block_timestamp: i64) -> Result<()> {
        let deposit = &mut self.deposit;
        let incentive = &mut self.incentive;
        let stake = &mut self.stake;

        deposit.number_of_stakes -= 1;
        incentive.number_of_stakes -= 1;

        let SnapshotCumulative {
            seconds_per_liquidity_inside_x32,
            ..
        } = self.pool.load()?.snapshot_cumulatives_inside(
            self.tick_lower.load()?.deref(),
            self.tick_upper.load()?.deref(),
            self.latest_observation.load()?.deref(),
        );

        let RewardOwed {
            reward,
            seconds_inside_x32,
        } = reward_math::compute_reward_amount(
            incentive.total_reward_unclaimed,
            incentive.total_seconds_claimed_x32,
            incentive.start_time,
            incentive.end_time,
            stake.liquidity,
            stake.seconds_per_liquidity_inside_initial_x32,
            seconds_per_liquidity_inside_x32,
            block_timestamp,
        );

        incentive.total_seconds_claimed_x32 += seconds_inside_x32;
        // reward is never greater than total reward unclaimed
        incentive.total_reward_unclaimed -= reward;
        self.reward.rewards_owed += reward;

        stake.close(self.signer.to_account_info())?;

        emit!(UnstakeTokenEvent {
            mint: deposit.mint,
            incentive: incentive.key()
        });

        Ok(())
    }
}

#[event]
/// Event emitted when a Cykura LP token has been unstaked
pub struct UnstakeTokenEvent {
    /// The unique identifier of a Cykura LP token.
    #[index]
    pub mint: Pubkey,

    /// The incentive in which the token is staking.
    #[index]
    pub incentive: Pubkey,
}
