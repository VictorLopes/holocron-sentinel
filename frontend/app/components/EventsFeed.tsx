'use client';

import React, { useState, useMemo } from 'react';
import { Activity, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { useDashboard } from './DashboardContext';

export default function EventsFeed() {
    const { events, entities } = useDashboard();
    const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all');

    const filteredEvents = useMemo(() => {
        return events.filter((ev) => {
            return eventTypeFilter === 'all' || ev.type === eventTypeFilter;
        });
    }, [events, eventTypeFilter]);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col h-[520px]">
            <div className="space-y-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                        </span>
                        <h3 className="text-base font-semibold">
                            Live System Events Feed
                        </h3>
                    </div>
                </div>

                <div className="flex rounded-md border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-950 w-full">
                    {(['all', 'info', 'warning', 'critical'] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setEventTypeFilter(type)}
                            className={`flex-1 text-center py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                                eventTypeFilter === type
                                    ? type === 'critical'
                                        ? 'bg-rose-600 text-white shadow-sm'
                                        : type === 'warning'
                                          ? 'bg-amber-50 text-white shadow-sm'
                                          : type === 'info'
                                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pt-4 space-y-3 pr-1">
                {filteredEvents.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-12">
                        <Activity className="h-6 w-6 mb-2 text-slate-300" />
                        <p className="text-xs">No events registered yet.</p>
                    </div>
                ) : (
                    filteredEvents.map((ev) => {
                        const targetEntity = entities.find(
                            (ent) => String(ent.id) === String(ev.entity_id),
                        );
                        const entityName = targetEntity
                            ? targetEntity.name
                            : `Entity #${ev.entity_id}`;

                        return (
                            <div
                                key={ev.id}
                                className={`p-3.5 border rounded-lg transition-all text-xs space-y-2 relative overflow-hidden ${
                                    ev.type === 'critical'
                                        ? 'bg-rose-50/10 dark:bg-rose-950/5 border-rose-200/50 dark:border-rose-900/30'
                                        : ev.type === 'warning'
                                          ? 'bg-amber-50/10 dark:bg-amber-950/5 border-amber-200/50 dark:border-amber-900/30'
                                          : 'bg-slate-50/30 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/50'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span
                                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                            ev.type === 'critical'
                                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                                                : ev.type === 'warning'
                                                  ? 'bg-amber-100 text-amber-850 dark:bg-amber-950/40 dark:text-amber-400'
                                                  : 'bg-slate-100 text-slate-850 dark:bg-slate-800 dark:text-slate-300'
                                        }`}
                                    >
                                        {ev.type}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        {new Date(ev.created_at).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                        })}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-slate-400">Target: </span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                        {entityName}
                                    </span>
                                </div>
                                <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                                    External ID: {ev.external_id}
                                </div>

                                {ev.payload && Object.keys(ev.payload).length > 0 && (
                                    <div className="p-2 bg-slate-50 dark:bg-slate-900/60 rounded border border-slate-150 dark:border-slate-850 font-mono text-[10px] text-slate-600 dark:text-slate-400 overflow-x-auto max-h-[80px]">
                                        {JSON.stringify(ev.payload, null, 2)}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
