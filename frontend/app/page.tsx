import type { Metadata } from 'next';
import { Activity } from 'lucide-react';
import {
    DashboardProvider,
    StreamStatus,
    StatsCards,
    EntitiesTable,
    ThreatRanking,
    RegisterEventForm,
    EventsFeed,
} from './components';
import { API_BASE_URL } from './config';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Holocron Sentinel | Real-Time Systems Monitoring Dashboard',
    description:
        'Monitor infrastructure health, track warning and critical events, and inspect real-time system alerts on the Holocron Sentinel dashboard.',
};

async function fetchData(url: string) {
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
        }
        const json = await res.json();
        return json.data || [];
    } catch (error) {
        console.error('Error fetching data from backend during SSR:', error);
        return [];
    }
}

export default async function Home() {
    const [initialEntities, initialEvents, initialRanking] = await Promise.all([
        fetchData(`${API_BASE_URL}/entities?limit=10`),
        fetchData(`${API_BASE_URL}/events?limit=50`),
        fetchData(`${API_BASE_URL}/entities/ranking`),
    ]);

    return (
        <DashboardProvider
            initialEntities={initialEntities}
            initialEvents={initialEvents}
            initialRanking={initialRanking}>
            <div className="flex-1 bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 min-h-screen">
                <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-md">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-600 text-white rounded-lg">
                                <Activity className="h-6 w-6 animate-pulse" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight">
                                    Holocron Sentinel
                                </h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Real-Time Systems Monitoring
                                </p>
                            </div>
                        </div>

                        <StreamStatus />
                    </div>
                </header>

                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                    <StatsCards />

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                            <EntitiesTable />
                            <ThreatRanking />
                        </div>

                        <div className="space-y-8">
                            <RegisterEventForm />
                            <EventsFeed />
                        </div>
                    </div>
                </main>

                <footer className="border-t border-slate-200 dark:border-slate-800 py-6 mt-12 bg-white dark:bg-slate-900 text-center text-xs text-slate-400">
                    <p>Holocron Sentinel</p>
                </footer>
            </div>
        </DashboardProvider>
    );
}
