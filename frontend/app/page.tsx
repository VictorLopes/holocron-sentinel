import type { Metadata } from "next";
import SentinelDashboardClient from "./components/SentinelDashboardClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Holocron Sentinel | Real-Time Systems Monitoring Dashboard",
  description: "Monitor infrastructure health, track warning and critical events, and inspect real-time system alerts on the Holocron Sentinel dashboard.",
};

async function fetchData(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error("Error fetching data from backend during SSR:", error);
    return [];
  }
}

export default async function Home() {
  const [initialEntities, initialEvents, initialRanking] = await Promise.all([
    fetchData("http://localhost:3002/entities?limit=100"),
    fetchData("http://localhost:3002/events?limit=50"),
    fetchData("http://localhost:3002/entities/ranking"),
  ]);

  return (
    <main className="flex-1 flex flex-col min-h-screen">
      <SentinelDashboardClient
        initialEntities={initialEntities}
        initialEvents={initialEvents}
        initialRanking={initialRanking}
      />
    </main>
  );
}
