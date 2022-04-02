use anchor_lang::prelude::*;
use anchor_spl::token::*;
use cyclos_core::states::pool::PoolState;

mod instructions;
mod reward_math;
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

    /// Withdraws a Cykura position token from this program to the recipient `to`
    pub fn withdraw_token(ctx: Context<WithdrawToken>) -> Result<()> {
        // TODO verify if bumps.get() works for UncheckedAccount.
        // If not, use Pubkey::find_program_address() for bump
        ctx.accounts
            .withdraw_token(*ctx.bumps.get("staker").unwrap())
    }

    /// Stakes a Cykura LP token
    pub fn stake_token(ctx: Context<StakeToken>) -> Result<()> {
        let incentive = &ctx.accounts.incentive;
        let block_timestamp = Clock::get().unwrap().unix_timestamp;
        require!(
            block_timestamp >= incentive.start_time,
            ErrorCode::IncentiveNotStarted
        );
        require!(
            block_timestamp < incentive.end_time,
            ErrorCode::IncentiveEnded
        );
        require!(
            incentive.total_reward_unclaimed > 0,
            ErrorCode::NonExistentIncentive
        );

        ctx.accounts.stake_token(*ctx.bumps.get("stake").unwrap())
    }

    /// Creates an empty [Reward] account for a given token and address.
    pub fn create_reward_account(ctx: Context<CreateRewardAccount>) -> Result<()> {
        ctx.accounts
            .create_reward_account(*ctx.bumps.get("reward").unwrap())
    }

    /// Unstakes a Cykura LP token
    pub fn unstake_token(ctx: Context<UnstakeToken>) -> Result<()> {
        let incentive = &ctx.accounts.incentive;
        let block_timestamp = Clock::get().unwrap().unix_timestamp;

        // anyone can call [cykura_staker::unstake_token] if the block time is after the end time of the incentive
        if block_timestamp < incentive.end_time {
            require!(
                ctx.accounts.deposit.owner == ctx.accounts.signer.key(),
                ErrorCode::OnlyOwnerCanWithdrawTokenBeforeEndTime
            );
        }

        ctx.accounts.unstake_token(block_timestamp)
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
    #[msg("cykura_staker::withdraw_token: cannot withdraw to staker")]
    CannotWithdrawToStaker,
    #[msg("cykura_staker::withdraw_token: cannot withdraw token while staked")]
    CannotWithdrawTokenWhileStaked,
    #[msg("cykura_staker::withdraw_token: only owner can withdraw token")]
    OnlyOwnerCanWithdrawToken,
    #[msg("cykura_staker::stake_token: only owner can stake token")]
    OnlyOwnerCanStakeToken,
    #[msg("cykura_staker::stake_token: incentive not started")]
    IncentiveNotStarted,
    #[msg("cykura_staker::stake_token: incentive ended")]
    IncentiveEnded,
    #[msg("cykura_staker::stake_token: non-existent incentive")]
    NonExistentIncentive,
    #[msg("cykura_staker::stake_token: token pool is not the incentive pool")]
    TokenPoolIsNotTheIncentivePool,
    #[msg("cykura_staker::stake_token: cannot stake token with 0 liquidity")]
    CannotStakeTokenWithZeroLiquidity,
    #[msg("cykura_staker::stake_token: not latest observation")]
    NotLatestObservation,
    #[msg("cykura_staker::unstake_token: only owner can withdraw token before end time")]
    OnlyOwnerCanWithdrawTokenBeforeEndTime,

    #[msg("Only owner can unstake before incentive end time")]
    NotStaker,
}
