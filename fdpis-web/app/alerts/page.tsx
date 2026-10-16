import { PageHeader } from "@/components/PageHeader";
import { AlertsConsole } from "@/components/alerts/AlertsConsole";

export const metadata = {
  title: "Crew duty alerts — FDPIS",
};

export default function AlertsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Layer 5"
        title="Crew duty alerts"
        description="Every aircraft operating on the selected day, projected forward from its first significant delay and checked against the flight-duty and rest rules of the chosen regulator. Sorted by the time you would need to act; each deadline is shown in local time at the station where the standby crew reports."
      />
      <AlertsConsole />
    </>
  );
}
