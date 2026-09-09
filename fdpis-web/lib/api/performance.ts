import type { ModelPerformance } from "@/lib/types";
import { MODEL_PERFORMANCE } from "@/lib/mock/performance";
import { simulateLatency } from "@/lib/api/config";

/**
 * Validation results for the model review page.
 *
 * Backend: GET /api/v1/model/performance
 */
export async function getModelPerformance(): Promise<ModelPerformance> {
  await simulateLatency(80);
  return MODEL_PERFORMANCE;
}
