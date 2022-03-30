use anchor_lang::prelude::*;
use anchor_spl::token::*;
use cyclos_core::states::pool::PoolState;

mod instructions;
mod state;

pub use instructions::*;
pub use state::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// Constructor constants, read from Etherscan
/// The max duration of an incentive in seconds
const MAX_INCENTIVE_DURATION: i64 = 63072000;
/// The max amount of seconds into the future the incentive start_time can be set
const MAX_INCENTIVE_START_LEAD_TIME: i64 = 2592000;

#[program]
pub mod cykura_staker {
    use super::*;

    /// Creates a new liquidity mining [Incentive]
    pub fn create_incentive(
        ctx: Context<CreateIncentive>,
        start_time: i64,
        end_time: i64,
    ) -> Result<()> {
        let block_timestamp = Clock::get().unwrap().unix_timestamp;
        require!(
            block_timestamp < start_time,
            ErrorCode::StartTimeMustBeNowOrInTheFuture
        );
        require!(
            start_time - block_timestamp <= MAX_INCENTIVE_START_LEAD_TIME,
            ErrorCode::StartTimeTooFarIntoFuture
        );
        require!(
            start_time < end_time,
            ErrorCode::StartTimeMustBeBeforeEndTime
        );
        require!(
            end_time - start_time < MAX_INCENTIVE_DURATION,
            ErrorCode::IncentiveDurationIsTooLong
        );

        ctx.accounts
            .create_incentive(*ctx.bumps.get("incentive").unwrap(), start_time, end_time)
    }

    /// Adds a reward to an [Incentive]
    pub fn add_reward(ctx: Context<AddReward>, reward: u64) -> Result<()> {
        require!(reward > 0, ErrorCode::RewardMustBePositive);

        ctx.accounts.add_reward(reward)
    }

    /// Ends an [Incentive] after the incentive end time has passed and all stakes have been withdrawn
    pub fn end_incentive(ctx: Context<EndIncentive>) -> Result<()> {
        let incentive = &ctx.accounts.incentive;
        require!(
            Clock::get().unwrap().unix_timestamp > incentive.end_time,
            ErrorCode::CannotEndIncentiveBeforeEndTime
        );
        require!(
            incentive.total_reward_unclaimed > 0,
            ErrorCode::NoRefundAvailable
        );
        require!(
            incentive.number_of_stakes == 0,
            ErrorCode::CannotEndIncentiveWhileDepositsAreStaked
        );

        ctx.accounts.end_incentive()
    }

    /// Creates a new [Deposit] by staking a position NFT.
    pub fn create_deposit(ctx: Context<CreateDeposit>) -> Result<()> {
        ctx.accounts
            .create_deposit(*ctx.bumps.get("deposit").unwrap())
    }

    /// Transfers ownership of a deposit to the given recipient.
    pub fn transfer_deposit(ctx: Context<TransferDeposit>) -> Result<()> {
        ctx.accounts.transfer_deposit()
    }
}

/// [cykura_staker] errors.
#[error_code]
pub enum ErrorCode {
    #[msg("Reward must be positive")]
    RewardMustBePositive,
    #[msg("Start time must be now or in the future")]
    StartTimeMustBeNowOrInTheFuture,
    #[msg("Start time too far into future")]
    StartTimeTooFarIntoFuture,
    #[msg("Start time must be before end time")]
    StartTimeMustBeBeforeEndTime,
    #[msg("Incentive duration is too long")]
    IncentiveDurationIsTooLong,
    #[msg("Cannot end incentive before end time")]
    CannotEndIncentiveBeforeEndTime,
    #[msg("No refund available")]
    NoRefundAvailable,
    #[msg("Cannot end incentive while deposits are staked")]
    CannotEndIncentiveWhileDepositsAreStaked,
    #[msg("Not a Cykura NFT")]
    NotACykuraNft,
    #[msg("Incentive not started")]
    IncentiveNotStarted,
    #[msg("Incentive ended")]
    IncentiveEnded,
    #[msg("Cannot stake token with 0 liquidity")]
    CannotStakeTokenWithZeroLiquidity,
    #[msg("Invalid observation")]
    InvalidObservation,
    #[msg("Only owner can unstake before incentive end time")]
    NotStaker,
}
