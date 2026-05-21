'use client';

import React, { createContext, useContext } from 'react';
import { useDashboardState } from './useDashboardState';

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

export const CRITICAL_LIMIT = Number(process.env.NEXT_PUBLIC_CRITICAL_LIMIT) || 3;

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
    const value = useDashboardState(initialEntities, initialEvents, initialRanking);

    return (
        <DashboardContext.Provider value={value}>
            {children}
        </DashboardContext.Provider>
    );
}
