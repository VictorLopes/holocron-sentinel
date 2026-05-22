'use client';

import { useState, useEffect } from 'react';
import {
    Entity,
    EventRecord,
} from '../components/DashboardContext/DashboardContext';
import { CRITICAL_LIMIT, API_BASE_URL } from '../config';

export function useDashboard(
    initialEntities: Entity[],
    initialEvents: EventRecord[],
    initialRanking: Entity[],
) {
    const [entities, setEntities] = useState<Entity[]>(initialEntities);
    const [allEntities, setAllEntities] = useState<Entity[]>(initialEntities);
    const [events, setEvents] = useState<EventRecord[]>(initialEvents);
    const [ranking, setRanking] = useState<Entity[]>(initialRanking);

    const [streamStatus, setStreamStatus] = useState<
        'connected' | 'connecting' | 'disconnected'
    >('connecting');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedEntityId, setSelectedEntityId] = useState('');

    const [entitySearch, setEntitySearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [entityStatusFilter, setEntityStatusFilter] = useState<
        'all' | 'active' | 'suspended'
    >('all');

    const [entitiesPage, setEntitiesPage] = useState(1);
    const [entitiesLimit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalEntities, setTotalEntities] = useState(0);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(entitySearch);
            setEntitiesPage(1);
        }, 300);
        return () => {
            clearTimeout(handler);
        };
    }, [entitySearch]);

    useEffect(() => {
        setEntitiesPage(1);
    }, [entityStatusFilter]);

    useEffect(() => {
        const fetchFilteredEntities = async () => {
            setIsRefreshing(true);
            try {
                let url = `${API_BASE_URL}/entities?page=${entitiesPage}&limit=${entitiesLimit}`;
                if (debouncedSearch) {
                    url += `&search=${encodeURIComponent(debouncedSearch)}`;
                }
                if (entityStatusFilter !== 'all') {
                    url += `&status=${entityStatusFilter}`;
                }
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setEntities(data.data || []);
                    if (data.meta) {
                        setTotalPages(data.meta.totalPages || 1);
                        setTotalEntities(data.meta.total || 0);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch filtered entities:', err);
            } finally {
                setIsRefreshing(false);
            }
        };

        fetchFilteredEntities();
    }, [entitiesPage, entitiesLimit, debouncedSearch, entityStatusFilter]);

    useEffect(() => {
        const fetchAllEntities = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/entities?limit=100`);
                if (res.ok) {
                    const data = await res.json();
                    setAllEntities(data.data || []);
                }
            } catch (err) {
                console.error('Failed to fetch all entities:', err);
            }
        };
        fetchAllEntities();
    }, []);

    const fetchRanking = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/entities/ranking`);
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
            let entitiesUrl = `${API_BASE_URL}/entities?page=${entitiesPage}&limit=${entitiesLimit}`;
            if (entitySearch) {
                entitiesUrl += `&search=${encodeURIComponent(entitySearch)}`;
            }
            if (entityStatusFilter !== 'all') {
                entitiesUrl += `&status=${entityStatusFilter}`;
            }

            const [entitiesRes, allEntitiesRes, eventsRes, rankingRes] =
                await Promise.all([
                    fetch(entitiesUrl),
                    fetch(`${API_BASE_URL}/entities?limit=100`),
                    fetch(`${API_BASE_URL}/events?limit=50`),
                    fetch(`${API_BASE_URL}/entities/ranking`),
                ]);

            if (entitiesRes.ok) {
                const entData = await entitiesRes.json();
                setEntities(entData.data || []);
                if (entData.meta) {
                    setTotalPages(entData.meta.totalPages || 1);
                    setTotalEntities(entData.meta.total || 0);
                }
            }
            if (allEntitiesRes.ok) {
                const allEntData = await allEntitiesRes.json();
                setAllEntities(allEntData.data || []);
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
            eventSource = new EventSource(`${API_BASE_URL}/events/stream`);

            eventSource.onopen = () => {
                setStreamStatus('connected');
            };

            eventSource.onerror = (_) => {
                setStreamStatus('disconnected');
                eventSource.close();
                setTimeout(connectStream, 5000);
            };

            eventSource.onmessage = (event) => {
                try {
                    const newEvent = JSON.parse(event.data) as EventRecord;

                    setEvents((prev) => [newEvent, ...prev].slice(0, 100));

                    const updateEntityFn = (entity: Entity) => {
                        if (String(entity.id) === String(newEvent.entity_id)) {
                            const isCritical = newEvent.type === 'critical';
                            const updatedCriticalCount = isCritical
                                ? entity.critical_events_count + 1
                                : entity.critical_events_count;

                            const updatedStatus =
                                updatedCriticalCount >= CRITICAL_LIMIT
                                    ? 'suspended'
                                    : entity.status;

                            return {
                                ...entity,
                                critical_events_count: updatedCriticalCount,
                                status: updatedStatus,
                                total_events:
                                    Number(entity.total_events || 0) + 1,
                                last_event_at: newEvent.created_at,
                            };
                        }
                        return entity;
                    };

                    setEntities((prev) => prev.map(updateEntityFn));
                    setAllEntities((prev) => prev.map(updateEntityFn));

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

    return {
        entities,
        setEntities,
        allEntities,
        setAllEntities,
        events,
        setEvents,
        ranking,
        setRanking,
        streamStatus,
        isRefreshing,
        handleRefreshAll,
        selectedEntityId,
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
    };
}
