export interface Entity {
  id: string;
  name: string;
  status: string;
  critical_events_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
