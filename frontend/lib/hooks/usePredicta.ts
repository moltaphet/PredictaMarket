"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PredictaMarketContract } from "../contracts/PredictaMarket";
import { getContractAddress } from "../genlayer/client";
import { useWallet } from "../genlayer/WalletProvider";
import type { Market, ProtocolStats, Portfolio, Side, Category } from "../contracts/types";

/**
 * Memoized contract client, re-created whenever the connected account changes so writes
 * sign with the right wallet. Returns null until a contract address is configured.
 */
export function usePredictaContract(): PredictaMarketContract | null {
  const { address } = useWallet();
  const contractAddress = getContractAddress();

  return useMemo(() => {
    if (!contractAddress) return null;
    return new PredictaMarketContract(contractAddress, address);
  }, [contractAddress, address]);
}

export function useIsConfigured(): boolean {
  return getContractAddress() !== "";
}

/* ------------------------------- reads ------------------------------- */

export function useMarkets() {
  const contract = usePredictaContract();
  return useQuery<Market[], Error>({
    queryKey: ["markets"],
    queryFn: () => (contract ? contract.getMarkets() : Promise.resolve([])),
    enabled: !!contract,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });
}

export function useStats() {
  const contract = usePredictaContract();
  return useQuery<ProtocolStats, Error>({
    queryKey: ["stats"],
    queryFn: () =>
      contract
        ? contract.getStats()
        : Promise.resolve({ tvlAtto: 0n, totalMarkets: 0, active: 0, pending: 0, resolved: 0 }),
    enabled: !!contract,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });
}

export function useUserPortfolio() {
  const contract = usePredictaContract();
  const { address } = useWallet();
  return useQuery<Portfolio | null, Error>({
    queryKey: ["portfolio", address],
    queryFn: () => (contract && address ? contract.getUserPortfolio(address) : Promise.resolve(null)),
    enabled: !!contract && !!address,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });
}

/* ------------------------------- writes ------------------------------ */

/** Invalidate every market-derived view so the UI stays in sync after a write. */
function useSyncAfterWrite() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["markets"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    queryClient.invalidateQueries({ queryKey: ["portfolio"] });
  };
}

export interface PlaceBetInput {
  marketId: number;
  side: Side;
  stakeAtto: bigint;
}

export function usePlaceBet() {
  const contract = usePredictaContract();
  const sync = useSyncAfterWrite();
  return useMutation({
    mutationFn: ({ marketId, side, stakeAtto }: PlaceBetInput) => {
      if (!contract) throw new Error("Contract is not configured.");
      return contract.placeBet(marketId, side, stakeAtto);
    },
    onSuccess: sync,
  });
}

export interface CreateMarketInput {
  question: string;
  description: string;
  category: Category;
  endDate: string;
  verificationUrls: string[];
  liquidityAtto: bigint;
}

export function useCreateMarket() {
  const contract = usePredictaContract();
  const sync = useSyncAfterWrite();
  return useMutation({
    mutationFn: (input: CreateMarketInput) => {
      if (!contract) throw new Error("Contract is not configured.");
      return contract.createMarket(
        input.question,
        input.description,
        input.category,
        input.endDate,
        input.verificationUrls,
        input.liquidityAtto
      );
    },
    onSuccess: sync,
  });
}

export function useResolveMarket() {
  const contract = usePredictaContract();
  const sync = useSyncAfterWrite();
  return useMutation({
    mutationFn: (marketId: number) => {
      if (!contract) throw new Error("Contract is not configured.");
      return contract.resolveMarket(marketId);
    },
    onSuccess: sync,
  });
}

export function useClaimWinnings() {
  const contract = usePredictaContract();
  const sync = useSyncAfterWrite();
  return useMutation({
    mutationFn: (marketId: number) => {
      if (!contract) throw new Error("Contract is not configured.");
      return contract.claimWinnings(marketId);
    },
    onSuccess: sync,
  });
}
