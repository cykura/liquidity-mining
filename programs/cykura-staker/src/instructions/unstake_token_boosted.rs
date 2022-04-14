use crate::reward_math::RewardOwed;
use crate::ErrorCode;
use crate::*;
use anchor_lang::AccountsClose;
use cyclos_core::states::oracle::{ObservationState, OBSERVATION_SEED};
use cyclos_core::states::pool::SnapshotCumulative;
use cyclos_core::states::tick::TickState;
use cyclos_core::states::tick::TICK_SEED;
use locked_voter::{Escrow, Locker};
use std::ops::Deref;

/// Accounts for [cykura_staker::unstake_token_boosted].
#[derive(Accounts)]
pub struct UnstakeTokenBoosted<'info> {
    /// [Stake]
    #[account(mut, has_one = incentive)]
    pub stake: Account<'info, Stake>,

    /// The incentive for which to unstake the position NFT.
    #[account(mut)]
    pub incentive: Account<'info, Incentive>,

    /// The boost locker.
    #[account(address = incentive.boost_locker.unwrap())]
    pub locker: Account<'info, Locker>,

    /// The staker's vote locker escrow.
    #[account(
        constraint = escrow.locker == locker.key(),
        constraint = escrow.owner == signer.key(),
    )]
    pub escrow: Account<'info, Escrow>,

    /// The deposit account of the position NFT.
    #[account(mut, constraint = deposit.mint == stake.mint)]
    pub deposit: Account<'info, Deposit>,

    ///  The account to track unclaimed rewards for the deposit owner.
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
        address = Pubkey::create_program_address(&[
            TICK_SEED.as_bytes(),
            pool.load()?.token_0.as_ref(),
            pool.load()?.token_1.as_ref(),
            &pool.load()?.fee.to_be_bytes(),
            &deposit.tick_lower.to_be_bytes(),
            &[tick_lower.load()?.bump]
        ], &cyclos_core::ID).unwrap()
    )]
    pub tick_lower: AccountLoader<'info, TickState>,

    /// The upper tick account of the position.
    #[account(
        address = Pubkey::create_program_address(&[
            TICK_SEED.as_bytes(),
            pool.load()?.token_0.as_ref(),
            pool.load()?.token_1.as_ref(),
            &pool.load()?.fee.to_be_bytes(),
            &deposit.tick_upper.to_be_bytes(),
            &[tick_upper.load()?.bump]
        ], &cyclos_core::ID).unwrap()
    )]
    pub tick_upper: AccountLoader<'info, TickState>,

    /// The latest oracle observation for the pool.
    #[account(
        address = Pubkey::create_program_address(&[
            &OBSERVATION_SEED.as_bytes(),
            pool.load()?.token_0.as_ref(),
            pool.load()?.token_1.as_ref(),
            &pool.load()?.fee.to_be_bytes(),
            &pool.load()?.observation_index.to_be_bytes(),
            &[latest_observation.load()?.bump]
        ], &cyclos_core::ID).unwrap() @ErrorCode::NotLatestObservation,
    )]
    pub latest_observation: AccountLoader<'info, ObservationState>,

    /// The deposit owner.
    #[account(address = deposit.owner @ErrorCode::OnlyOwnerCanUnstakeFromBoostedIncentive)]
    pub signer: Signer<'info>,
}

impl<'info> UnstakeTokenBoosted<'info> {
    /// Unstakes a Cykura LP token, with rewards boosted by voting power
    pub fn unstake_token_boosted(&mut self) -> Result<()> {
        let block_timestamp = Clock::get().unwrap().unix_timestamp;
        let deposit = &mut self.deposit;
        let incentive = &mut self.incentive;
        let stake = &mut self.stake;
        let locker = &self.locker;

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

        let voting_power = locker
            .params
            .calculate_voter_power(&self.escrow, block_timestamp)
            .unwrap();

        // The voting power when entire supply is locked for the max period.
        // This is a hypothetical ceiling, not the total locked power at a point of time.
        let max_voting_power = locker
            .locked_supply
            .checked_mul(locker.params.max_stake_vote_multiplier.into())
            .unwrap();

        let RewardOwed {
            reward,
            seconds_inside_x32,
        } = reward_math::compute_reward_amount_boosted(
            incentive.total_reward_unclaimed,
            incentive.total_seconds_claimed_x32,
            incentive.start_time,
            incentive.end_time,
            stake.liquidity,
            stake.seconds_per_liquidity_inside_initial_x32,
            seconds_per_liquidity_inside_x32,
            block_timestamp,
            self.pool.load()?.liquidity,
            voting_power,
            max_voting_power,
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
