import type { LocalMessage } from './channel.js';
export interface Claimed extends LocalMessage {
  lease: string;
  tenantId: string | null;
  attempts: number;
}
export interface PendingMessage extends LocalMessage {
  attempts: number;
}
