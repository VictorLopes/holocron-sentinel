'use client';

import React, { useMemo } from 'react';
import { Database, CheckCircle, XCircle, Flame } from 'lucide-react';
import { useDashboardContext } from '../DashboardContext';

export default function StatsCards() {
    const { entities } = useDashboardContext();

    const stats = useMemo(() => {
        const total = entities.length;
        const active = entities.filter((e) => e.status === 'active').length;
        const suspended = entities.filter(
            (e) => e.status === 'suspended',
        ).length;
        const criticalCount = entities.reduce(
            (acc, curr) => acc + (curr.critical_events_count || 0),
            0,
        );
        return { total, active, suspended, criticalCount };
    }, [entities]);

    return (
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        Monitored Entities
                    </p>
                    <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
                    <Database className="h-6 w-6" />
                </div>
            </div>

            {/* Active Outposts */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        Active Outposts
                    </p>
                    <h3 className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                        {stats.active}
                    </h3>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <CheckCircle className="h-6 w-6" />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        Suspended Entities
                    </p>
                    <h3 className="text-2xl font-bold mt-1 text-rose-600 dark:text-rose-400">
                        {stats.suspended}
                    </h3>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-lg">
                    <XCircle className="h-6 w-6" />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        Critical Alerts Count
                    </p>
                    <h3 className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                        {stats.criticalCount}
                    </h3>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-lg">
                    <Flame className="h-6 w-6 animate-pulse" />
                </div>
            </div>
        </section>
    );
}
