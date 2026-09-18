import { Connection, PublicKey } from "@solana/web3.js";
import type { ApiRequest, ApiResponse } from "../api.js";

const RPC_URL = process.env.RPC_URL?.trim()
  || process.env.HELIUS_RPC_URL?.trim()
  || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY?.trim() || ""}`;
const SKR_MINT = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3";
const TOKEN_PROGRAMS = [
  new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
];

export async function skrBalance(request: ApiRequest, response: ApiResponse): Promise<void> {
  const address = typeof request.query?.address === "string" ? request.query.address.trim() : "";
  let owner: PublicKey;
  try {
    owner = new PublicKey(address);
  } catch {
    response.status(400).json({ error: "A valid wallet address is required." });
    return;
  }

  try {
    const balance = await readSkrBalance(address, owner);
    response.json({ mint: SKR_MINT, balance: balance.toString(), readOnly: true });
  } catch {
    response.status(503).json({ error: "SKR balance is temporarily unavailable." });
  }
}

export async function readSkrBalance(address: string, owner = new PublicKey(address)): Promise<number> {
  const connection = new Connection(RPC_URL, "confirmed");
  const accounts = await Promise.all(TOKEN_PROGRAMS.map((programId) => connection.getParsedTokenAccountsByOwner(owner, { programId })));
  let balance = 0;
  for (const result of accounts) {
    for (const account of result.value) {
      const info = account.account.data.parsed.info as { mint?: string; tokenAmount?: { uiAmountString?: string } };
      if (info.mint === SKR_MINT) balance += Number(info.tokenAmount?.uiAmountString ?? 0);
    }
  }
  return Number.isFinite(balance) ? balance : 0;
}
