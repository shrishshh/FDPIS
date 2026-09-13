"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RankingRow } from "@/lib/types";
import { AXIS_PROPS, ChartFrame, ChartTooltip, VIZ } from "@/components/performance/chartkit";

export function RankingChart({
  rows,
  baseRate,
}: {
  rows: RankingRow[];
  baseRate: number;
}) {
  return (
    <ChartFrame
      title="Precision against review depth"
      subtitle="How precision decays as the operations team reviews more of the ranked list."
      footnote="The dashed line is the base delay rate of 15.6%. The gap between the curve and that line is the model's lift."
    >
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 20, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={VIZ.grid} vertical={false} />
            <XAxis dataKey="depthPct" {...AXIS_PROPS} tickFormatter={(v: number) => `Top ${v}%`} />
            <YAxis
              {...AXIS_PROPS}
              width={52}
              domain={[0, 1]}
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
            <Tooltip
              content={<ChartTooltip format={(v) => `${(v * 100).toFixed(1)}%`} />}
            />
            <ReferenceLine
              y={baseRate}
              stroke={VIZ.axis}
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{
                value: `Base rate ${(baseRate * 100).toFixed(1)}%`,
                position: "insideBottomRight",
                fill: VIZ.label,
                fontSize: 11,
                fontWeight: 600,
              }}
            />
            <Line
              isAnimationActive={false}
              type="monotone"
              dataKey="precision"
              name="Precision"
              stroke={VIZ.accent}
              strokeWidth={2}
              dot={{ r: 4, fill: VIZ.accent, stroke: "#ffffff", strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
