'use client';

import React, {useState} from 'react';
import {
    PlusCircle,
    AlertTriangle,
    AlertCircle,
    CheckCircle,
} from 'lucide-react';
import {useDashboard} from './DashboardContext';

export default function RegisterEventForm() {
    const {entities, selectedEntityId, setSelectedEntityId} = useDashboard();

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

    const handleGenerateUUID = () => {
        const uuid = crypto.randomUUID();
        setEventExternalId(uuid);
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
            setCreateEventError('Please provide an external ID');
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
                setCreateEventSuccess('Duplicate event detected. Ignored.');
            } else {
                setCreateEventSuccess('Event registered successfully!');
                setEventExternalId('');
            }

            setTimeout(() => {
                setCreateEventSuccess('');
                setDuplicateWarning(false);
            }, 4000);
        } catch (err) {
            setCreateEventError(
                err instanceof Error
                    ? err.message
                    : 'An error occurred while registering event',
            );
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-indigo-500" />
                <h3 className="text-lg font-semibold">Register Manual Event</h3>
            </div>

            <form onSubmit={handleRegisterEvent} className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Target Monitored Entity
                    </label>
                    <select
                        value={selectedEntityId}
                        onChange={(e) => setSelectedEntityId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select an entity...</option>
                        {entities.map((e) => (
                            <option key={e.id} value={e.id}>
                                {e.name}{' '}
                                {e.status === 'suspended' ? '(Suspended)' : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            External ID
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
                        onChange={(e) => setEventExternalId(e.target.value)}
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
                            onClick={() => setEventType('warning')}
                            className={`px-3 py-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                                eventType === 'warning'
                                    ? 'bg-amber-500 text-white border-amber-500'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}>
                            Warning
                        </button>
                        <button
                            type="button"
                            onClick={() => setEventType('critical')}
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
                        onChange={(e) => setEventPayload(e.target.value)}
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
    );
}
