import { Injectable, NotFoundException } from '@nestjs/common';
import type { EvidenceKind } from '@sahmati/contracts';
import type { EvidenceSource } from '../evidence-read/evidence-source.js';
import { NoticeEvidenceSource } from '../notices/notice-evidence.source.js';
import { NoticeDecisionEvidenceSource } from '../notices/notice-decision-evidence.source.js';
import { ConsentEvidenceSource } from '../consent-sandbox/consent-evidence.source.js';
import { WithdrawalEvidenceSource } from '../consent-sandbox/withdrawal-evidence.source.js';
import { FollowupEvidenceSource } from '../followups/followup-evidence.source.js';
import { CheckReviewEvidenceSource } from '../checks/check-review-evidence.source.js';
import { CheckEvaluationEvidenceSource } from '../checks/check-evaluation-evidence.source.js';
import { RightsEvidenceSource } from '../rights/rights-evidence.source.js';
@Injectable()
export class EvidenceSources {
  readonly all: EvidenceSource[];
  constructor(
    p0: NoticeEvidenceSource,
    p1: NoticeDecisionEvidenceSource,
    p2: ConsentEvidenceSource,
    p3: WithdrawalEvidenceSource,
    p4: FollowupEvidenceSource,
    p5: CheckReviewEvidenceSource,
    p6: CheckEvaluationEvidenceSource,
    p7: RightsEvidenceSource,
  ) {
    this.all = [p0, p1, p2, p3, p4, p5, p6, p7];
  }
  get(kind: EvidenceKind): EvidenceSource {
    const source = this.all.find((s) => s.kind === kind);
    if (!source) throw new NotFoundException('Evidence unavailable in this scope.');
    return source;
  }
}
