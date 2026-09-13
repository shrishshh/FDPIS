"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import type { ApiHealth, CarrierOption, DateOption } from "@/lib/types";
import { getFilterOptions, getHealth } from "@/lib/api";

/**
 * App-wide selection of date and carrier, plus backend connectivity.
 *
 * The dataset is a fixed historical range, so "today" is meaningless here. The
 * scope lives in the nav and applies across Briefing, Cascade and Live.
 */
interface Scope {
  ready: boolean;
  error: unknown;
  retry: () => void;

  health: ApiHealth | null;
  connected: boolean;

  dates: DateOption[];
  carriers: CarrierOption[];

  date: string;
  setDate: (d: string) => void;
  carrier: string;            // "" means all carriers
  setCarrier: (c: string) => void;
}

const Ctx = createContext<Scope | null>(null);

export function useScope(): Scope {
  const v = useContext(Ctx);
  if (!v) throw new Error("useScope must be used inside <DataScopeProvider>");
  return v;
}

export function DataScopeProvider({ children }: { children: React.ReactNode }) {
  const [dates, setDates] = useState<DateOption[]>([]);
  const [carriers, setCarriers] = useState<CarrierOption[]>([]);
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [date, setDate] = useState("");
  const [carrier, setCarrier] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  const [nonce, setNonce] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setReady(false);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [h, opts] = await Promise.all([getHealth(), getFilterOptions()]);
        if (!live) return;
        setHealth(h);
        setDates(opts.dates);
        setCarriers(opts.carriers);
        // Default to the most recent date the dataset actually covers.
        setDate((d) => d || (opts.dates.at(-1)?.date ?? ""));
        setError(null);
      } catch (e) {
        if (live) {
          setHealth(null);
          setError(e);
        }
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => { live = false; };
  }, [nonce]);

  const value = useMemo<Scope>(
    () => ({
      ready, error, retry, health, connected: health !== null,
      dates, carriers, date, setDate, carrier, setCarrier,
    }),
    [ready, error, retry, health, dates, carriers, date, carrier],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
