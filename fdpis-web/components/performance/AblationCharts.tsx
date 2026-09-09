"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AblationRow } from "@/lib/types";
import { AXIS_PROPS, ChartFrame, ChartTooltip, VIZ } from "@/components/performance/chartkit";

/**
 * Two single-measure panels rather than one dual-axis chart. AUC is plotted as
 * lift above chance (0.500) so the bars keep a real zero baseline; the absolute
 * AUC is printed on each bar.
 */
export function AblationCharts({ rows }: { rows: AblationRow[] }) {
  const data = rows.map((r) => ({
    ...r,
    tick: `${r.group}`,
    aucAboveChance: Number((r.auc - 0.5).toFixed(4)),
  }));

  const fill = (group: string) => (group === "F" ? VIZ.accent : VIZ.accentMuted);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ChartFrame
        title="AUC above chance, by cumulative feature group"
        subtitle="Bars measure AUC minus the 0.500 majority baseline. Absolute AUC labelled on each bar."
        footnote="Group F adds rotation features: what the aircraft did earlier in the day."
      >
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 22, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={VIZ.grid} vertical={false} />
              <XAxis dataKey="tick" {...AXIS_PROPS} />
              <YAxis
                {...AXIS_PROPS}
                width={52}
                domain={[0, 0.2]}
                ticks={[0, 0.05, 0.1, 0.15, 0.2]}
                tickFormatter={(v: number) => (0.5 + v).toFixed(2)}
              />
              <Tooltip
                cursor={{ fill: "rgba(13,148,136,0.06)" }}
                content={
                  <ChartTooltip
                    format={(v) => (0.5 + v).toFixed(4)}
                  />
                }
              />
              <Bar
                isAnimationActive={false}
                dataKey="aucAboveChance"
                name="AUC"
                radius={[4, 4, 0, 0]}
                maxBarSize={54}
              >
                {data.map((d) => (
                  <Cell key={d.group} fill={fill(d.group)} />
                ))}
                <LabelList
                  dataKey="auc"
                  position="top"
                  offset={8}
                  className="tnum"
                  fill={VIZ.label}
                  fontSize={11}
                  fontWeight={600}
                  formatter={(v: number) => v.toFixed(4)}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      <ChartFrame
        title="Precision at top 1%, by cumulative feature group"
        subtitle="Share of the 1% highest-ranked flights that were genuinely delayed."
        footnote="Rotation features more than double precision at review depth."
      >
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 22, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={VIZ.grid} vertical={false} />
              <XAxis dataKey="tick" {...AXIS_PROPS} />
              <YAxis
                {...AXIS_PROPS}
                width={52}
                domain={[0, 0.9]}
                ticks={[0, 0.2, 0.4, 0.6, 0.8]}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
              <Tooltip
                cursor={{ fill: "rgba(13,148,136,0.06)" }}
                content={<ChartTooltip format={(v) => `${(v * 100).toFixed(1)}%`} />}
              />
              <Bar
                isAnimationActive={false}
                dataKey="precisionAt1"
                name="Precision@1%"
                radius={[4, 4, 0, 0]}
                maxBarSize={54}
              >
                {data.map((d) => (
                  <Cell key={d.group} fill={fill(d.group)} />
                ))}
                <LabelList
                  dataKey="precisionAt1"
                  position="top"
                  offset={8}
                  className="tnum"
                  fill={VIZ.label}
                  fontSize={11}
                  fontWeight={600}
                  formatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
    </div>
  );
}
