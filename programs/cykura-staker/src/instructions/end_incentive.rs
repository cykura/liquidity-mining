use crate::*;
use anchor_spl::token;

/// Accounts for [cykura_staker::end_incentive].
#[derive(Accounts)]
pub struct EndIncentive<'info> {
    /// [Incentive] to end.
    #[account(mut)]
    pub incentive: Account<'info, Incentive>,

    /// The incentive token account which will make the refund.
    #[account(
        mut,
        associated_token::mint = incentive.reward_token,
        associated_token::authority = incentive.key(),
    )]
    pub vault: Account<'info, TokenAccount>,

    /// The token account of the refundee.
    #[account(mut, owner = incentive.refundee)]
    pub refundee_token_account: Account<'info, TokenAccount>,

    /// Token program.
    pub token_program: Program<'info, Token>,
}

impl<'info> EndIncentive<'info> {
    /// Ends an [Incentive] after the incentive end time has passed and all stakes have been withdrawn
    pub fn end_incentive(&mut self) -> Result<()> {
        let incentive = &mut self.incentive;

        let refund = incentive.total_reward_unclaimed;

        // issue the refund
        let seeds = [
            b"Incentive".as_ref(),
            &incentive.reward_token.to_bytes() as &[u8],
            &incentive.pool.to_bytes() as &[u8],
            &incentive.refundee.to_bytes() as &[u8],
            &incentive.start_time.to_be_bytes(),
            &incentive.end_time.to_be_bytes(),
            &[incentive.bump],
        ];
        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: self.vault.to_account_info(),
                    to: self.vault.to_account_info(),
                    authority: incentive.to_account_info(),
                },
                &[&seeds[..]],
            ),
            refund,
        )?;

        incentive.total_reward_unclaimed = 0;

        // note we never clear total_seconds_claimed_x32

        emit!(EndIncentiveEvent {
            incentive: incentive.key(),
            refund
        });

        Ok(())
    }
}

#[event]
/// Event that can be emitted when a liquidity mining incentive has ended.
pub struct EndIncentiveEvent {
    /// The incentive which is ending.
    pub incentive: Pubkey,

    /// The amount of reward tokens refunded.
    pub refund: u64,
}
