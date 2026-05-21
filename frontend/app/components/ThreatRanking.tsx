'use client';

import React from 'react';
import { TrendingUp } from 'lucide-react';
import { useDashboard } from './DashboardContext';

export default function ThreatRanking() {
    const { ranking } = useDashboard();

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2.5">
                <TrendingUp className="h-5 w-5 text-indigo-500" />
                <h3 className="text-lg font-semibold">
                    Critical Threat Ranking (Last 7 Days)
                </h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Entities ordered by total critical events generated over the last 7 days.
            </p>

            {ranking.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/30 rounded-lg text-slate-400 border border-dashed border-slate-200 dark:border-slate-800">
                    No critical activities recorded in the last 7 days.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ranking.map((ent, index) => (
                        <div
                            key={ent.id}
                            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-lg relative overflow-hidden"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 text-sm font-extrabold border border-rose-100 dark:border-rose-900/30">
                                    #{index + 1}
                                </div>
                                <div>
                                    <span className="font-semibold text-sm text-slate-950 dark:text-slate-50 block">
                                        {ent.name}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        Total critical events: {ent.critical_events_count}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span
                                    className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded ${
                                        ent.status === 'suspended'
                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                    }`}
                                >
                                    {ent.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
