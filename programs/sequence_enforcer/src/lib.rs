use anchor_lang::prelude::*;

declare_id!("6Yvr31ELNTbZmU4eb2HXyV1zPDC14LNpuAzHopLdm8P7");

#[program]
pub mod sequence_enforcer {

    use super::*;
    pub fn initialize(ctx: Context<Initialize>, _bump: u8, _sym: String) -> Result<()> {
        let sequence_account = &mut ctx.accounts.sequence_account;
        sequence_account.authority = *ctx.accounts.authority.key;
        Ok(())
    }

    pub fn reset_sequence_number(
        ctx: Context<ResetSequenceNumber>,
        sequence_num: u64,
    ) -> Result<()> {
        msg!("Resetting sequence number to {}", sequence_num);

        let sequence_account = &mut ctx.accounts.sequence_account;
        sequence_account.sequence_num = sequence_num;

        Ok(())
    }

    pub fn check_and_set_sequence_number(
        ctx: Context<CheckAndSetSequenceNumber>,
        sequence_num: u64,
        ttl: u64,
    ) -> Result<()> {
        if ttl > 0 {
            let clock = Clock::get()?;
            if (ttl as i64) < clock.unix_timestamp {
                msg!("TTL expired | ttl={} | now={}", ttl, clock.unix_timestamp);
                return Err(ErrorCode::Expired.into());
            }
        }

        let sequence_account = &mut ctx.accounts.sequence_account;
        let last_known_sequence_num = sequence_account.sequence_num;
        if sequence_num > last_known_sequence_num {
            msg!(
                "Sequence in order | sequence_num={} | last_known={}",
                sequence_num,
                last_known_sequence_num
            );
            sequence_account.sequence_num = sequence_num;
            Ok(())
        } else {
            msg!(
                "Sequence out of order | sequence_num={} | last_known={}",
                sequence_num,
                last_known_sequence_num
            );
            Err(ErrorCode::SequenceOutOfOrder.into())
        }
    }
}

#[derive(Accounts)]
#[instruction(bump: u8, sym: String)]
pub struct Initialize<'info> {
    #[account(init_if_needed,
        payer=authority,
        seeds=[sym.as_bytes(), authority.key().as_ref()],
        bump,
        space = SequenceAccount::MAX_SIZE + 8
    )]
    pub sequence_account: Account<'info, SequenceAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResetSequenceNumber<'info> {
    #[account(mut, has_one=authority)]
    pub sequence_account: Account<'info, SequenceAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CheckAndSetSequenceNumber<'info> {
    #[account(mut, has_one=authority)]
    pub sequence_account: Account<'info, SequenceAccount>,
    pub authority: Signer<'info>,
}

#[account]
#[derive(Default)]
pub struct SequenceAccount {
    pub sequence_num: u64,
    pub authority: Pubkey,
}

impl SequenceAccount {
    pub const MAX_SIZE: usize = 8 + 32;
}

#[error_code]
pub enum ErrorCode {
    #[msg("Sequence out of order")]
    SequenceOutOfOrder,
    #[msg("Tx mined after its expiry time")]
    Expired,
}
