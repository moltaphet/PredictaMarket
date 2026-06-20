"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

/** Read the deployed contract address from env (empty until configured). */
export function getContractAddress(): `0x${string}` | "" {
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  return address ? (address as `0x${string}`) : "";
}

export function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
}

/**
 * Create a GenLayer client. When `account` is supplied the SDK signs write transactions
 * through the injected `window.ethereum` provider; reads work with or without an account
 * (StudioNet is gasless).
 */
export function createGenLayerClient(account?: string | null) {
  const config: Record<string, unknown> = { chain: studionet };
  const endpoint = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL;
  if (endpoint) config.endpoint = endpoint;
  if (account) config.account = account as `0x${string}`;
  return createClient(config as Parameters<typeof createClient>[0]);
}

export type GenLayerClient = ReturnType<typeof createGenLayerClient>;
