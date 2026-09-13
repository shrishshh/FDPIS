import { CascadeExplorer } from "@/components/cascade/CascadeExplorer";

export const metadata = { title: "Cascade explorer — FDPIS" };

export default function CascadePage({
  params,
}: {
  params: { tail: string; date: string; leg: string };
}) {
  return (
    <CascadeExplorer
      tail={decodeURIComponent(params.tail)}
      date={decodeURIComponent(params.date)}
      legIndex={Number(params.leg)}
    />
  );
}
