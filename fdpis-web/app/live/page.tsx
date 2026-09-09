import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { LiveConsole } from "@/components/live/LiveConsole";

export const metadata = {
  title: "Live delay entry — FDPIS",
};

export default function LivePage() {
  return (
    <>
      <PageHeader
        eyebrow="Interactive"
        title="Live delay entry"
        description="Enter a delay the way an operations controller would, on a real aircraft mid-rotation, and watch it travel through the rest of that airframe's day."
      />
      <Suspense
        fallback={
          <div className="mx-auto max-w-[1600px] px-5 py-7 lg:px-8">
            <div className="h-96 animate-pulse rounded-xl bg-ink-100" />
          </div>
        }
      >
        <LiveConsole />
      </Suspense>
    </>
  );
}
