"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useScope } from "@/components/DataScope";
import { Play, RotateCcw, Zap } from "lucide-react";
import type {
  Cascade,
  PresetScenario,
  Rotation,
  RotationSummary,
} from "@/lib/types";
import { CascadeChain } from "@/components/cascade/CascadeChain";
import { RecommendationPanel } from "@/components/cascade/RecommendationPanel";
import { RotationTimeline } from "@/components/live/RotationTimeline";
import { ErrorState } from "@/components/States";
import { formatDuration } from "@/lib/format";
import {
  getPresetScenarios,
  getRotation,
  listRotations,
  simulateCascade,
} from "@/lib/api";

const DEFAULT_DELAY_MIN = 45;
const REVEAL_STEP_MS = 150;

export function LiveConsole() {
  const searchParams = useSearchParams();
  const { date } = useScope();

  const [fleet, setFleet] = useState<RotationSummary[]>([]);
  const [presets, setPresets] = useState<PresetScenario[]>([]);
  const [tail, setTail] = useState<string>("");
  const [rotation, setRotation] = useState<Rotation | null>(null);
  const [legIndex, setLegIndex] = useState<number | null>(null);
  const [delayMin, setDelayMin] = useState(DEFAULT_DELAY_MIN);

  const [cascade, setCascade] = useState<Cascade | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [runToken, setRunToken] = useState(0);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [runError, setRunError] = useState<unknown>(null);
  const [loadError, setLoadError] = useState<unknown>(null);

  const legFromUrl = useRef<number | null>(null);
  const autoRunDelay = useRef<number | null>(null);

  /* Fleet list and presets, once. */
  useEffect(() => {
    // The scope resolves the default date asynchronously; do not fire until it has.
    if (!date) return;
    let live = true;
    setLoadError(null);
    Promise.all([listRotations(date), getPresetScenarios(date)])
      .then(([f, p]) => {
      if (!live) return;
      setFleet(f);
      setPresets(p);

      const urlTail = searchParams.get("tail");
      const urlLeg = Number(searchParams.get("leg"));
      const preferred =
        (urlTail && f.find((r) => r.tail === urlTail)) ??
        f.find((r) => r.legCount >= 5) ??
        f[0];

      if (preferred) {
        if (urlTail === preferred.tail && Number.isFinite(urlLeg) && urlLeg > 0) {
          legFromUrl.current = urlLeg;
          const urlDelay = Number(searchParams.get("delay"));
          if (Number.isFinite(urlDelay) && urlDelay > 0) {
            autoRunDelay.current = Math.min(480, urlDelay);
            setDelayMin(Math.min(480, urlDelay));
          }
        }
        setTail(preferred.tail);
      }
      })
      .catch((e) => { if (live) setLoadError(e); });
    return () => {
      live = false;
    };
    // searchParams is read once, on mount, deliberately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  /* Load the selected aircraft's day. */
  useEffect(() => {
    if (!tail || !date) return;
    let live = true;
    getRotation(tail, date).then((r) => {
      if (!live || !r) return;
      setRotation(r);
      setLegIndex((current) => {
        const fromUrl = legFromUrl.current;
        legFromUrl.current = null;
        if (fromUrl && fromUrl >= 1 && fromUrl <= r.legs.length) return fromUrl;
        if (current != null && current >= 1 && current <= r.legs.length) return current;
        return Math.min(2, r.legs.length);
      });

      // A deep link that carries a delay runs itself, so a shared scenario
      // opens on the answer rather than on an empty form.
      const pending = autoRunDelay.current;
      autoRunDelay.current = null;
      if (pending != null) {
        const leg = legFromUrl.current ?? Math.min(2, r.legs.length);
        void run(r.tail, leg, pending);
      }
    });
    return () => {
      live = false;
    };
  }, [tail]);

  /* Reveal the chain one hop at a time. */
  useEffect(() => {
    if (!cascade) return;
    setRevealed(0);
    const timers = cascade.nodes.map((_, i) =>
      setTimeout(() => setRevealed(i + 1), (i + 1) * REVEAL_STEP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [cascade, runToken]);

  const run = useCallback(
    async (nextTail: string, nextLeg: number, nextDelay: number) => {
      setRunError(null);
      try {
        const result = await simulateCascade({
        tail: nextTail,
        date,
        legIndex: nextLeg,
        observedDelayMin: nextDelay,
        });
        setCascade(result);
        setRunToken((t) => t + 1);
      } catch (e) {
        setRunError(e);
        setCascade(null);
      }
    },
    [date],
  );

  function reset() {
    setCascade(null);
    setRevealed(0);
    setDelayMin(DEFAULT_DELAY_MIN);
    setActivePreset(null);
  }

  function applyPreset(preset: PresetScenario) {
    setActivePreset(preset.id);
    setTail(preset.tail);
    setLegIndex(preset.legIndex);
    setDelayMin(preset.delayMinutes);
    void run(preset.tail, preset.legIndex, preset.delayMinutes);
  }

  const selectedLeg =
    rotation && legIndex != null
      ? rotation.legs.find((l) => l.legIndex === legIndex) ?? null
      : null;

  const visibleRecommendations = (cascade?.recommendations ?? []).filter(
    (r) => r.triggeredAtHop <= revealed,
  );

  if (loadError) {
    return (
      <div className="mx-auto max-w-[1600px] px-5 py-7 lg:px-8">
        <ErrorState
          error={loadError}
          context="Could not load rotations for this date"
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-5 py-7 lg:px-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_352px]">
        <div className="min-w-0 space-y-6">
          {/* Presets */}
          <section className="card card-pad">
            <div className="flex items-center gap-2.5">
              <Zap className="h-4 w-4 text-accent-700" aria-hidden />
              <h2 className="text-sm font-bold tracking-tight text-ink-900">
                Preset scenarios
              </h2>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`rounded-lg border p-3.5 text-left transition-colors duration-150 ${
                    activePreset === preset.id
                      ? "border-accent-500 bg-accent-50"
                      : "border-ink-200 bg-white hover:border-accent-300 hover:bg-accent-50/40"
                  }`}
                >
                  <p className="text-sm font-semibold text-ink-900">{preset.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">
                    {preset.description}
                  </p>
                  <p className="tnum mt-2 text-[0.6875rem] font-medium text-ink-400">
                    {preset.tail} &middot; leg {preset.legIndex}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* Aircraft + rotation */}
          <section className="card overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-ink-200 px-5 py-4 lg:flex-row lg:items-end lg:justify-between lg:px-6">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-600">Aircraft tail</span>
                <select
                  className="field w-full min-w-[22rem] lg:w-auto"
                  value={tail}
                  onChange={(e) => {
                    setTail(e.target.value);
                    setCascade(null);
                    setRevealed(0);
                    setActivePreset(null);
                  }}
                >
                  {fleet.map((r) => (
                    <option key={r.tail} value={r.tail}>
                      {r.tail} &middot; {r.carrier} &middot; {r.legCount}{" "}
                      legs &middot; {r.routeLabel}
                    </option>
                  ))}
                </select>
              </label>

              {rotation ? (
                <p className="tnum text-sm text-ink-500">
                  {rotation.carrier} &middot;{" "}
                  {rotation.legs.length} legs today
                </p>
              ) : null}
            </div>

            <div className="px-5 py-5 lg:px-6">
              <p className="eyebrow mb-3">
                Rotation &mdash; select the leg where the delay happened
              </p>
              {rotation ? (
                <RotationTimeline
                  rotation={rotation}
                  selectedLegIndex={legIndex}
                  onSelect={(idx) => {
                    setLegIndex(idx);
                    setCascade(null);
                    setRevealed(0);
                    setActivePreset(null);
                  }}
                  cascade={cascade}
                  revealedHops={revealed}
                />
              ) : (
                <div className="h-40 animate-pulse rounded-lg bg-ink-100" />
              )}
            </div>
          </section>

          {/* Delay entry */}
          <section className="card card-pad">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <p className="eyebrow mb-1">Observed departure delay</p>
                <p className="text-sm text-ink-600">
                  {selectedLeg ? (
                    <span className="tnum">
                      {selectedLeg.flightNumber} &middot; {selectedLeg.origin}
                      <span className="px-1 text-ink-300">&rarr;</span>
                      {selectedLeg.destination} &middot; leg {selectedLeg.legIndex} of{" "}
                      {rotation?.legCount ?? "?"}
                    </span>
                  ) : (
                    "Select a leg on the timeline above."
                  )}
                </p>

                <div className="mt-4 flex items-center gap-4">
                  <input
                    type="range"
                    min={0}
                    max={180}
                    step={5}
                    value={delayMin}
                    onChange={(e) => setDelayMin(Number(e.target.value))}
                    className="h-10 flex-1"
                    aria-label="Observed delay in minutes"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={480}
                      step={1}
                      value={delayMin}
                      onChange={(e) =>
                        setDelayMin(Math.max(0, Math.min(480, Number(e.target.value))))
                      }
                      className="field tnum w-24 text-right text-lg font-semibold"
                      aria-label="Observed delay in minutes"
                    />
                    <span className="text-sm font-medium text-ink-500">min</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  className="btn-primary h-11 px-5"
                  disabled={!tail || legIndex == null}
                  onClick={() => {
                    if (!tail || legIndex == null) return;
                    setActivePreset(null);
                    void run(tail, legIndex, delayMin);
                  }}
                >
                  <Play className="h-4 w-4" aria-hidden />
                  Compute cascade
                </button>
                <button type="button" className="btn-secondary h-11" onClick={reset}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Reset
                </button>
              </div>
            </div>
          </section>

          {runError ? (
            <ErrorState
              error={runError}
              context="Could not compute the cascade"
              onRetry={() => { if (tail && legIndex != null) void run(tail, legIndex, delayMin); }}
            />
          ) : null}

          {/* Result */}
          <section className="card overflow-hidden">
            <div className="flex flex-col gap-1 border-b border-ink-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
              <h2 className="text-[0.9375rem] font-bold tracking-tight text-ink-900">
                Predicted cascade
              </h2>
              {cascade ? (
                <p className="tnum text-sm text-ink-500">
                  {formatDuration(cascade.summary.totalDelayMinutesAdded)} of downstream delay
                  across depth 1&ndash;2 &middot; {cascade.nodes.length} legs in the chain
                </p>
              ) : null}
            </div>

            <div className="px-5 py-6 lg:px-6">
              {cascade ? (
                <CascadeChain
                  cascade={{ ...cascade, nodes: cascade.nodes.slice(0, revealed) }}
                  animateFrom={String(runToken)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-ink-300 bg-ink-50/50 px-6 py-14 text-center">
                  <p className="text-sm font-semibold text-ink-700">
                    No delay entered yet
                  </p>
                  <p className="max-w-md text-sm leading-relaxed text-ink-500">
                    Pick a leg, set an observed delay, and the cascade will run down the
                    rest of this aircraft&apos;s day.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <RecommendationPanel
          recommendations={visibleRecommendations}
          className="self-start xl:sticky xl:top-20"
        />
      </div>
    </div>
  );
}
