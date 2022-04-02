///! Math for computing rewards
///! Allows computing rewards given some parameters of stakes and incentives
use cyclos_core::libraries::full_math::MulDiv;

/// Compute the amount of rewards owed given parameters of the incentive and stake
///
/// # Math
///
/// `reward_per_deposit = total_reward * time_contribution_of_deposit / total_time`
///
/// # Arguments
///
/// * `total_reward_unclaimed` - The total amount of unclaimed rewards left for an incentive
/// * `total_seconds_claimed_x32` - How many full liquidity-seconds have been already claimed for the incentive
/// * `start_time` - When the incentive rewards began in epoch seconds
/// * `end_time` - When rewards are no longer being dripped out in epoch seconds
/// * `liquidity` - The amount of liquidity, assumed to be constant over the period over which the snapshots are measured
/// * `seconds_per_liquidity_inside_initial_x32` - The seconds per liquidity of the liquidity tick range as of the beginning of the period
/// * `seconds_per_liquidity_inside_x32` - The seconds per liquidity of the liquidity tick range as of the current block timestamp
/// * `current_time` - The current block timestamp, which must be greater than or equal to the start time
///
pub fn compute_reward_amount(
    total_reward_unclaimed: u64,
    total_seconds_claimed_x32: u64,
    start_time: i64,
    end_time: i64,
    liquidity: u64,
    seconds_per_liquidity_inside_initial_x32: u64,
    seconds_per_liquidity_inside_x32: u64,
    current_time: i64,
) -> RewardOwed {
    // this should never be called before the start time
    assert!(current_time >= start_time);

    // this operation is safe, as the difference cannot be greater than 1/stake.liquidity
    let seconds_inside_x32 =
        (seconds_per_liquidity_inside_x32 - seconds_per_liquidity_inside_initial_x32) * liquidity;

    let total_seconds_unclaimed_x32 =
        ((end_time.max(current_time) - start_time) << 32) as u64 - total_seconds_claimed_x32;

    let reward = total_reward_unclaimed
        .mul_div_floor(seconds_inside_x32, total_seconds_unclaimed_x32)
        .unwrap();

    RewardOwed {
        reward,
        seconds_inside_x32,
    }
}

/// Reward owed to a staked LP token.
pub struct RewardOwed {
    /// The amount of rewards owed.
    pub reward: u64,

    /// The total liquidity seconds inside the position's range for the duration of the stake.
    pub seconds_inside_x32: u64,
}
