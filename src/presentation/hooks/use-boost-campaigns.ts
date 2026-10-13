import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BoostCampaign, CreateBoostCampaignData } from "yotuvia-core";

import {
  createBoostCampaignUseCase,
  listBoostCampaignsUseCase,
  pauseBoostCampaignUseCase,
} from "@/di/container";
import { attachErrorKey } from "@/presentation/lib/errors";

/**
 * CPM boost campaign hooks for the owner content section.
 *
 * Keyed by a local root rather than `queryKeys`: the boost domain is new and
 * self-contained, so it does not need to share an invalidation root yet.
 */
const BOOST_CAMPAIGNS_KEY = ["boost", "campaigns"] as const;

/** The signed-in center's own campaigns, newest first. */
export function useBoostCampaigns(enabled = true) {
  return useQuery<BoostCampaign[]>({
    queryKey: BOOST_CAMPAIGNS_KEY,
    queryFn: () => listBoostCampaignsUseCase.execute(),
    enabled,
  });
}

/** Creates a campaign (holds the budget up front) and refreshes the list. */
export function useCreateBoostCampaign() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<BoostCampaign, Error, CreateBoostCampaignData>({
      mutationFn: (data) => createBoostCampaignUseCase.execute(data),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: BOOST_CAMPAIGNS_KEY }),
    }),
    "web.errors.boost_create",
  );
}

/** Pauses an owned campaign and refreshes the list. */
export function usePauseBoostCampaign() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, number>({
      mutationFn: (id) => pauseBoostCampaignUseCase.execute(id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: BOOST_CAMPAIGNS_KEY }),
    }),
    "web.errors.boost_pause",
  );
}
