import { buildCoderMap } from "@saberhq/anchor-contrib";
import { web3 } from "@project-serum/anchor";
import { CykuraStakerJSON } from "./idls/cykura_staker";
import { CykuraStakerProgram, CykuraStakerTypes } from "./programs";

/**
 * Cykura staker program types.
 */
export interface CykuraStakerPrograms {
  CykuraStaker: CykuraStakerProgram;
}

// See `Anchor.toml` for all addresses.
export const CYKURA_STAKER_ADDRESSES = {
  CykuraStaker: new web3.PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS')
}

/**
 * Program IDLs.
 */
export const CYKURA_STAKER_IDLS = {
  CykuraStaker: CykuraStakerJSON
}

/**
 * Coders.
 */
export const CYKURA_CODERS = buildCoderMap<{
  CykuraStaker: CykuraStakerTypes;
}>(CYKURA_STAKER_IDLS, CYKURA_STAKER_ADDRESSES);

/// The max duration of an incentive in seconds
const MAX_INCENTIVE_DURATION = 63072000
/// The max amount of seconds into the future the incentive start_time can be set
const MAX_INCENTIVE_START_LEAD_TIME = 2592000