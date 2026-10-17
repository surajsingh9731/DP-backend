export interface TaskRow {
  id: string;
  template: 'review_inventory';
  status: 'open' | 'closed';
  assignee_id: string;
  assignee: string;
  version: number;
  created_at: Date;
}
