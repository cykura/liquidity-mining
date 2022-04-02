use crate::*;
use std::mem::size_of;

/// Accounts for [cykura_staker::create_reward_account].
#[derive(Accounts)]
pub struct CreateRewardAccount<'info> {
    /// [Reward]
    #[account(
        init,
        seeds = [
            b"Reward".as_ref(),
            reward_token.key().as_ref(),
            reward_owner.key().as_ref()
        ],
        bump,
        payer = payer,
        space = size_of::<Reward>()
    )]
    pub reward: Account<'info, Reward>,

    /// The mint address of token being distributed as a reward.
    /// CHECK: Allow lazy initialization of token mints.
    pub reward_token: UncheckedAccount<'info>,

    /// The address whose reward is tracked.
    /// CHECK: Allow arbitrary addresses.
    pub reward_owner: UncheckedAccount<'info>,

    /// The account paying to initialize [Reward].
    #[account(mut)]
    pub payer: Signer<'info>,

    /// System program.
    pub system_program: Program<'info, System>,
}

impl<'info> CreateRewardAccount<'info> {
    /// Creates an empty [Reward] account for a given token and address.
    pub fn create_reward_account(&mut self, bump: u8) -> Result<()> {
        let reward = &mut self.reward;

        reward.bump = bump;
        reward.reward_token = self.reward_token.key();
        reward.owner = self.reward_owner.key();
        reward.rewards_owed = 0;

        Ok(())
    }
}
