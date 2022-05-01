use anchor_lang::prelude::*;

mod bonded_cys_token;
mod cys_token;
mod instructions;

pub use instructions::*;

declare_id!("bondk8vdEkwpERDBARjhVwqzNHrvxX6QPBLc2q13ABH");

#[program]
pub mod bonded_cys {

    use super::*;

    /// Bonds a number of CYS tokens.
    pub fn bond(ctx: Context<Bond>, amount: u64) -> Result<()> {
        ctx.accounts
            .bond(amount, *ctx.bumps.get("bond_manager").unwrap())
    }

    /// Unbonds a number of bonded tokens. Tokens cannot be unbonded before unlock date.
    pub fn unbond(ctx: Context<Unbond>, amount: u64) -> Result<()> {
        let block_timestamp = Clock::get().unwrap().unix_timestamp as u32;
        require!(
            block_timestamp >= UNLOCK_TIME,
            ErrorCode::CannotUnbondBeforeUnlockDate
        );

        ctx.accounts
            .unbond(amount, *ctx.bumps.get("bond_manager").unwrap())
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("cannot unbond before unlock date")]
    CannotUnbondBeforeUnlockDate,
}
