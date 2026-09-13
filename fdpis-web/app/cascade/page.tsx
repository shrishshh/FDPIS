import { PageHeader } from "@/components/PageHeader";
import { CascadePicker } from "@/components/cascade/CascadePicker";

export const metadata = { title: "Cascade explorer — FDPIS" };

export default function CascadeIndexPage() {
  return (
    <>
      <PageHeader
        eyebrow="Cascade explorer"
        title="Pick a flight to trace"
        description="Choose any leg and see what its delay did to the rest of that aircraft's day. These are the selected day's highest-risk departures that still have legs to fly."
      />
      <CascadePicker />
    </>
  );
}
