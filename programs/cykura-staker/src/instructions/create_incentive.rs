use crate::*;
use std::mem::size_of;

/// Accounts for [cykura_staker::create_incentive].
#[derive(Accounts)]
#[instruction(start_time: i64, end_time: i64)]
pub struct CreateIncentive<'info> {
    /// [Incentive]
    #[account(
        init,
        seeds = [
            b"Incentive".as_ref(),
            reward_token.key().to_bytes().as_ref(),
            pool.key().to_bytes().as_ref(),
            refundee.key().to_bytes().as_ref(),
            &start_time.to_be_bytes(),
            &end_time.to_be_bytes()
        ],
        bump,
        payer = payer,
        space = 8 + size_of::<Incentive>()
    )]
    pub incentive: Account<'info, Incentive>,

    /// The token being distributed as a reward.
    pub reward_token: Account<'info, Mint>,

    /// The Cyclos pool to incentivize.
    pub pool: AccountLoader<'info, PoolState>,

    /// The address which receives any remaining reward tokens when the incentive is ended.
    /// CHECK: Refundee can be an arbitrary address
    pub refundee: UncheckedAccount<'info>,

    /// Payer of the initialization.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// System program.
    pub system_program: Program<'info, System>,
}

impl<'info> CreateIncentive<'info> {
    /// Creates a new [Incentive].
    ///
    /// # Arguments
    ///
    /// * `start_time`- The time when the incentive program begins.
    /// * `end_time` - The time when rewards stop accruing.
    /// * `reward` - The amount of reward tokens to be distributed.
    ///
    pub fn create_incentive(&mut self, bump: u8, start_time: i64, end_time: i64) -> Result<()> {
        let incentive = &mut self.incentive;

        incentive.bump = bump;
        incentive.reward_token = self.reward_token.key();
        incentive.pool = self.pool.key();
        incentive.refundee = self.refundee.key();
        incentive.start_time = start_time;
        incentive.end_time = end_time;

        emit!(IncentiveCreatedEvent {
            reward_token: incentive.reward_token,
            pool: incentive.pool,
            refundee: incentive.refundee,
            start_time: incentive.start_time,
            end_time: incentive.end_time,
        });

        Ok(())
    }
}

#[event]
/// Event emitted when a liquidity mining [Incentive] has been created.
pub struct IncentiveCreatedEvent {
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
}
