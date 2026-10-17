import type {
  ParticipantRightsRequest,
  RightsRequest,
  RightsEvent,
  RightsProgress,
  RightsSummary,
} from '@sahmati/contracts';
export function rightsProgress(request: RightsRequest): RightsProgress {
  const count = (status: string) =>
    request.workItems.filter((item) => item.status === status).length;
  return {
    pending: count('pending'),
    declared: count('completion_declared'),
    reviewed: count('independently_reviewed'),
    unknown: count('unknown'),
    blocked: count('blocked'),
    retained: count('retention_exception_declared'),
  };
}
export function publicRights(
  request: RightsRequest,
  history: RightsEvent[] = [],
): ParticipantRightsRequest {
  const { noticeId, entryVersion, noticeLanguage, noticeTitle } = request.source;
  return {
    id: request.id,
    kind: request.kind,
    inputLanguage: request.inputLanguage,
    details: request.details,
    ...(request.correction
      ? {
          correction: {
            fieldReference: request.correction.fieldReference,
            requestedValue: request.correction.requestedValue,
          },
        }
      : {}),
    source: { noticeId, entryVersion, noticeLanguage, noticeTitle },
    status: request.status,
    version: request.version,
    responses: request.responses.map((row) => ({
      id: row.id,
      at: row.at,
      language: row.language,
      text: row.text,
      resolution: row.resolution,
      unresolvedCount: row.unresolvedCount,
      requestVersion: row.requestVersion,
    })),
    progress: rightsProgress(request),
    history: history.map((event) => ({
      status: event.request.status,
      at: event.at,
      version: event.version,
    })),
    submittedAt: request.submittedAt,
    mode: 'local-sample',
    assurance: 'unverified-synthetic-adult',
  };
}
export function rightsSummary(request: RightsRequest): RightsSummary {
  return {
    id: request.id,
    kind: request.kind,
    status: request.status,
    version: request.version,
    syntheticReference: request.syntheticReference,
    assignee: request.assignee,
    submittedAt: request.submittedAt,
  };
}
