import type { TaskView } from '@sahmati/contracts';
import type { TaskRow } from './workspace.types.js';
export const taskView = (row: TaskRow): TaskView => ({
  id: row.id,
  template: row.template,
  status: row.status,
  assignee: row.assignee,
  version: row.version,
  createdAt: row.created_at.toISOString(),
});
