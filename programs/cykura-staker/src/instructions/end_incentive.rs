use crate::*;
use anchor_spl::associated_token::get_associated_token_address;
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
        address = get_associated_token_address(stake_manager.key, &incentive.reward_token)
    )]
    pub vault: Account<'info, TokenAccount>,

    /// The root program account which acts as the deposit vault authority.
    /// CHECK: The address is verified using seeds and bump.
    #[account(seeds = [], bump)]
    pub stake_manager: UncheckedAccount<'info>,

    /// The token account of the refundee.
    #[account(mut, constraint = refundee_token_account.owner == incentive.refundee)]
    // owner field is bugged in v0.22
    pub refundee_token_account: Account<'info, TokenAccount>,

    /// Token program.
    pub token_program: Program<'info, Token>,
}

impl<'info> EndIncentive<'info> {
    /// Ends an [Incentive] after the incentive end time has passed and all stakes have been withdrawn
    pub fn end_incentive(&mut self, bump: u8) -> Result<()> {
        let incentive = &mut self.incentive;

        let refund = incentive.total_reward_unclaimed;

        // issue the refund
        let seeds: [&[u8]; 1] = [&[bump]];
        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: self.vault.to_account_info(),
                    to: self.vault.to_account_info(),
                    authority: self.stake_manager.to_account_info(),
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
