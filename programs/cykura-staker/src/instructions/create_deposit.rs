use crate::ErrorCode;
use crate::*;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token;
use cyclos_core::states::tokenized_position::TokenizedPositionState;
use std::mem::size_of;

/// Accounts for [cykura_staker::create_deposit].
#[derive(Accounts)]
pub struct CreateDeposit<'info> {
    /// [Deposit].
    #[account(
        init,
        seeds = [
            b"Deposit".as_ref(),
            deposit_vault.mint.as_ref()
        ],
        bump,
        payer = depositor,
        space = 8 + size_of::<Deposit>()
    )]
    pub deposit: Account<'info, Deposit>,

    /// The token account holding the NFT.
    #[account(mut)]
    pub depositor_token_account: Account<'info, TokenAccount>,

    /// The token vault receiving the NFT.
    #[account(
        mut,
        address = get_associated_token_address(
            &Pubkey::find_program_address(&[], &cyclos_core::ID).0,
            &depositor_token_account.mint
        )
    )]
    pub deposit_vault: Account<'info, TokenAccount>,

    /// The account having metadata of the Cykura Position NFT.
    #[account(
        constraint = tokenized_position.load()?.mint == depositor_token_account.mint @ErrorCode::NotACykuraNft,
    )]
    pub tokenized_position: AccountLoader<'info, TokenizedPositionState>,

    /// The account depositing the position.
    #[account(mut)]
    pub depositor: Signer<'info>,

    /// System program.
    pub system_program: Program<'info, System>,

    /// Token program.
    pub token_program: Program<'info, Token>,
}

impl<'info> CreateDeposit<'info> {
    /// Creates a new [Deposit] by staking a position NFT.
    pub fn create_deposit(&mut self, bump: u8) -> Result<()> {
        let deposit = &mut self.deposit;
        let tokenized_position = &self.tokenized_position.load()?;

        deposit.bump = bump;
        deposit.mint = tokenized_position.mint;
        deposit.owner = self.depositor.key();
        deposit.tick_lower = tokenized_position.tick_lower;
        deposit.tick_upper = tokenized_position.tick_upper;

        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: self.depositor_token_account.to_account_info(),
                    to: self.deposit_vault.to_account_info(),
                    authority: self.depositor.to_account_info(),
                },
            ),
            1,
        )?;

        emit!(TransferDepositEvent {
            deposit: deposit.key(),
            mint: deposit.mint,
            old_owner: Pubkey::default(),
            new_owner: deposit.owner,
        });

        Ok(())
    }
}
