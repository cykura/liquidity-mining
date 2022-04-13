import { BN, utils } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

import { CYKURA_STAKER_ADDRESSES } from "../constants";

export const findStakerAddress = async (): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [],
    CYKURA_STAKER_ADDRESSES.CykuraStaker
  );
};

export const findIncentiveAddress = async (
  rewardToken: PublicKey,
  pool: PublicKey,
  refundee: PublicKey,
  startTime: BN,
  endTime: BN
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [
      utils.bytes.utf8.encode("Incentive"),
      rewardToken.toBuffer(),
      pool.toBuffer(),
      refundee.toBuffer(),
      startTime.toTwos(64).toArrayLike(Buffer, 'be', 8),
      endTime.toTwos(64).toArrayLike(Buffer, 'be', 8),
    ],
    CYKURA_STAKER_ADDRESSES.CykuraStaker
  );
};

export const findDepositAddress = async (
  mint: PublicKey,
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [
      utils.bytes.utf8.encode("Deposit"),
      mint.toBuffer(),
    ],
    CYKURA_STAKER_ADDRESSES.CykuraStaker
  );
};

export const findStakeAddress = async (
  mint: PublicKey,
  incentive: PublicKey,
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [
      utils.bytes.utf8.encode("Stake"),
      mint.toBuffer(),
      incentive.toBuffer()
    ],
    CYKURA_STAKER_ADDRESSES.CykuraStaker
  );
};

export const findRewardAddress = async (
  rewardToken: PublicKey,
  owner: PublicKey,
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [
      utils.bytes.utf8.encode("Deposit"),
      rewardToken.toBuffer(),
      owner.toBuffer(),
    ],
    CYKURA_STAKER_ADDRESSES.CykuraStaker
  );
};
