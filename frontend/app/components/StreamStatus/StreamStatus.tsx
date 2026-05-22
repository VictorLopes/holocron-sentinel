'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useDashboardContext } from '../DashboardContext';

export default function StreamStatus() {
    const { streamStatus, isRefreshing, handleRefreshAll } = useDashboardContext();

    return (
        <div className="flex items-center gap-3">
            <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                    streamStatus === 'connected'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50'
                        : streamStatus === 'connecting'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50'
                          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/50'
                }`}
            >
                <span
                    className={`h-2 w-2 rounded-full ${
                        streamStatus === 'connected'
                            ? 'bg-emerald-500 animate-ping'
                            : streamStatus === 'connecting'
                              ? 'bg-amber-500 animate-pulse'
                              : 'bg-rose-500'
                    }`}
                />
                <span className="capitalize">
                    {streamStatus === 'connected'
                        ? 'Live Stream Active'
                        : streamStatus === 'connecting'
                          ? 'Reconnecting...'
                          : 'Stream Disconnected'}
                </span>
            </div>

            <button
                onClick={handleRefreshAll}
                disabled={isRefreshing}
                className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
                <RefreshCw
                    className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                />
            </button>
        </div>
    );
}
