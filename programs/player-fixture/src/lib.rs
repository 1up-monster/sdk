//! player-fixture — single-instruction Solana program for ELO accounts.
//!
//! Instruction: initialize_player
//!
//!   Accounts:
//!     [0] payer          — signer, funds the account
//!     [1] player_account — writable, new account to create (fresh keypair)
//!     [2] system_program
//!
//!   Data:
//!     [0..32]  authority: Pubkey  (player who owns this ELO account)
//!     [32..36] elo:       u32 LE  (initial ELO rating)
//!
//!   Result: player_account is created and written with:
//!     bytes [0..4]  elo:       u32 LE
//!     bytes [4..36] authority: Pubkey
//!
//! 1upmonster versus config:
//!   offset: 0, type: "u32", endian: "little"
//!   account.type: "static", address: "<player_account_pubkey>"

#![no_std]

use pinocchio::{
    error::ProgramError,
    AccountView, Address, ProgramResult,
};
use pinocchio_system::instructions::CreateAccount;

pinocchio::program_entrypoint!(process_instruction);
pinocchio::default_allocator!();
pinocchio::nostd_panic_handler!();

const ACCOUNT_SIZE: u64 = 36; // 4 bytes elo + 32 bytes authority

fn process_instruction(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    if accounts.len() < 3 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }
    if data.len() < 36 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let payer = &accounts[0];
    let player_account = &accounts[1];

    // Parse instruction data: [authority: 32 bytes][elo: u32 LE 4 bytes]
    let authority = &data[0..32];
    let elo = u32::from_le_bytes(data[32..36].try_into().unwrap());

    // Create the account; fetch minimum rent via syscall (no rent sysvar account needed)
    CreateAccount::with_minimum_balance(payer, player_account, ACCOUNT_SIZE, program_id, None)?
        .invoke()?;

    // Write account data: [elo: u32 LE][authority: Pubkey]
    let mut buf = player_account.try_borrow_mut()?;
    buf[0..4].copy_from_slice(&elo.to_le_bytes());
    buf[4..36].copy_from_slice(authority);

    Ok(())
}
