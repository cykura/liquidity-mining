use crate::*;

/// Accounts for [cykura_staker::transfer_deposit].
#[derive(Accounts)]
pub struct TransferDeposit<'info> {
    /// [Deposit].
    #[account(mut, has_one = owner)]
    pub deposit: Account<'info, Deposit>,

    /// The current owner of the deposit.
    pub owner: Signer<'info>,

    /// The new owner of the deposit.
    /// CHECK: Can transfer to arbitrary address.
    pub to: UncheckedAccount<'info>,
}

impl<'info> TransferDeposit<'info> {
    /// Transfers ownership of a [Deposit] to the given recipient
    pub fn transfer_deposit(&mut self) -> Result<()> {
        let deposit = &mut self.deposit;
        deposit.owner = self.to.key();

        emit!(TransferDepositEvent {
            deposit: deposit.key(),
            mint: deposit.mint,
            old_owner: Pubkey::default(),
            new_owner: deposit.owner,
        });

        Ok(())
    }
}

#[event]
/// Emitted when ownership of a deposit changes
pub struct TransferDepositEvent {
    /// The [Deposit] transferred.
    #[index]
    pub deposit: Pubkey,

    /// The mint address of the deposited NFT.
    pub mint: Pubkey,

    /// The owner before the deposit was transferred.
    pub old_owner: Pubkey,

    /// The owner after the deposit was transferred.
    pub new_owner: Pubkey,
}
