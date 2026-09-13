import type { ApiHealth, DateOption, FilterOptions } from "@/lib/types";
import { apiGet } from "@/lib/api/client";

interface RawHealth {
  status: string;
  parquet_rows: number;
  date_min: string;
  date_max: string;
  date_count: number;
  layer3_feature_count: number;
  layer4_feature_count: number;
  gate_threshold: number;
  confidence_depth: number;
  using_historical_data: boolean;
}

/** GET /api/health - also the connectivity probe for the nav indicator. */
export async function getHealth(): Promise<ApiHealth> {
  const r = await apiGet<RawHealth>("/api/health");
  return {
    status: r.status,
    parquetRows: r.parquet_rows,
    dateMin: r.date_min,
    dateMax: r.date_max,
    dateCount: r.date_count,
    layer3FeatureCount: r.layer3_feature_count,
    layer4FeatureCount: r.layer4_feature_count,
    gateThreshold: r.gate_threshold,
    confidenceDepth: r.confidence_depth,
    usingHistoricalData: r.using_historical_data,
  };
}

/** GET /api/dates */
export async function getDates(): Promise<DateOption[]> {
  return apiGet<DateOption[]>("/api/dates");
}

/**
 * Filter dropdown contents.
 *
 * The backend has no origins endpoint, so origin filtering is applied
 * client-side over the briefing result instead.
 */
export async function getFilterOptions(): Promise<FilterOptions> {
  const [carriers, dates] = await Promise.all([
    apiGet<{ carrier: string; flights: number }[]>("/api/carriers"),
    getDates(),
  ]);
  return {
    carriers: carriers.map((c) => ({ code: c.carrier, flights: c.flights })),
    dates,
  };
}

/** The most recent date the dataset covers - the app's default selection. */
export async function getLatestDate(): Promise<string> {
  const dates = await getDates();
  if (dates.length === 0) throw new Error("the API returned no dates");
  return dates[dates.length - 1].date;
}
