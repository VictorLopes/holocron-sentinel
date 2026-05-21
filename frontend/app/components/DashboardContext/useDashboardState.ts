'use client';

import { useState, useEffect, useRef } from 'react';
import { Entity, EventRecord, CRITICAL_LIMIT } from './DashboardContext';

export function useDashboardState(
    initialEntities: Entity[],
    initialEvents: EventRecord[],
    initialRanking: Entity[],
) {
    const [entities, setEntities] = useState<Entity[]>(initialEntities);
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

    const isFirstRender = useRef(true);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(entitySearch);
        }, 300);
        return () => {
            clearTimeout(handler);
        };
    }, [entitySearch]);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const fetchFilteredEntities = async () => {
            setIsRefreshing(true);
            try {
                let url = 'http://localhost:3002/entities?limit=100';
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
                }
            } catch (err) {
                console.error('Failed to fetch filtered entities:', err);
            } finally {
                setIsRefreshing(false);
            }
        };

        fetchFilteredEntities();
    }, [debouncedSearch, entityStatusFilter]);

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
            let entitiesUrl = 'http://localhost:3002/entities?limit=100';
            if (entitySearch) {
                entitiesUrl += `&search=${encodeURIComponent(entitySearch)}`;
            }
            if (entityStatusFilter !== 'all') {
                entitiesUrl += `&status=${entityStatusFilter}`;
            }

            const [entitiesRes, eventsRes, rankingRes] = await Promise.all([
                fetch(entitiesUrl),
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

            eventSource.onerror = (_) => {
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

    return {
        entities,
        setEntities,
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
    };
}
