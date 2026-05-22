'use client';

import React, { useState } from 'react';
import { Search, Plus, AlertCircle } from 'lucide-react';
import {
    useDashboardContext,
    Entity,
    CRITICAL_LIMIT,
    API_BASE_URL,
} from '../DashboardContext';

export default function EntitiesTable() {
    const {
        entities,
        setEntities,
        setAllEntities,
        setSelectedEntityId,
        entitySearch,
        setEntitySearch,
        entityStatusFilter,
        setEntityStatusFilter,
        entitiesPage,
        setEntitiesPage,
        totalPages,
        totalEntities,
        entitiesLimit,
    } = useDashboardContext();

    const [showCreateEntity, setShowCreateEntity] = useState(false);
    const [newEntityName, setNewEntityName] = useState('');
    const [createEntityError, setCreateEntityError] = useState('');
    const [createEntitySuccess, setCreateEntitySuccess] = useState('');

    const filteredEntities = entities;

    const handleCreateEntity = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateEntityError('');
        setCreateEntitySuccess('');

        if (!newEntityName.trim()) {
            setCreateEntityError('Entity name cannot be empty');
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/entities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newEntityName }),
            });

            if (!res.ok) {
                throw new Error(
                    (await res.text()) || 'Failed to create entity',
                );
            }

            const createdEntity = await res.json();

            const fullEntity: Entity = {
                ...createdEntity,
                total_events: 0,
                last_event_at: null,
            };

            setEntities((prev) => [fullEntity, ...prev]);
            setAllEntities((prev) => [fullEntity, ...prev]);
            setNewEntityName('');
            setCreateEntitySuccess('Entity created successfully!');
            setTimeout(() => {
                setShowCreateEntity(false);
                setCreateEntitySuccess('');
            }, 1500);

            setSelectedEntityId(createdEntity.id.toString());
        } catch (err) {
            setCreateEntityError(
                err instanceof Error
                    ? err.message
                    : 'An error occurred while creating entity',
            );
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold">
                            Strategic Monitored Entities
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Planets, bases and ships monitored in real-time
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreateEntity(!showCreateEntity)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors self-start sm:self-auto">
                        <Plus className="h-4 w-4" />
                        New Entity
                    </button>
                </div>

                {showCreateEntity && (
                    <form
                        onSubmit={handleCreateEntity}
                        className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                        <h4 className="text-sm font-semibold">
                            Register Monitored Entity
                        </h4>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="e.g. Planet, Rebel Base, Important Ship, Sensitive Point"
                                value={newEntityName}
                                onChange={(e) =>
                                    setNewEntityName(e.target.value)
                                }
                                className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                maxLength={100}
                            />
                            <button
                                type="submit"
                                className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white rounded-lg text-sm font-medium transition-colors">
                                Create
                            </button>
                        </div>
                        {createEntityError && (
                            <p className="text-xs text-rose-600">
                                {createEntityError}
                            </p>
                        )}
                        {createEntitySuccess && (
                            <p className="text-xs text-emerald-600">
                                {createEntitySuccess}
                            </p>
                        )}
                    </form>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search entities by name..."
                            value={entitySearch}
                            onChange={(e) => setEntitySearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-950">
                        <button
                            onClick={() => setEntityStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                entityStatusFilter === 'all'
                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                            }`}>
                            All
                        </button>
                        <button
                            onClick={() => setEntityStatusFilter('active')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                entityStatusFilter === 'active'
                                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                            }`}>
                            Active
                        </button>
                        <button
                            onClick={() => setEntityStatusFilter('suspended')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                entityStatusFilter === 'suspended'
                                    ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                            }`}>
                            Suspended
                        </button>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                {filteredEntities.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                        <AlertCircle className="h-8 w-8 mx-auto mb-3" />
                        <p className="text-sm">
                            No monitored entities found matching filters.
                        </p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase border-b border-slate-200 dark:border-slate-800">
                                <th className="px-6 py-4">Entity Details</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Critical Events</th>
                                <th className="px-6 py-4">Total Events</th>
                                <th className="px-6 py-4">Last Activity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {filteredEntities.map((ent) => {
                                const criticalCount =
                                    ent.critical_events_count || 0;
                                const isCloseToSuspension =
                                    criticalCount === CRITICAL_LIMIT - 1;
                                const isSuspended = ent.status === 'suspended';

                                return (
                                    <tr
                                        key={ent.id}
                                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/20 transition-colors ${
                                            isSuspended
                                                ? 'bg-rose-50/10 dark:bg-rose-950/5'
                                                : isCloseToSuspension
                                                  ? 'bg-amber-50/10 dark:bg-amber-950/5'
                                                  : ''
                                        }`}>
                                        <td className="px-6 py-4">
                                            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                                                {ent.name}
                                            </span>
                                            <span className="text-xs text-slate-400 block mt-0.5">
                                                ID: {ent.id}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4">
                                            <span
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                    isSuspended
                                                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30'
                                                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30'
                                                }`}>
                                                <span
                                                    className={`h-1.5 w-1.5 rounded-full ${isSuspended ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                                />
                                                {ent.status}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4">
                                            <div className="space-y-1.5 max-w-[160px]">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span
                                                        className={`font-semibold ${
                                                            isSuspended
                                                                ? 'text-rose-600 dark:text-rose-400'
                                                                : isCloseToSuspension
                                                                  ? 'text-amber-600 dark:text-amber-400'
                                                                  : 'text-slate-500'
                                                        }`}>
                                                        {criticalCount} /{' '}
                                                        {CRITICAL_LIMIT}
                                                    </span>
                                                    {isSuspended && (
                                                        <span className="text-[10px] text-rose-500 font-bold uppercase">
                                                            Suspended
                                                        </span>
                                                    )}
                                                    {isCloseToSuspension && (
                                                        <span className="text-[10px] text-amber-500 font-bold uppercase">
                                                            Critical!
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
                                                    {[
                                                        ...Array(
                                                            CRITICAL_LIMIT,
                                                        ),
                                                    ].map((_, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={`flex-1 h-full border-r border-white dark:border-slate-900 last:border-0 transition-all ${
                                                                idx <
                                                                criticalCount
                                                                    ? isSuspended
                                                                        ? 'bg-rose-500'
                                                                        : isCloseToSuspension
                                                                          ? 'bg-amber-500'
                                                                          : 'bg-indigo-500'
                                                                    : 'bg-slate-200 dark:bg-slate-700'
                                                            }`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                                            {ent.total_events || 0}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                                            {ent.last_event_at ? (
                                                <span>
                                                    {new Date(
                                                        ent.last_event_at,
                                                    ).toLocaleTimeString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        second: '2-digit',
                                                    })}
                                                    <br />
                                                    {new Date(
                                                        ent.last_event_at,
                                                    ).toLocaleDateString()}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-700">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            {/* Pagination footer */}
            {totalEntities > 0 && (
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        Showing{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {(entitiesPage - 1) * entitiesLimit + 1}
                        </span>{' '}
                        to{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {Math.min(
                                entitiesPage * entitiesLimit,
                                totalEntities,
                            )}
                        </span>{' '}
                        of{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {totalEntities}
                        </span>{' '}
                        entities
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                            <button
                                onClick={() =>
                                    setEntitiesPage((p) => Math.max(p - 1, 1))
                                }
                                disabled={entitiesPage === 1}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 disabled:opacity-50 disabled:hover:bg-transparent transition-colors">
                                Previous
                            </button>
                            {[...Array(totalPages)].map((_, idx) => {
                                const pNum = idx + 1;
                                return (
                                    <button
                                        key={pNum}
                                        onClick={() => setEntitiesPage(pNum)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                            entitiesPage === pNum
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850'
                                        }`}>
                                        {pNum}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() =>
                                    setEntitiesPage((p) =>
                                        Math.min(p + 1, totalPages),
                                    )
                                }
                                disabled={entitiesPage === totalPages}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 disabled:opacity-50 disabled:hover:bg-transparent transition-colors">
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
