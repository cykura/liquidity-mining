# Cykura liquidity miner / staker

## Accounts
1. [Incentive](./programs/cykura-staker/src/state.rs#L7): A reward farm. Multiple farms can be permissionlessly created for a liquidity pool. One can optionally create boosted farms, where the staker's voting power in a particular locker can give additional fees. Boosting is based on the [Izumi finance boost formula](https://docs.izumi.finance/tokens/tokenomics#izi-and-ve-izi).

```
min((vliquidity∗40/100)+(Totalvliquidity∗VotingPower/VotingTotal∗(100−40)/100）,vliquidity)
```

2. [Deposit](./programs/cykura-staker/src/state.rs#L42): A Cykura LP NFT deposited into the smart contract. A deposit can be staked into one or more incentive to earn rewards.

3. [Stake](./programs/cykura-staker/src/state.rs#L65): The state of a deposit staked into an incentive.

4. [Reward](./programs/cykura-staker/src/state.rs#L84): Tracks rewards owed per address.

## UI integration guide

### Writes

1. Farm creation:
    - [`createIncentive()`](./src/sdk.ts#L52) or [`createIncentiveBoosted()`](./src/sdk.ts#L98). Any valid Tribeca locker can be used for boosting. In our case, provide the address for Cykura's official locker.

2. Stake token:
    - Deposit the LP NFT using [`createDeposit()`](./src/sdk.ts#L147)
    - Stake the deposit in an incentive by calling [`stakeToken()`](./src/sdk.ts#L209)
    - Note: Dual liquidity mining rewards need two stake instructions.

3. Collecting fees and withdrawing
    - Create a `Reward` account using [`createRewardAccount()`](./src/sdk.ts#L183)
    - [`unstakeToken()`](./src/wrappers/stake.ts#L36) and [`unstakeTokenBoosted()`](./src/wrappers/stake.ts#L94) remove the deposit from a staked incentive. Note that reclaiming the LP NFT or collecting the reward tokens need additional steps.
    - To reclaim the deposited NFT, call [`withdrawToken()`](./src/wrappers/deposit.ts#L35)
    - To collect reward, call [`claimReward()`](./src/wrappers/reward.ts#L38). This can be done independently of `withdrawToken()`.
    - If you only want to harvest fees and keep the token staked, call `stakeToken()` instead of `withdrawToken()`.

### Reads

1. Every wrapper (Incentive, Reward, Stake and Deposit) has a `data()` function to fetch and cache accounts.
2. Unclaimed reward- [stake.getRewardInfo()](./src/wrappers/stake.ts#L176)
3. APR- TODO
4. Boost percentage- TODO
5. Find all deposits of a user- `deposits.fetchAll()`, then filter for the wallet's address
6. If a deposit is staked in an incentive- Generate the stake address using the deposit and incentive addresses.

