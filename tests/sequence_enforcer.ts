import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SequenceEnforcer } from "../target/types/sequence_enforcer";

describe("sequence_enforcer", () => {
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace
    .SequenceEnforcer as Program<SequenceEnforcer>;

  it("Initialize and reset, then increase", async () => {
    const [address, bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("SOL-PERP"), program.provider.wallet.publicKey.toBuffer()],
      program.programId,
    );

    const tx = await program.rpc.initialize(bump, "SOL-PERP", {
      accounts: {
        sequenceAccount: address,
        authority: program.provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
    });

    await program.rpc.resetSequenceNumber(new anchor.BN(1234), {
      accounts: {
        sequenceAccount: address,
        authority: program.provider.wallet.publicKey,
      },
    });

    await program.rpc.checkAndSetSequenceNumber(
      new anchor.BN(1235),
      new anchor.BN(0),
      {
        accounts: {
          sequenceAccount: address,
          authority: program.provider.wallet.publicKey,
        },
      },
    );

    console.log("Your transaction signature", tx);
  });

  it("Increase out of order", async () => {
    const [address, _bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("SOL-PERP"), program.provider.wallet.publicKey.toBuffer()],
      program.programId,
    );

    await program.rpc.checkAndSetSequenceNumber(
      new anchor.BN(1237),
      new anchor.BN(0),
      {
        accounts: {
          sequenceAccount: address,
          authority: program.provider.wallet.publicKey,
        },
      },
    );

    try {
      await program.rpc.checkAndSetSequenceNumber(new anchor.BN(1236), {
        accounts: {
          sequenceAccount: address,
          authority: program.provider.wallet.publicKey,
        },
      });
    } catch (e) {
      return;
    }

    console.assert(false);
  });

  it("TTL ok", async () => {
    const [address, _bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("SOL-PERP"), program.provider.wallet.publicKey.toBuffer()],
      program.programId,
    );

    try {
      await program.rpc.checkAndSetSequenceNumber(
        new anchor.BN(1238),
        new anchor.BN((Date.now() + 30_000) / 1_000),
        {
          accounts: {
            sequenceAccount: address,
            authority: program.provider.wallet.publicKey,
          },
        },
      );
    } catch (e) {
      console.assert(false);
    }

    console.assert(true);
  });

  it("TTL expired", async () => {
    const [address, _bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("SOL-PERP"), program.provider.wallet.publicKey.toBuffer()],
      program.programId,
    );

    try {
      await program.rpc.checkAndSetSequenceNumber(
        new anchor.BN(1237),
        new anchor.BN((Date.now() - 30_000) / 1_000),
        {
          accounts: {
            sequenceAccount: address,
            authority: program.provider.wallet.publicKey,
          },
        },
      );
    } catch (e) {
      return;
    }

    console.assert(false);
  });
});
