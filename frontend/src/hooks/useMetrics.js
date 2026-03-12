import { useQuery } from "@tanstack/react-query";
import {
  getVelocity, getPredictability, getLeadTime,
  getScopeChange, getCarryOver, getExecutiveReport, getSprints,
} from "../services/api";

const DEFAULT_STALE = 5 * 60 * 1000; // 5 min

export const useSprints = () =>
  useQuery({ queryKey: ["sprints"], queryFn: () => getSprints(), staleTime: DEFAULT_STALE });

export const useVelocity = (params) =>
  useQuery({ queryKey: ["velocity", params], queryFn: () => getVelocity(params), staleTime: DEFAULT_STALE });

export const usePredictability = (params) =>
  useQuery({ queryKey: ["predictability", params], queryFn: () => getPredictability(params), staleTime: DEFAULT_STALE });

export const useLeadTime = (params) =>
  useQuery({ queryKey: ["lead-time", params], queryFn: () => getLeadTime(params), staleTime: DEFAULT_STALE });

export const useScopeChange = (params) =>
  useQuery({ queryKey: ["scope-change", params], queryFn: () => getScopeChange(params), staleTime: DEFAULT_STALE });

export const useCarryOver = (params) =>
  useQuery({ queryKey: ["carry-over", params], queryFn: () => getCarryOver(params), staleTime: DEFAULT_STALE });

export const useExecutiveReport = (params) =>
  useQuery({ queryKey: ["executive-report", params], queryFn: () => getExecutiveReport(params), staleTime: DEFAULT_STALE });
