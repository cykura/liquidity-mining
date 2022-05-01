use anchor_lang::prelude::*;

mod instructions;
mod cys_token;
mod bonded_cys_token;

pub use instructions::*;

declare_id!("bondk8vdEkwpERDBARjhVwqzNHrvxX6QPBLc2q13ABH");

#[program]
pub mod bonded_cys {

    use super::*;
    pub fn bond(ctx: Context<Bond>, amount: u64) -> Result<()> {
        ctx.accounts.bond(amount, *ctx.bumps.get("bond_manager").unwrap())
    }
}

