'use client';

import React, { createContext, useContext } from 'react';
import { useDashboard } from '../../hooks/useDashboard';
import { CRITICAL_LIMIT, API_BASE_URL } from '../../config';

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

interface DashboardContextType {
    entities: Entity[];
    setEntities: React.Dispatch<React.SetStateAction<Entity[]>>;
    allEntities: Entity[];
    setAllEntities: React.Dispatch<React.SetStateAction<Entity[]>>;
    events: EventRecord[];
    setEvents: React.Dispatch<React.SetStateAction<EventRecord[]>>;
    ranking: Entity[];
    setRanking: React.Dispatch<React.SetStateAction<Entity[]>>;
    streamStatus: 'connected' | 'connecting' | 'disconnected';
    isRefreshing: boolean;
    handleRefreshAll: () => Promise<void>;
    selectedEntityId: string;
    setSelectedEntityId: (id: string) => void;
    entitySearch: string;
    setEntitySearch: (search: string) => void;
    entityStatusFilter: 'all' | 'active' | 'suspended';
    setEntityStatusFilter: (status: 'all' | 'active' | 'suspended') => void;
    entitiesPage: number;
    setEntitiesPage: React.Dispatch<React.SetStateAction<number>>;
    totalPages: number;
    totalEntities: number;
    entitiesLimit: number;
}

const DashboardContext = createContext<DashboardContextType | undefined>(
    undefined,
);

export function useDashboardContext() {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error(
            'useDashboardContext must be used within a DashboardProvider',
        );
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
    const value = useDashboard(initialEntities, initialEvents, initialRanking);

    return (
        <DashboardContext.Provider value={value}>
            {children}
        </DashboardContext.Provider>
    );
}
