import { BadRequestException } from '@nestjs/common';
import type {
  RetentionInputs,
  RetentionCandidate,
  RetentionReason,
  RetentionOutcome,
} from '@sahmati/contracts';
import { followupDigest } from '../followups/followup-locations.js';
import { RETENTION_DAY_MS } from '../constants/retention.constants.js';
export function retentionInstant(value: string): string {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!match)
    throw new BadRequestException('Use a complete ISO instant with an explicit timezone offset.');
  const year = Number(match[1]),
    month = Number(match[2]),
    day = Number(match[3]),
    hour = Number(match[4]),
    minute = Number(match[5]),
    second = Number(match[6]);
  const days = new Date(Date.UTC(year === 0 ? 2000 : year, month, 0)).getUTCDate();
  const offset = match[8]!;
  const validOffset =
    offset === 'Z' ||
    (Number(offset.slice(1, 3)) <= 14 &&
      Number(offset.slice(4, 6)) < 60 &&
      (Number(offset.slice(1, 3)) !== 14 || Number(offset.slice(4, 6)) === 0));
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    !validOffset ||
    !Number.isFinite(Date.parse(value))
  )
    throw new BadRequestException('Scenario date/time is invalid.');
  const date = new Date(value);
  if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999)
    throw new BadRequestException('Scenario instant outside supported range.');
  return date.toISOString();
}
export function retentionCandidates(inputs: RetentionInputs, asOf: string): RetentionCandidate[] {
  const instant = Date.parse(retentionInstant(asOf)),
    activePolicies = inputs.policies.filter((p) => p.status !== 'retired'),
    reviewed = activePolicies.filter((p) => p.status === 'internally_reviewed');
  const sources = inputs.receipts.length
    ? inputs.receipts
    : [{ receipt: null, sampleRecordId: null, locations: inputs.entry.locations }];
  return sources
    .flatMap((source) =>
      source.locations.map((location) => {
        const receipt = source.receipt,
          recordId = source.sampleRecordId ?? null,
          reasons: RetentionReason[] = [];
        const holds = inputs.holds.filter(
          (hold) =>
            hold.status === 'active' &&
            (hold.scope === 'activity' ||
              (hold.scope === 'sample_record' && hold.target === recordId) ||
              (hold.scope === 'location' && hold.target === location.key)),
        );
        if (holds.length) reasons.push('active_hold');
        if (reviewed.length !== activePolicies.length || !reviewed.length)
          reasons.push('policy_unreviewed');
        if (reviewed.length > 1) reasons.push('policy_conflict');
        if (
          activePolicies.some((p) => p.entryVersion !== inputs.entry.version) ||
          (receipt && receipt.notice.entryVersion !== inputs.entry.version)
        )
          reasons.push('source_version_changed');
        if (location.mapping === 'unknown') reasons.push('unknown_coverage');
        let referenceAt: string | null = null;
        try {
          if (receipt) referenceAt = retentionInstant(receipt.occurredAt);
        } catch {
          referenceAt = null;
        }
        if (!referenceAt) reasons.push('missing_reference_time');
        const rights = inputs.rights.filter((row) => row.sessionId === recordId);
        if (rights.some((row) => row.status !== 'closed' || row.unresolvedCount > 0))
          reasons.push('rights_review');
        if (receipt?.kind === 'choices_withdrawn') reasons.push('withdrawal_review');
        const tasks = inputs.followups.filter((task) => task.sessionId === recordId);
        if (tasks.some((task) => task.status !== 'independently_reviewed'))
          reasons.push('followup_review');
        if (tasks.some((task) => task.status === 'retention_exception_declared'))
          reasons.push('retention_exception_review');
        let dueAt: string | null = null;
        if (referenceAt && reviewed.length === 1) {
          const value = new Date(
            Date.parse(referenceAt) + reviewed[0]!.durationDays * RETENTION_DAY_MS,
          );
          if (value.getUTCFullYear() <= 9999) dueAt = value.toISOString();
          else if (!reasons.includes('missing_reference_time'))
            reasons.push('missing_reference_time');
        }
        const conflict = reasons.some((reason) =>
          [
            'policy_conflict',
            'rights_review',
            'withdrawal_review',
            'followup_review',
            'retention_exception_review',
          ].includes(reason),
        );
        const outcome: RetentionOutcome = holds.length
          ? 'held'
          : conflict
            ? 'conflict'
            : reasons.length
              ? 'unknown'
              : dueAt && Date.parse(dueAt) > instant
                ? 'not_due'
                : dueAt
                  ? 'candidate_review'
                  : 'unknown';
        return {
          key: followupDigest({ recordId, receiptId: receipt?.id ?? null, location: location.key }),
          sampleRecordId: recordId,
          receiptId: receipt?.id ?? null,
          noticeId: receipt?.notice.id ?? null,
          location,
          referenceAt,
          dueAt,
          outcome,
          reasons: [...new Set(reasons)].sort(),
          holdIds: holds.map((h) => h.id).sort(),
        };
      }),
    )
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
