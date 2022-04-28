use crate::*;

#[cfg(feature = "mainnet")]
declare_id!("BRLsMczKuaR5w9vSubF4j8HwEGGprVAyyVgS4EX7DKEg");

#[cfg(not(feature = "mainnet"))]
declare_id!("4UyKKoK5s2cur87ARnu1gZKcWnUoYjAZPv2HAXgzzfuk");
