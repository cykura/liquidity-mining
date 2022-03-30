use anchor_lang::AccountsClose;
use anchor_spl::token;

use crate::ErrorCode;
use crate::*;

/// Accounts for [cykura_staker::withdraw_token].
#[derive(Accounts)]
pub struct WithdrawToken<'info> {
    /// [Deposit].
    #[account(
        mut,
        has_one = owner @ErrorCode::OnlyOwnerCanWithdrawToken,
        constraint = deposit.number_of_stakes == 0 @ErrorCode::CannotWithdrawTokenWhileStaked,
    )]
    pub deposit: Account<'info, Deposit>,

    /// The vault which holds the deposited token.
    #[account(
        mut,
        associated_token::mint = deposit.mint,
        associated_token::authority = staker.key(),
    )]
    pub deposit_vault: Account<'info, TokenAccount>,

    /// The root program account which acts as the deposit vault authority.
    #[account(seeds = [], bump)]
    pub staker: UncheckedAccount<'info>,

    /// The current owner of the deposit.
    pub owner: Signer<'info>,

    /// The address where the LP token will be sent
    /// CHECK: The LP token can be transferred to any account. The transfer CPI ensures this is an
    /// initialized token account.
    #[account(mut, constraint = to.key() != deposit_vault.key() @ErrorCode::CannotWithdrawToStaker)]
    pub to: UncheckedAccount<'info>,

    /// Token program.
    pub token_program: Program<'info, Token>,
}

impl<'info> WithdrawToken<'info> {
    /// Withdraws a Cykura position token from this program to the recipient `to`
    pub fn withdraw_token(&mut self, bump: u8) -> Result<()> {
        let deposit = &mut self.deposit;

        let seeds: [&[u8]; 1] = [&[bump]];
        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: self.deposit_vault.to_account_info(),
                    to: self.to.to_account_info(),
                    authority: self.staker.to_account_info(),
                },
                &[&seeds[..]],
            ),
            1,
        )?;

        emit!(TransferDepositEvent {
            deposit: deposit.key(),
            mint: deposit.mint,
            old_owner: deposit.owner,
            new_owner: Pubkey::default(),
        });

        deposit.close(self.owner.to_account_info())?;

        Ok(())
    }
}
