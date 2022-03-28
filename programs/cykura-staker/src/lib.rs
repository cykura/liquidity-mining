use anchor_lang::prelude::*;
use anchor_spl::token::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod cykura_staker {
    use super::*;

    pub fn create_incentive(
        ctx: Context<CreateIncentive>,
    ) -> Result<()> {

        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateIncentive {
}
