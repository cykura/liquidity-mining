use anchor_lang::prelude::*;
use anchor_spl::token::*;
use cyclos_core::states::pool::PoolState;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// Constructor constants, read from Etherscan
/// The max duration of an incentive in seconds
const MAX_INCENTIVE_DURATION: u32 = 63072000;
/// The max amount of seconds into the future the incentive start_time can be set
const MAX_INCENTIVE_START_LEAD_TIME: u32 = 2592000;

#[program]
pub mod cykura_staker {
    use super::*;

    /// Creates a new liquidity mining incentive program
    ///
    /// # Arguments
    ///
    /// * `ctx` - The instruction context
    /// * `start_time` - The time when the incentive program begins
    /// * `end_time` - The time when rewards stop accruing
    ///
    pub fn create_incentive(
        ctx: Context<CreateIncentive>,
        start_time: i64,
        end_time: i64,
    ) -> Result<()> {

        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateIncentive<'info> {
    pub pool_state: AccountLoader<'info, PoolState>,
}
