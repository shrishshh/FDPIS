import { PageHeader } from "@/components/PageHeader";
import { BriefingView } from "@/components/briefing/BriefingView";



export const metadata = {
  title: "Morning briefing — FDPIS",
};

export default function BriefingPage() {
  return (
    <>
      <PageHeader
        eyebrow="05:00 operations view"
        title="Morning briefing"
        description="Every leg in the day ranked by delay risk before the first bank departs. Open any row to see what it takes down with it."
      />
      <BriefingView />
    </>
  );
}
