export interface EventRecord {
  id: string;
  entity_id: string;
  external_id: string;
  type: string;
  payload: Record<string, any>;
  created_at: Date;
}

export interface LightweightEventRecord {
  id: string;
  entity_id: string;
  external_id: string;
}

export interface EntityRow {
  id: string | number;
  status: string;
  critical_events_count: string | number;
  updated_at?: Date;
}

export interface DbEventRow {
  id: string | number;
  entity_id: string | number;
  external_id: string;
  type: string;
  payload: string | Record<string, any>;
  created_at: Date;
}
