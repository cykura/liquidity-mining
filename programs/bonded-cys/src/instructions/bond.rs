use crate::*;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::{self, TokenAccount, Token, Mint};
use cys_token;

/// Accounts for [bonded_cys::bond].
#[derive(Accounts)]
pub struct Bond<'info> {
    /// The account to custody CYS and mint bonded CYS.
    /// CHECK: No data stored
    #[account(
        seeds = [],
        bump,
    )]
    pub bond_manager: UncheckedAccount<'info>,

    /// The source token account for tokens to bond.
    #[account(
        mut,
        constraint = from.mint == cys_token::ID,
    )]
    pub from: Account<'info, TokenAccount>,

    /// The escrow to hold bonded tokens.
    #[account(
        mut,
        address = get_associated_token_address(
            &bond_manager.key(),
            &cys_token::ID
        )
    )]
    pub escrow: Account<'info, TokenAccount>,

    /// Bonded CYS mint, having the bond manager as the minting authority
    #[account(
        mut,
        address = bonded_cys_token::ID,
    )]
    pub bonded_cys_mint: Account<'info, Mint>,

    /// The destination account for bonded tokens.
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,

    /// The account paying the incentive reward.
    pub signer: Signer<'info>,

    /// Token program.
    pub token_program: Program<'info, Token>,
}

impl<'info> Bond<'info> {
    /// Bonds a number of CYS tokens.
    ///
    /// # Arguments
    ///
    /// * `amount` - Quantity to bond.
    ///
    pub fn bond(&mut self, amount: u64, bond_manager_bump: u8) -> Result<()> {
        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: self.from.to_account_info(),
                    to: self.escrow.to_account_info(),
                    authority: self.signer.to_account_info(),
                },
            ),
            amount,
        )?;

        let seeds: [&[u8]; 1] = [&[bond_manager_bump]];
        token::mint_to(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token::MintTo {
                    mint: self.bonded_cys_mint.to_account_info(),
                    to: self.to.to_account_info(),
                    authority: self.bond_manager.to_account_info(),
                },
                &[&seeds[..]],
            ),
            amount
        )?;

        emit!(BondEvent {
            amount,
            from: self.from.key(),
            to: self.to.key(),
        });

        Ok(())
    }
}

#[event]
/// Event emitted when CYS is bonded.
pub struct BondEvent {
    /// The amount of tokens bonded
    pub amount: u64,

    /// Token account giving out tokens to bond.
    pub from: Pubkey,

    /// Destination token account receiving bonded tokens.
    pub to: Pubkey,
}
