use anchor_lang::prelude::*;
use anchor_spl::token::*;
pub use locked_voter::locked_voter::*;
use locked_voter::program::LockedVoter;
use locked_voter::{Escrow, Locker};
use govern::Governor;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod liquidity_mining {
    use super::*;
    pub fn initialize<'info>(ctx: Context<Initialize>) -> ProgramResult {
        let voting_power = ctx.accounts.escrow.voting_power(&ctx.accounts.locker.params).unwrap();
        msg!("Voting power: {:?}", voting_power);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    pub locker: Account<'info, Locker>,
    pub escrow: Account<'info, Escrow>,
}
