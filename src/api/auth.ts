import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { prisma } from "../lib/db.js";
import type { ApiResponse } from "../api.js";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface RequestLike { query?: Record<string, unknown>; body?: unknown; headers?: Record<string, string | string[] | undefined>; }

function validAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { return new PublicKey(value.trim()).toBase58(); } catch { return null; }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createWalletChallenge(request: RequestLike, response: ApiResponse): Promise<void> {
  const address = validAddress(request.query?.address);
  if (!address) {
    response.status(400).json({ error: "A valid wallet address is required." });
    return;
  }
  const walletUser = await prisma.walletUser.upsert({ where: { walletAddress: address }, update: {}, create: { walletAddress: address } });
  const nonce = randomUUID();
  const message = `Sign in to Seeker Pulse\nWallet: ${address}\nNonce: ${nonce}`;
  await prisma.walletChallenge.create({ data: { walletUserId: walletUser.id, nonce, message, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) } });
  response.json({ nonce, message, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString() });
}

export async function verifyWalletChallenge(request: RequestLike, response: ApiResponse): Promise<void> {
  const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
  const address = validAddress(body.address);
  const nonce = typeof body.nonce === "string" ? body.nonce : "";
  const signature = typeof body.signature === "string" ? body.signature : "";
  if (!address || !nonce || !signature) {
    response.status(400).json({ error: "Wallet address, nonce, and signature are required." });
    return;
  }

  const challenge = await prisma.walletChallenge.findUnique({ where: { nonce }, include: { walletUser: true } });
  if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date() || challenge.walletUser.walletAddress !== address) {
    response.status(401).json({ error: "This wallet sign-in challenge is invalid or expired." });
    return;
  }

  let verified = false;
  try {
    verified = nacl.sign.detached.verify(
      new TextEncoder().encode(challenge.message),
      bs58.decode(signature),
      new PublicKey(address).toBytes(),
    );
  } catch {
    verified = false;
  }
  if (!verified) {
    response.status(401).json({ error: "Wallet signature verification failed." });
    return;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.$transaction([
    prisma.walletChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } }),
    prisma.walletSession.create({ data: { walletUserId: challenge.walletUserId, tokenHash: hashToken(token), expiresAt } }),
    prisma.mission.upsert({ where: { slug: "first-connection" }, update: {}, create: { slug: "first-connection", title: "First Connection", description: "Connect your wallet to Pulse.", kind: "wallet_connected", category: "onboarding", target: 1, xp: 10 } }),
    prisma.achievement.upsert({ where: { slug: "first-connection" }, update: {}, create: { slug: "first-connection", title: "First Connection", description: "Verified your wallet with Seeker Pulse.", kind: "wallet_connected" } }),
  ]);
  const mission = await prisma.mission.findUniqueOrThrow({ where: { slug: "first-connection" } });
  const achievement = await prisma.achievement.findUniqueOrThrow({ where: { slug: "first-connection" } });
  await prisma.$transaction([
    prisma.missionProgress.upsert({ where: { walletAddress_missionId: { walletAddress: address, missionId: mission.id } }, update: { progress: 1, completedAt: new Date(), lastVerifiedAt: new Date(), walletUserId: challenge.walletUserId }, create: { walletAddress: address, walletUserId: challenge.walletUserId, missionId: mission.id, progress: 1, completedAt: new Date(), lastVerifiedAt: new Date() } }),
    prisma.walletAchievement.upsert({ where: { walletAddress_achievementId: { walletAddress: address, achievementId: achievement.id } }, update: { walletUserId: challenge.walletUserId }, create: { walletAddress: address, walletUserId: challenge.walletUserId, achievementId: achievement.id } }),
  ]);
  response.json({ token, walletAddress: address, expiresAt: expiresAt.toISOString() });
}

export async function requireWalletSession(request: RequestLike): Promise<{ id: string; walletAddress: string } | null> {
  const header = request.headers?.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  const token = value?.startsWith("Bearer ") ? value.slice(7).trim() : "";
  if (!token) return null;
  const session = await prisma.walletSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { walletUser: true } });
  if (!session || session.expiresAt <= new Date()) return null;
  return { id: session.walletUser.id, walletAddress: session.walletUser.walletAddress };
}
