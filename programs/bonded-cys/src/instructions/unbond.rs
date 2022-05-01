use crate::*;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::{self, Mint, Token, TokenAccount};
use cys_token;

#[cfg(not(feature = "mainnet"))]
pub const UNLOCK_TIME: u32 = 0;

#[cfg(feature = "mainnet")]
pub const UNLOCK_TIME: u32 = 1715279400; // Thu May 09 2024 18:30:00 GMT+0000

/// Accounts for [bonded_cys::unbond].
#[derive(Accounts)]
pub struct Unbond<'info> {
    /// The account to custody CYS and mint bonded CYS.
    /// CHECK: No data stored
    #[account(
        seeds = [],
        bump,
    )]
    pub bond_manager: UncheckedAccount<'info>,

    /// The source token account for tokens to unbond.
    #[account(
        mut,
        constraint = from.mint == bonded_cys_token::ID,
    )]
    pub from: Account<'info, TokenAccount>,

    /// The escrow holding bonded tokens.
    #[account(
        mut,
        address = get_associated_token_address(
            &bond_manager.key(),
            &cys_token::ID
        )
    )]
    pub escrow: Account<'info, TokenAccount>,

    /// Bonded CYS mint, having the bond manager as the burn authority
    #[account(
        mut,
        address = bonded_cys_token::ID,
    )]
    pub bonded_cys_mint: Account<'info, Mint>,

    /// The destination account for unbonded tokens.
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,

    /// The signer wallet unbonding the tokens.
    pub signer: Signer<'info>,

    /// Token program.
    pub token_program: Program<'info, Token>,
}

impl<'info> Unbond<'info> {
    /// Unbonds a number of bonded tokens. Tokens cannot be unbonded before unlock date.
    /// The bonded CYS is burnt, and escrowed CYS is released.
    ///
    /// # Arguments
    ///
    /// * `amount` - Quantity to unbond.
    ///
    pub fn unbond(&mut self, amount: u64, bond_manager_bump: u8) -> Result<()> {
        token::burn(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::Burn {
                    mint: self.bonded_cys_mint.to_account_info(),
                    to: self.from.to_account_info(),
                    authority: self.signer.to_account_info(),
                },
            ),
            amount,
        )?;

        let seeds: [&[u8]; 1] = [&[bond_manager_bump]];
        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: self.escrow.to_account_info(),
                    to: self.to.to_account_info(),
                    authority: self.bond_manager.to_account_info(),
                },
                &[&seeds[..]],
            ),
            amount,
        )?;

        emit!(UnbondEvent {
            amount,
            from: self.from.key(),
            to: self.to.key(),
        });

        Ok(())
    }
}

#[event]
/// Event emitted when CYS is unbonded.
pub struct UnbondEvent {
    /// The amount of tokens bonded
    pub amount: u64,

    /// Token account unbonding its balance.
    pub from: Pubkey,

    /// Destination token account receiving unbonded tokens.
    pub to: Pubkey,
}
