/**
 * Run this after creating a local USDC USDT 0.002% pool on the localnet
 */
import { web3, BN, Provider, Wallet } from '@project-serum/anchor';
import { PublicKey, SolanaAugmentedProvider } from '@saberhq/solana-contrib';
import { CykuraStakerSDK } from '../../src';
import keypairFile from './keypair.json';
import { GokiSDK } from '@gokiprotocol/client';
import {
    findGovernorAddress,
    findLockerAddress,
    findEscrowAddress,
    DEFAULT_LOCKER_PARAMS,
    LockerWrapper,
    TribecaSDK,
} from '@tribecahq/tribeca-sdk';
import { makeSaberProvider } from '@saberhq/anchor-contrib';
import { POOL_SEED, u32ToSeed, IDL, FeeAmount } from '@cykura/sdk';

const keypair = web3.Keypair.fromSeed(
    Uint8Array.from(keypairFile.slice(0, 32))
);
const wallet = new Wallet(keypair);

const connection = new web3.Connection('http://127.0.0.1:8899');

const pro = new Provider(connection, wallet, { skipPreflight: true });

const p = new SolanaAugmentedProvider(makeSaberProvider(pro));

const cykuraStakerSdk = CykuraStakerSDK.load({
    provider: p,
});
const provider = cykuraStakerSdk.provider;
const owner = provider.wallet.publicKey;

const token0 = new PublicKey('7HvgZSj1VqsGADkpb8jLXCVqyzniDHP5HzQCymHnrn1t'); // USDT local mint
const token1 = new PublicKey('GyH7fsFCvD1Wt8DbUGEk6Hzt68SVqwRKDHSvyBS16ZHm'); // USDC local mint

(async function () {
    // Setup and create Escrow and locker

    // Do I need a new account here? Or can I just be the signer wallet itself?
    const base = keypair;
    console.log('base key', base.publicKey.toString());

    // derive addresses
    const [governor] = await findGovernorAddress(base.publicKey);
    const [locker] = await findLockerAddress(base.publicKey);
    const [escrow] = await findEscrowAddress(locker, provider.wallet.publicKey);

    // goki setup
    const gokiSdk = GokiSDK.load({ provider });
    const { smartWalletWrapper, tx: smartWalletTx } =
        await gokiSdk.newSmartWallet({
            numOwners: 1,
            owners: [governor],
            threshold: new BN(1),
            base: base,
        });

    let t = new web3.Transaction();
    await pro.send(t.add(...smartWalletTx.instructions), smartWalletTx.signers);
    console.log('FIRST WORKS', smartWalletWrapper.key.toString());

    // tribeca governor setup
    const tribecaSdk = TribecaSDK.load({ provider });

    // create governor
    const { wrapper: governorWrapper, tx: createGovernorTx } =
        await tribecaSdk.govern.createGovernor({
            electorate: locker,
            smartWallet: smartWalletWrapper.key,
            baseKP: base,
        });

    t = new web3.Transaction();
    await pro.send(
        t.add(...createGovernorTx.instructions),
        createGovernorTx.signers
    );
    console.log('SECOND WORKS', governor.toString());

    // create locker
    const { tx: createLockerTx } = await tribecaSdk.createLocker({
        baseKP: base,
        governor: governor,
        govTokenMint: token0,
    });

    t = new web3.Transaction();
    await pro.send(
        t.add(...createLockerTx.instructions),
        createLockerTx.signers
    );
    console.log('THIRD WORKS', locker.toString());

    const lockerWrapper = await LockerWrapper.load(
        tribecaSdk,
        locker,
        governor
    );

    // create escrow and lock tokens
    const lockTokensTx = await lockerWrapper.lockTokensV1({
        amount: new BN(10_000),
        duration: new BN(DEFAULT_LOCKER_PARAMS.maxStakeDuration),
    });

    t = new web3.Transaction();
    await pro.send(t.add(...lockTokensTx.instructions), lockTokensTx.signers);
    // console.log('FOURTH WORKS');

    console.log(
        'base',
        base.publicKey.toString(),
        'smartWalletWrapper',
        smartWalletWrapper.key.toString(),
        'governor',
        governor.toString(),
        'locker',
        locker.toString(),
        'escrow',
        escrow.toString(),
        '\n'
    );

    // Create a USDC USDT 0.002% pool from the UI

    const [poolState] = await PublicKey.findProgramAddress(
        [POOL_SEED, token0.toBuffer(), token1.toBuffer(), u32ToSeed(FeeAmount.SUPER_STABLE)],
        new PublicKey('cysPXAjehMpVKUapzbMCCnpFxUFFryEWEaLgnb9NrR8')
    );

    // Create boosted incentive
    const slot = await connection.getSlot();
    const blockTime = await connection.getBlockTime(slot);

    if (!blockTime) {
        return;
    }
    const startTime = new BN(blockTime + 100);
    const endTime = new BN(blockTime + 86400);

    const { wrapper: _incentiveWrapper, tx: createIncentiveTx } =
        await cykuraStakerSdk.createIncentiveBoosted({
            rewardToken: token0,
            pool: poolState,
            startTime,
            endTime,
            locker,
            refundee: owner,
        });
    const incentiveWrapper = _incentiveWrapper;

    t = new web3.Transaction();
    const txnHash = await pro.send(
        t.add(...createIncentiveTx.instructions),
        createIncentiveTx.signers
    );
    console.log(txnHash);

    console.log(JSON.stringify(await incentiveWrapper.data(), null, 2));

    // Add rewards
    const rewardAmount = new BN(100_000_000);
    t = new web3.Transaction();
    const addRewardTxn = await incentiveWrapper.addReward(rewardAmount);
    const rewardsTxnHash = await pro.send(
        t.add(...addRewardTxn.instructions),
        addRewardTxn.signers
    );

    console.log('Rewards added', rewardsTxnHash);
})();
