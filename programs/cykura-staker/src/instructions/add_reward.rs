use anchor_spl::token;

use crate::*;

/// Accounts for [cykura_staker::add_reward].
#[derive(Accounts)]
pub struct AddReward<'info> {
    /// [Incentive]
    #[account(mut)]
    pub incentive: Account<'info, Incentive>,

    /// The vault to hold reward tokens.
    #[account(
        mut,
        associated_token::mint = incentive.reward_token,
        associated_token::authority = incentive.key(),
    )]
    pub vault: Account<'info, TokenAccount>,

    /// The account paying the incentive reward.
    pub payer: Signer<'info>,

    /// The token account of the payer.
    /// CHECK: mint and signer are validated in the CPI.
    #[account(mut)]
    pub payer_token_account: UncheckedAccount<'info>,

    /// Token program.
    pub token_program: Program<'info, Token>,
}

impl<'info> AddReward<'info> {
    /// Adds a token reward to an [Incentive].
    ///
    /// # Arguments
    ///
    /// * `reward` - The amount of reward tokens to be distributed.
    ///
    pub fn add_reward(&mut self, reward: u64) -> Result<()> {
        let incentive = &mut self.incentive;
        incentive.reward += reward;

        let cpi_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            token::Transfer {
                from: self.payer_token_account.to_account_info(),
                to: self.vault.to_account_info(),
                authority: self.payer.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, reward)?;

        emit!(AddRewardEvent {
            incentive: incentive.key(),
            reward,
        });

        Ok(())
    }
}

#[event]
/// Event emitted when a reward is added to an [Incentive].
pub struct AddRewardEvent {
    /// [Incentive] address.
    pub incentive: Pubkey,

    /// The reward amount added.
    pub reward: u64,
}
