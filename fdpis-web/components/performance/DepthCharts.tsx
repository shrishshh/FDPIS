"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PropagationDepthRow } from "@/lib/types";
import { AXIS_PROPS, ChartFrame, ChartTooltip, VIZ } from "@/components/performance/chartkit";

/** Two panels: minutes and correlation never share an axis. */
export function DepthCharts({
  rows,
  confidenceDepth,
}: {
  rows: PropagationDepthRow[];
  confidenceDepth: number;
}) {
  const shadeFrom = confidenceDepth + 0.5;
  const lastDepth = rows[rows.length - 1]?.depth ?? 5;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ChartFrame
        title="Mean absolute error by cascade depth"
        subtitle="Error in minutes on predicted downstream departure delay."
        footnote="Error grows fastest between depth 1 and 2, then flattens as predictions revert toward the mean."
      >
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={VIZ.grid} vertical={false} />
              <XAxis
                dataKey="depth"
                type="number"
                domain={[1, lastDepth]}
                ticks={rows.map((r) => r.depth)}
                {...AXIS_PROPS}
                tickFormatter={(v: number) => `Depth ${v}`}
              />
              <YAxis
                {...AXIS_PROPS}
                width={52}
                domain={[0, 45]}
                tickFormatter={(v: number) => `${v}m`}
              />
              <Tooltip
                labelFormatter={(v) => `Depth ${v}`}
                content={<ChartTooltip format={(v) => `${v.toFixed(2)} min`} />}
              />
              <ReferenceArea
                x1={shadeFrom}
                x2={lastDepth}
                fill={VIZ.neutral}
                fillOpacity={0.22}
              />
              <ReferenceLine
                x={confidenceDepth}
                stroke={VIZ.boundary}
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{
                  value: "Confidence boundary",
                  position: "insideTopRight",
                  fill: VIZ.boundary,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              />
              <Line
                isAnimationActive={false}
                type="monotone"
                dataKey="maeMinutes"
                name="MAE"
                stroke={VIZ.accent}
                strokeWidth={2}
                dot={{ r: 4, fill: VIZ.accent, stroke: "#ffffff", strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>

      <ChartFrame
        title="Correlation with observed delay by depth"
        subtitle="Pearson correlation between predicted and observed downstream delay."
        footnote="Below 0.33 the prediction is no longer strong enough to publish a number. FDPIS reports quantitative predictions to depth 2 and qualitative statements past it."
      >
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={VIZ.grid} vertical={false} />
              <XAxis
                dataKey="depth"
                type="number"
                domain={[1, lastDepth]}
                ticks={rows.map((r) => r.depth)}
                {...AXIS_PROPS}
                tickFormatter={(v: number) => `Depth ${v}`}
              />
              <YAxis
                {...AXIS_PROPS}
                width={52}
                domain={[0, 0.8]}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <Tooltip
                labelFormatter={(v) => `Depth ${v}`}
                content={<ChartTooltip format={(v) => v.toFixed(3)} />}
              />
              <ReferenceArea
                x1={shadeFrom}
                x2={lastDepth}
                fill={VIZ.neutral}
                fillOpacity={0.22}
              />
              <ReferenceLine
                x={confidenceDepth}
                stroke={VIZ.boundary}
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{
                  value: "Confidence boundary",
                  position: "insideTopRight",
                  fill: VIZ.boundary,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              />
              <ReferenceLine
                y={0.33}
                stroke={VIZ.axis}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: "0.33",
                  position: "left",
                  fill: VIZ.label,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
              <Line
                isAnimationActive={false}
                type="monotone"
                dataKey="correlation"
                name="Correlation"
                stroke={VIZ.accent}
                strokeWidth={2}
                dot={{ r: 4, fill: VIZ.accent, stroke: "#ffffff", strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
    </div>
  );
}
