'use client';

import React, {useState, useEffect, useMemo} from 'react';
import {
    Activity,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Plus,
    RefreshCw,
    Search,
    Database,
    Flame,
    PlusCircle,
    TrendingUp,
    AlertCircle,
} from 'lucide-react';

interface Entity {
    id: string;
    name: string;
    status: string;
    critical_events_count: number;
    created_at: string;
    updated_at: string;
    total_events: number;
    last_event_at: string | null;
}

interface EventRecord {
    id: string;
    entity_id: string;
    external_id: string;
    type: 'info' | 'warning' | 'critical';
    payload: Record<string, any>;
    created_at: string;
}

interface SentinelDashboardClientProps {
    initialEntities: Entity[];
    initialEvents: EventRecord[];
    initialRanking: Entity[];
}

export default function SentinelDashboardClient({
    initialEntities,
    initialEvents,
    initialRanking,
}: SentinelDashboardClientProps) {
    const [entities, setEntities] = useState<Entity[]>(initialEntities);
    const [events, setEvents] = useState<EventRecord[]>(initialEvents);
    const [ranking, setRanking] = useState<Entity[]>(initialRanking);

    const [streamStatus, setStreamStatus] = useState<
        'connected' | 'connecting' | 'disconnected'
    >('connecting');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [entitySearch, setEntitySearch] = useState('');
    const [entityStatusFilter, setEntityStatusFilter] = useState<
        'all' | 'active' | 'suspended'
    >('all');

    const [eventTypeFilter, setEventTypeFilter] = useState<
        'all' | 'info' | 'warning' | 'critical'
    >('all');

    const [showCreateEntity, setShowCreateEntity] = useState(false);
    const [newEntityName, setNewEntityName] = useState('');
    const [createEntityError, setCreateEntityError] = useState('');
    const [createEntitySuccess, setCreateEntitySuccess] = useState('');

    const [showCreateEvent, setShowCreateEvent] = useState(false);
    const [selectedEntityId, setSelectedEntityId] = useState('');
    const [eventExternalId, setEventExternalId] = useState('');
    const [eventType, setEventType] = useState<'info' | 'warning' | 'critical'>(
        'info',
    );
    const [eventPayload, setEventPayload] = useState(
        '{\n  "message": "Routine status check"\n}',
    );
    const [createEventError, setCreateEventError] = useState('');
    const [createEventSuccess, setCreateEventSuccess] = useState('');
    const [duplicateWarning, setDuplicateWarning] = useState(false);

    const CRITICAL_LIMIT = 3;

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
        return {total, active, suspended, criticalCount};
    }, [entities]);

    const fetchRanking = async () => {
        try {
            const res = await fetch('http://localhost:3002/entities/ranking');
            if (res.ok) {
                const rankingData = await res.json();
                setRanking(rankingData.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch ranking:', err);
        }
    };

    const handleRefreshAll = async () => {
        setIsRefreshing(true);
        try {
            const [entitiesRes, eventsRes, rankingRes] = await Promise.all([
                fetch('http://localhost:3002/entities?limit=100'),
                fetch('http://localhost:3002/events?limit=50'),
                fetch('http://localhost:3002/entities/ranking'),
            ]);

            if (entitiesRes.ok) {
                const entData = await entitiesRes.json();
                setEntities(entData.data || []);
            }
            if (eventsRes.ok) {
                const evData = await eventsRes.json();
                setEvents(evData.data || []);
            }
            if (rankingRes.ok) {
                const rankData = await rankingRes.json();
                setRanking(rankData.data || []);
            }
        } catch (err) {
            console.error('Failed to refresh data:', err);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        let eventSource: EventSource;

        const connectStream = () => {
            setStreamStatus('connecting');
            eventSource = new EventSource(
                'http://localhost:3002/events/stream',
            );

            eventSource.onopen = () => {
                setStreamStatus('connected');
            };

            eventSource.onerror = (e) => {
                console.error('SSE connection error', e);
                setStreamStatus('disconnected');
                eventSource.close();
                setTimeout(connectStream, 5000);
            };

            eventSource.onmessage = (event) => {
                try {
                    const newEvent = JSON.parse(event.data) as EventRecord;

                    setEvents((prev) => [newEvent, ...prev].slice(0, 100));

                    setEntities((prevEntities) => {
                        return prevEntities.map((ent) => {
                            if (String(ent.id) === String(newEvent.entity_id)) {
                                const isCritical = newEvent.type === 'critical';
                                const updatedCriticalCount = isCritical
                                    ? ent.critical_events_count + 1
                                    : ent.critical_events_count;

                                const updatedStatus =
                                    updatedCriticalCount >= CRITICAL_LIMIT
                                        ? 'suspended'
                                        : ent.status;

                                return {
                                    ...ent,
                                    critical_events_count: updatedCriticalCount,
                                    status: updatedStatus,
                                    total_events:
                                        Number(ent.total_events || 0) + 1,
                                    last_event_at: newEvent.created_at,
                                };
                            }
                            return ent;
                        });
                    });

                    if (newEvent.type === 'critical') {
                        fetchRanking();
                    }
                } catch (err) {
                    console.error('Error handling incoming SSE event:', err);
                }
            };
        };

        connectStream();

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, []);

    const filteredEntities = useMemo(() => {
        return entities.filter((ent) => {
            const matchesSearch = ent.name
                .toLowerCase()
                .includes(entitySearch.toLowerCase());
            const matchesStatus =
                entityStatusFilter === 'all' ||
                ent.status === entityStatusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [entities, entitySearch, entityStatusFilter]);

    const filteredEvents = useMemo(() => {
        return events.filter((ev) => {
            return eventTypeFilter === 'all' || ev.type === eventTypeFilter;
        });
    }, [events, eventTypeFilter]);

    const handleGenerateUUID = () => {
        const uuid = crypto.randomUUID();
        setEventExternalId(uuid);
    };
    const handleCreateEntity = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateEntityError('');
        setCreateEntitySuccess('');

        if (!newEntityName.trim()) {
            setCreateEntityError('Entity name cannot be empty');
            return;
        }

        try {
            const res = await fetch('http://localhost:3002/entities', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name: newEntityName}),
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
            setNewEntityName('');
            setCreateEntitySuccess('Entity created successfully!');
            setTimeout(() => {
                setShowCreateEntity(false);
                setCreateEntitySuccess('');
            }, 1500);

            setSelectedEntityId(createdEntity.id.toString());
        } catch (err: any) {
            setCreateEntityError(
                err.message || 'An error occurred while creating entity',
            );
        }
    };

    const handleRegisterEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateEventError('');
        setCreateEventSuccess('');
        setDuplicateWarning(false);

        if (!selectedEntityId) {
            setCreateEventError('Please select a monitored entity');
            return;
        }
        if (!eventExternalId.trim()) {
            setCreateEventError(
                'Please provide an external ID (idempotency key)',
            );
            return;
        }

        let parsedPayload;
        try {
            parsedPayload = JSON.parse(eventPayload);
        } catch (err) {
            setCreateEventError('Invalid JSON payload structure');
            return;
        }

        try {
            const res = await fetch('http://localhost:3002/events', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    entity_id: selectedEntityId,
                    external_id: eventExternalId,
                    type: eventType,
                    payload: parsedPayload,
                }),
            });

            if (!res.ok) {
                throw new Error(
                    (await res.text()) || 'Failed to register event',
                );
            }

            const result = await res.json();

            if (result.is_duplicate) {
                setDuplicateWarning(true);
                setCreateEventSuccess(
                    'Duplicate event detected. Ignored (Idempotency active).',
                );
            } else {
                setCreateEventSuccess('Event registered successfully!');
                setEventExternalId('');
            }

            setTimeout(() => {
                setCreateEventSuccess('');
                setDuplicateWarning(false);
            }, 4000);
        } catch (err: any) {
            setCreateEventError(
                err.message || 'An error occurred while registering event',
            );
        }
    };

    return (
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

                    <div className="flex items-center gap-3">
                        <div
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                                streamStatus === 'connected'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50'
                                    : streamStatus === 'connecting'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50'
                                      : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/50'
                            }`}>
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
                            className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
                            <RefreshCw
                                className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                            />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                                Monitored Entities
                            </p>
                            <h3 className="text-2xl font-bold mt-1">
                                {stats.total}
                            </h3>
                        </div>
                        <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
                            <Database className="h-6 w-6" />
                        </div>
                    </div>

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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div>
                                        <h2 className="text-lg font-semibold">
                                            Strategic Monitored Entities
                                        </h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Planets, bases and ships monitored
                                            in real-time
                                        </p>
                                    </div>
                                    <button
                                        onClick={() =>
                                            setShowCreateEntity(
                                                !showCreateEntity,
                                            )
                                        }
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
                                                placeholder="e.g. Production Database, API Gateway"
                                                value={newEntityName}
                                                onChange={(e) =>
                                                    setNewEntityName(
                                                        e.target.value,
                                                    )
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
                                            onChange={(e) =>
                                                setEntitySearch(e.target.value)
                                            }
                                            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-905 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>

                                    <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-905">
                                        <button
                                            onClick={() =>
                                                setEntityStatusFilter('all')
                                            }
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                                entityStatusFilter === 'all'
                                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                                            }`}>
                                            All
                                        </button>
                                        <button
                                            onClick={() =>
                                                setEntityStatusFilter('active')
                                            }
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                                entityStatusFilter === 'active'
                                                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                                            }`}>
                                            Active
                                        </button>
                                        <button
                                            onClick={() =>
                                                setEntityStatusFilter(
                                                    'suspended',
                                                )
                                            }
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                                entityStatusFilter ===
                                                'suspended'
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
                                            No monitored entities found matching
                                            filters.
                                        </p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase border-b border-slate-200 dark:border-slate-800">
                                                <th className="px-6 py-4">
                                                    Entity Details
                                                </th>
                                                <th className="px-6 py-4">
                                                    Status
                                                </th>
                                                <th className="px-6 py-4">
                                                    Threat Level (Critical
                                                    Events)
                                                </th>
                                                <th className="px-6 py-4">
                                                    Total Events
                                                </th>
                                                <th className="px-6 py-4">
                                                    Last Activity
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                            {filteredEntities.map((ent) => {
                                                const criticalCount =
                                                    ent.critical_events_count ||
                                                    0;
                                                const isCloseToSuspension =
                                                    criticalCount ===
                                                    CRITICAL_LIMIT - 1;
                                                const isSuspended =
                                                    ent.status === 'suspended';

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
                                                                        {
                                                                            criticalCount
                                                                        }{' '}
                                                                        /{' '}
                                                                        {
                                                                            CRITICAL_LIMIT
                                                                        }
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
                                                                <div className="w-full bg-slate-150 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
                                                                    {[
                                                                        ...Array(
                                                                            CRITICAL_LIMIT,
                                                                        ),
                                                                    ].map(
                                                                        (
                                                                            _,
                                                                            idx,
                                                                        ) => (
                                                                            <div
                                                                                key={
                                                                                    idx
                                                                                }
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
                                                                        ),
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                                                            {ent.total_events ||
                                                                0}
                                                        </td>
                                                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                                                            {ent.last_event_at ? (
                                                                <span>
                                                                    {new Date(
                                                                        ent.last_event_at,
                                                                    ).toLocaleTimeString(
                                                                        [],
                                                                        {
                                                                            hour: '2-digit',
                                                                            minute: '2-digit',
                                                                            second: '2-digit',
                                                                        },
                                                                    )}
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
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
                            <div className="flex items-center gap-2.5">
                                <TrendingUp className="h-5 w-5 text-indigo-500" />
                                <h3 className="text-lg font-semibold">
                                    Critical Threat Ranking (Last 7 Days)
                                </h3>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Entities ordered by total critical events
                                generated over the last 7 days.
                            </p>

                            {ranking.length === 0 ? (
                                <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/30 rounded-lg text-slate-400 border border-dashed border-slate-200 dark:border-slate-800">
                                    No critical activities recorded in the last
                                    7 days.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {ranking.map((ent, index) => (
                                        <div
                                            key={ent.id}
                                            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-lg relative overflow-hidden">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 text-sm font-extrabold border border-rose-100 dark:border-rose-900/30">
                                                    #{index + 1}
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-sm text-slate-950 dark:text-slate-50 block">
                                                        {ent.name}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        Total critical events:{' '}
                                                        {
                                                            ent.critical_events_count
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span
                                                    className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded ${
                                                        ent.status ===
                                                        'suspended'
                                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                                    }`}>
                                                    {ent.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Event Logger & Event Injection Form */}
                    <div className="space-y-8">
                        {/* Manual Event Injection Form */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <PlusCircle className="h-5 w-5 text-indigo-500" />
                                <h3 className="text-lg font-semibold">
                                    Register Manual Event
                                </h3>
                            </div>

                            <form
                                onSubmit={handleRegisterEvent}
                                className="space-y-4">
                                {/* Target Entity Selector */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                        Target Monitored Entity
                                    </label>
                                    <select
                                        value={selectedEntityId}
                                        onChange={(e) =>
                                            setSelectedEntityId(e.target.value)
                                        }
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                        <option value="">
                                            Select an entity...
                                        </option>
                                        {entities.map((e) => (
                                            <option key={e.id} value={e.id}>
                                                {e.name}{' '}
                                                {e.status === 'suspended'
                                                    ? '(Suspended)'
                                                    : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                            External ID (Idempotency Key)
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleGenerateUUID}
                                            className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">
                                            Generate UUID
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="e.g. evt_948a3f81"
                                        value={eventExternalId}
                                        onChange={(e) =>
                                            setEventExternalId(e.target.value)
                                        }
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                        Event Severity Type
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setEventType('info')}
                                            className={`px-3 py-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                                                eventType === 'info'
                                                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                                                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}>
                                            Info
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEventType('warning')
                                            }
                                            className={`px-3 py-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                                                eventType === 'warning'
                                                    ? 'bg-amber-500 text-white border-amber-500'
                                                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}>
                                            Warning
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEventType('critical')
                                            }
                                            className={`px-3 py-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                                                eventType === 'critical'
                                                    ? 'bg-rose-600 text-white border-rose-600'
                                                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}>
                                            Critical
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                        Payload (JSON structure)
                                    </label>
                                    <textarea
                                        rows={4}
                                        value={eventPayload}
                                        onChange={(e) =>
                                            setEventPayload(e.target.value)
                                        }
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                {createEventError && (
                                    <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs flex items-start gap-2 border border-rose-100 dark:border-rose-900/30">
                                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                        <span>{createEventError}</span>
                                    </div>
                                )}

                                {createEventSuccess && (
                                    <div
                                        className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
                                            duplicateWarning
                                                ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30'
                                                : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
                                        }`}>
                                        {duplicateWarning ? (
                                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                                        ) : (
                                            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                                        )}
                                        <span className="font-medium">
                                            {createEventSuccess}
                                        </span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors">
                                    Register Event
                                </button>
                            </form>
                        </div>

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

                                <div className="flex rounded-md border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-905 w-full">
                                    {(
                                        [
                                            'all',
                                            'info',
                                            'warning',
                                            'critical',
                                        ] as const
                                    ).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() =>
                                                setEventTypeFilter(type)
                                            }
                                            className={`flex-1 text-center py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                                                eventTypeFilter === type
                                                    ? type === 'critical'
                                                        ? 'bg-rose-600 text-white shadow-sm'
                                                        : type === 'warning'
                                                          ? 'bg-amber-500 text-white shadow-sm'
                                                          : type === 'info'
                                                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                                                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                            }`}>
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto pt-4 space-y-3 pr-1">
                                {filteredEvents.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-12">
                                        <Activity className="h-6 w-6 mb-2 text-slate-350" />
                                        <p className="text-xs">
                                            No events registered yet.
                                        </p>
                                    </div>
                                ) : (
                                    filteredEvents.map((ev) => {
                                        const targetEntity = entities.find(
                                            (ent) =>
                                                String(ent.id) ===
                                                String(ev.entity_id),
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
                                                }`}>
                                                <div className="flex items-center justify-between">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                            ev.type ===
                                                            'critical'
                                                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                                                                : ev.type ===
                                                                    'warning'
                                                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                                                                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                                                        }`}>
                                                        {ev.type}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {new Date(
                                                            ev.created_at,
                                                        ).toLocaleTimeString(
                                                            [],
                                                            {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                                second: '2-digit',
                                                            },
                                                        )}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-slate-400">
                                                        Target:{' '}
                                                    </span>
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                        {entityName}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] font-mono text-slate-450 dark:text-slate-500">
                                                    External ID:{' '}
                                                    {ev.external_id}
                                                </div>

                                                {ev.payload &&
                                                    Object.keys(ev.payload)
                                                        .length > 0 && (
                                                        <div className="p-2 bg-slate-50 dark:bg-slate-900/60 rounded border border-slate-150 dark:border-slate-800/80 font-mono text-[10px] text-slate-650 dark:text-slate-400 overflow-x-auto max-h-[80px]">
                                                            {JSON.stringify(
                                                                ev.payload,
                                                                null,
                                                                2,
                                                            )}
                                                        </div>
                                                    )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="border-t border-slate-200 dark:border-slate-800 py-6 mt-12 bg-white dark:bg-slate-900 text-center text-xs text-slate-400">
                <p>© 2026 Holocron Sentinel. All rights reserved.</p>
            </footer>
        </div>
    );
}
