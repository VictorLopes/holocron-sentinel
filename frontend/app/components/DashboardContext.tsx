'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Entity {
    id: string;
    name: string;
    status: string;
    critical_events_count: number;
    created_at: string;
    updated_at: string;
    total_events: number;
    last_event_at: string | null;
}

export interface EventRecord {
    id: string;
    entity_id: string;
    external_id: string;
    type: 'info' | 'warning' | 'critical';
    payload: Record<string, any>;
    created_at: string;
}

export const CRITICAL_LIMIT = 3;

interface DashboardContextType {
    entities: Entity[];
    setEntities: React.Dispatch<React.SetStateAction<Entity[]>>;
    events: EventRecord[];
    setEvents: React.Dispatch<React.SetStateAction<EventRecord[]>>;
    ranking: Entity[];
    setRanking: React.Dispatch<React.SetStateAction<Entity[]>>;
    streamStatus: 'connected' | 'connecting' | 'disconnected';
    isRefreshing: boolean;
    handleRefreshAll: () => Promise<void>;
    selectedEntityId: string;
    setSelectedEntityId: (id: string) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function useDashboard() {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error('useDashboard must be used within a DashboardProvider');
    }
    return context;
}

interface DashboardProviderProps {
    initialEntities: Entity[];
    initialEvents: EventRecord[];
    initialRanking: Entity[];
    children: React.ReactNode;
}

export function DashboardProvider({
    initialEntities,
    initialEvents,
    initialRanking,
    children,
}: DashboardProviderProps) {
    const [entities, setEntities] = useState<Entity[]>(initialEntities);
    const [events, setEvents] = useState<EventRecord[]>(initialEvents);
    const [ranking, setRanking] = useState<Entity[]>(initialRanking);

    const [streamStatus, setStreamStatus] = useState<
        'connected' | 'connecting' | 'disconnected'
    >('connecting');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedEntityId, setSelectedEntityId] = useState('');

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

    return (
        <DashboardContext.Provider
            value={{
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
            }}
        >
            {children}
        </DashboardContext.Provider>
    );
}
