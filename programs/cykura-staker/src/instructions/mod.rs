//! Instruction processors.

pub mod add_reward;
pub mod create_deposit;
pub mod create_incentive;
pub mod end_incentive;
pub mod transfer_deposit;

pub use add_reward::*;
pub use create_deposit::*;
pub use create_incentive::*;
pub use end_incentive::*;
pub use transfer_deposit::*;
