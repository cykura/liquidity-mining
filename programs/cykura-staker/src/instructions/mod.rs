//! Instruction processors.

pub mod add_reward;
pub mod claim_reward;
pub mod create_deposit;
pub mod create_incentive;
pub mod create_reward_account;
pub mod end_incentive;
pub mod stake_token;
pub mod transfer_deposit;
pub mod unstake_token;
pub mod withdraw_token;

pub use add_reward::*;
pub use claim_reward::*;
pub use create_deposit::*;
pub use create_incentive::*;
pub use create_reward_account::*;
pub use end_incentive::*;
pub use stake_token::*;
pub use transfer_deposit::*;
pub use unstake_token::*;
pub use withdraw_token::*;
