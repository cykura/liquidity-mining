use cyclos_core::states::oracle::ObservationState;
use cyclos_core::states::oracle::OBSERVATION_SEED;
use cyclos_core::states::pool::SnapshotCumulative;
use cyclos_core::states::tick::TickState;
use cyclos_core::states::tick::TICK_SEED;
use cyclos_core::states::tokenized_position::TokenizedPositionState;

use crate::ErrorCode;
use crate::*;
use std::mem::size_of;
use std::ops::Deref;

/// Accounts for [cykura_staker::stake_token].
#[derive(Accounts)]
pub struct StakeToken<'info> {
    /// [Stake]
    #[account(
        init,
        seeds = [
            b"Stake".as_ref(),
            deposit.mint.as_ref(),
            incentive.key().as_ref(),
        ],
        bump,
        payer = owner,
        space = 8 + size_of::<Stake>()
    )]
    pub stake: Account<'info, Stake>,

    /// The [Incentive] for which to stake the NFT.
    pub incentive: Account<'info, Incentive>,

    /// [Deposit] to be staked.
    #[account(
        mut,
        has_one = owner @ErrorCode::OnlyOwnerCanStakeToken
    )]
    pub deposit: Account<'info, Deposit>,

    /// The account having metadata of the Cykura Position NFT.
    #[account(
        constraint = tokenized_position.load()?.mint == deposit.mint,
        constraint = tokenized_position.load()?.pool_id == incentive.pool @ErrorCode::TokenPoolIsNotTheIncentivePool,
        constraint = tokenized_position.load()?.liquidity > 0 @ErrorCode::CannotStakeTokenWithZeroLiquidity,
    )]
    pub tokenized_position: AccountLoader<'info, TokenizedPositionState>,

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
            &tick_lower.load()?.tick.to_be_bytes(),
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
            &tick_upper.load()?.tick.to_be_bytes(),
            &[tick_upper.load()?.bump]
        ], &cyclos_core::ID).unwrap(),
        constraint = tick_upper.load()?.tick > tick_lower.load()?.tick
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

    /// The owner of the deposit.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// System program.
    pub system_program: Program<'info, System>,
}

impl<'info> StakeToken<'info> {
    /// Stakes a Cykura LP token
    pub fn stake_token(&mut self, bump: u8) -> Result<()> {
        self.deposit.number_of_stakes = self.deposit.number_of_stakes.checked_add(1).unwrap();
        self.incentive.number_of_stakes = self.incentive.number_of_stakes.checked_add(1).unwrap();

        // Pubkey::create_program_address(seeds, program_id);
        let SnapshotCumulative {
            seconds_per_liquidity_inside_x32,
            ..
        } = self.pool.load()?.snapshot_cumulatives_inside(
            self.tick_lower.load()?.deref(),
            self.tick_upper.load()?.deref(),
            self.latest_observation.load()?.deref(),
        );

        let stake = &mut self.stake;
        stake.bump = bump;
        stake.seconds_per_liquidity_inside_initial_x32 = seconds_per_liquidity_inside_x32;
        stake.liquidity = self.pool.load()?.liquidity;

        emit!(StakeTokenEvent {
            mint: self.deposit.mint,
            incentive: self.incentive.key(),
            liquidity: stake.liquidity,
        });

        Ok(())
    }
}

#[event]
/// Event emitted when a Cykura LP token has been staked
pub struct StakeTokenEvent {
    /// The unique identifier of a Cykura LP token.
    #[index]
    pub mint: Pubkey,

    /// The incentive in which the token is staking.
    #[index]
    pub incentive: Pubkey,

    /// The amount of liquidity staked.
    pub liquidity: u64,
}
