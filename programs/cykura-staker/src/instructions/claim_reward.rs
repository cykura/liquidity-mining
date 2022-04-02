use anchor_spl::token;

use crate::*;

/// Accounts for [cykura_staker::claim_reward].
#[derive(Accounts)]
pub struct ClaimReward<'info> {
    /// [Reward].
    #[account(
        mut,
        has_one = owner,
    )]
    pub reward: Account<'info, Reward>,

    /// The reward owner.
    pub owner: Signer<'info>,

    ///  The reward vault.
    #[account(
        mut,
        associated_token::mint = reward.reward_token,
        associated_token::authority = staker.key(),
    )]
    pub vault: Account<'info, TokenAccount>,

    /// The root program account which acts as the vault authority.
    /// CHECK: The address is verified using seeds and bump.
    #[account(seeds = [], bump)]
    pub staker: UncheckedAccount<'info>,

    /// The token account where the reward will be sent
    /// CHECK: The reward can be transferred to any token account set by the reward owner. The token program CPI
    /// ensures this is a valid token account.
    #[account(mut)]
    pub to: UncheckedAccount<'info>,

    /// Token program.
    pub token_program: Program<'info, Token>,
}

impl<'info> ClaimReward<'info> {
    /// Transfers `amount_requested` of accrued `reward_token` rewards from the contract to the recipient `to`
    pub fn claim_reward(&mut self, amount_requested: u64, bump: u8) -> Result<()> {
        let mut reward = self.reward.rewards_owed;
        if amount_requested > 0 && amount_requested < reward {
            reward = amount_requested;
        }

        self.reward.rewards_owed -= reward;

        let seeds: [&[u8]; 1] = [&[bump]];
        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: self.vault.to_account_info(),
                    to: self.to.to_account_info(),
                    authority: self.staker.to_account_info(),
                },
                &[&seeds[..]],
            ),
            reward,
        )?;

        emit!(RewardClaimed {
            to: self.to.key(),
            reward,
        });

        Ok(())
    }
}

#[event]
/// Event emitted when a reward token has been claimed.
pub struct RewardClaimed {
    /// The address where claimed rewards were sent to
    pub to: Pubkey,

    /// The amount of reward tokens claimed
    pub reward: u64,
}
