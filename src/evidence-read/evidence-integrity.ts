import type {
  EvidenceDetail,
  FollowupEvent,
  RightsEvent,
  CheckEvaluation,
} from '@sahmati/contracts';
import { followupDigest } from '../followups/followup-locations.js';
export function eventIntegrity(
  event: FollowupEvent | RightsEvent,
  previous: FollowupEvent | RightsEvent | undefined,
): EvidenceDetail['integrity'] {
  const { eventHash, ...content } = event;
  return {
    digest: followupDigest(content) === eventHash ? 'match' : 'mismatch',
    previous:
      event.version === 1
        ? event.previousHash === null
          ? 'not_applicable'
          : 'mismatch'
        : !previous
          ? 'unavailable'
          : previous.version === event.version - 1 && event.previousHash === previous.eventHash
            ? 'linked'
            : 'mismatch',
    scope: 'single-event-and-previous-reference',
  };
}
export function evaluationIntegrity(evaluation: CheckEvaluation): EvidenceDetail['integrity'] {
  const { contentHash, ...content } = evaluation;
  return {
    digest: followupDigest(content) === contentHash ? 'match' : 'mismatch',
    previous: 'not_applicable',
    scope: 'single-snapshot',
  };
}
