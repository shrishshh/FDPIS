import type { ModelPerformance, RuleProfileId } from "@/lib/types";
import { apiGet } from "@/lib/api/client";

interface RawPerf {
  model_version: string;
  classifier: Record<string, number | string>;
  ablation: { note: string; rows: Record<string, number | string | null>[] };
  models?: Record<string, number | string | boolean>[];
  ranking: Record<string, number>[];
  propagation: Record<string, number | string>;
  depth: { depth: number; mae: number; correlation: number; quantitative: boolean }[];
  cascade_validation: Record<string, number | string>;
  per_carrier: {
    weighted_precision_at_1pct: number;
    mean_precision_at_1pct: number;
    global_precision_at_1pct: number;
    note: string;
    rows: { carrier: string; test_flights: number; precision: number; base_rate: number; lift: number }[];
  };
  weather?: {
    source: string; promoted: boolean; verdict: string;
    rows: { variant: "baseline" | "upper_bound" | "honest"; label: string; deployable: boolean;
            note: string; auc: number; pr_auc: number; f1: number; p1: number; p5: number;
            p10: number; carrier_weighted_p1: number }[];
  } | null;
  layer5?: {
    source: string; test_dates: string; note: string; default_seed_on?: string;
    recall_sets?: { profile: string; alert_set: string; label: string; actual_breaches: number;
                    alerts: number; actionable_recall: number | null; precision: number | null }[];
    three_band?: { split: string; profile: string; likely_rate: number | null;
                   watch_rate: number | null; no_alert_rate: number | null }[];
    rows: Record<string, string | number | null>[];
  } | null;
  limitations: string[];
}

const n = (v: unknown) => Number(v);

/** GET /api/performance - the single source of truth for published metrics. */
export async function getModelPerformance(): Promise<ModelPerformance> {
  const r = await apiGet<RawPerf>("/api/performance");
  const c = r.classifier;

  return {
    modelVersion: String(r.model_version),
    classifier: {
      auc: n(c.auc), f1: n(c.f1),
      precisionAt1: n(c.precision_at_1pct),
      precisionAt5: n(c.precision_at_5pct),
      precisionAt10: n(c.precision_at_10pct),
      features: n(c.features),
      trainingRows: n(c.training_rows),
      testRows: n(c.test_rows),
      baseDelayRate: n(c.base_delay_rate),
      liftAt1: n(c.lift_at_1pct),
      source: String(c.source),
    },
    ablation: r.ablation.rows.map((a) => ({
      group: String(a.group),
      featureCount: n(a.n_feat),
      auc: n(a.auc),
      aucGain: a.auc_gain === null ? null : n(a.auc_gain),
      prAuc: n(a.pr_auc),
      f1: n(a.f1),
      precisionAt1: n(a.p1),
      precisionAt5: n(a.p5),
      precisionAt10: n(a.p10),
    })),
    ablationNote: r.ablation.note,
    // Older backends predate the models block; degrade rather than blank the page.
    models: (r.models ?? []).map((m) => ({
      model: String(m.model),
      auc: n(m.auc), prAuc: n(m.pr_auc),
      precision: n(m.precision), recall: n(m.recall), f1: n(m.f1),
      precisionAt1: n(m.p1), precisionAt5: n(m.p5), precisionAt10: n(m.p10),
      isBest: Boolean(m.is_best), isBaseline: Boolean(m.is_baseline),
    })),
    ranking: r.ranking.map((k) => ({
      depthPct: n(k.depth_pct),
      flightsReviewed: n(k.flights),
      precision: n(k.precision),
      lift: n(k.lift),
    })),
    propagation: {
      gateAuc: n(r.propagation.gate_auc),
      gatePrecision: n(r.propagation.gate_precision),
      gateRecall: n(r.propagation.gate_recall),
      maeAllCandidates: n(r.propagation.mae_all_candidates),
      maeActualCascades: n(r.propagation.mae_actual_cascades),
      intervalCoverage: n(r.propagation.interval_coverage),
      gateThreshold: n(r.propagation.gate_threshold),
      thresholdSelectedOn: String(r.propagation.threshold_selected_on),
    },
    propagationByDepth: r.depth.map((d) => ({
      depth: d.depth, maeMinutes: d.mae,
      correlation: d.correlation, quantitative: d.quantitative,
    })),
    confidenceDepth: r.depth.filter((d) => d.quantitative).length,
    cascadeValidation: {
      precision: n(r.cascade_validation.precision),
      recall: n(r.cascade_validation.recall),
      f1: n(r.cascade_validation.f1),
      records: n(r.cascade_validation.records),
      source: String(r.cascade_validation.source),
    },
    perCarrier: {
      weightedPrecisionAt1: r.per_carrier.weighted_precision_at_1pct,
      meanPrecisionAt1: r.per_carrier.mean_precision_at_1pct,
      globalPrecisionAt1: r.per_carrier.global_precision_at_1pct,
      note: r.per_carrier.note,
      rows: r.per_carrier.rows.map((p) => ({
        carrier: p.carrier, testFlights: p.test_flights,
        precision: p.precision, baseRate: p.base_rate, lift: p.lift,
      })),
    },
    weather: r.weather
      ? {
          source: r.weather.source,
          promoted: r.weather.promoted,
          verdict: r.weather.verdict,
          rows: r.weather.rows.map((w) => ({
            variant: w.variant, label: w.label, deployable: w.deployable, note: w.note,
            auc: w.auc, prAuc: w.pr_auc, f1: w.f1,
            precisionAt1: w.p1, precisionAt5: w.p5, precisionAt10: w.p10,
            carrierWeightedPrecisionAt1: w.carrier_weighted_p1,
          })),
        }
      : null,
    layer5: r.layer5
      ? {
          source: r.layer5.source,
          testDates: r.layer5.test_dates,
          defaultSeedOn: (r.layer5.default_seed_on === "departure" ? "departure" : "arrival"),
          recallSets: (r.layer5.recall_sets ?? []).map((x) => ({
            profile: x.profile as RuleProfileId,
            alertSet: x.alert_set as "a_likely_only" | "b_likely_plus_watch_upper" | "c_all_alerts",
            label: x.label,
            actualBreaches: x.actual_breaches,
            alerts: x.alerts,
            actionableRecall: x.actionable_recall,
            precision: x.precision,
          })),
          threeBand: (r.layer5.three_band ?? []).map((b) => ({
            split: (b.split === "validation" ? "validation" : "test") as "validation" | "test",
            profile: b.profile as RuleProfileId,
            likelyRate: b.likely_rate,
            watchRate: b.watch_rate,
            noAlertRate: b.no_alert_rate,
          })),
          note: r.layer5.note,
          rows: r.layer5.rows.map((x) => {
            const v = (k: string) => (x[k] === null || x[k] === undefined ? null : Number(x[k]));
            return {
              seedOn: (x.seed_on === "departure" ? "departure" : "arrival") as "arrival" | "departure",
              isDefault: Boolean(x.default),
              profile: String(x.profile) as RuleProfileId,
              ruleId: String(x.rule_id),
              rule: String(x.rule),
              actualBreaches: Number(x.actual_breaches),
              precisionLikely: v("precision_likely"),
              recallAnyAlert: v("recall_any_alert"),
              recallActionable: v("recall_actionable"),
              engineLpPrecision: v("engine_lp_precision"),
              engineLpRecall: v("engine_lp_recall"),
              naivePrecisionAtEngineRecall: v("naive_precision_at_engine_recall"),
              naiveRecall: v("naive_recall"),
              naivePrecision: v("naive_precision"),
              enginePrecisionAtNaiveRecall: v("engine_precision_at_naive_recall"),
              medianLeadMin: v("median_lead_min"),
              shareDeadlinePassed: v("share_deadline_passed"),
            };
          }),
        }
      : null,
    limitations: r.limitations,
    // Derived from `classifier` so the landing page has one source of truth too.
    headline: [
      { id: "lift", value: `${n(c.lift_at_1pct).toFixed(1)}x`,
        label: "better than random",
        detail: "Lift over base rate when identifying at-risk flights in the top 1% of the ranked list." },
      { id: "precision", value: `${(n(c.precision_at_1pct) * 100).toFixed(1)}%`,
        label: "precision at top 1%",
        detail: "Of the flights flagged for review, four in five went on to be delayed." },
      { id: "auc", value: n(c.auc).toFixed(4),
        label: "ROC AUC on held-out data",
        detail: `${n(c.features)} features, validated on a chronological hold-out split.` },
      { id: "scale", value: `${(n(c.training_rows) / 1e6).toFixed(1)}M`,
        label: "flights used for training",
        detail: `${n(c.training_rows).toLocaleString("en-US")} training rows, ${n(c.test_rows).toLocaleString("en-US")} held-out test rows.` },
    ],
  };
}
