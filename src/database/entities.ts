import { OrganisationEntity } from "../auth/entities/organisation.entity";
import { BranchEntity } from "../auth/entities/branch.entity";
import { UserEntity } from "../auth/entities/user.entity";
import { MembershipEntity } from "../auth/entities/membership.entity";
import { AuthChallengeEntity } from "../auth/entities/auth-challenge.entity";
import { SessionEntity } from "../auth/entities/session.entity";
import { ActivityLogEntity } from "../auth/entities/activity-log.entity";
import { EvidenceLedgerEntryEntity } from "../common/entities/evidence-ledger-entry.entity";
import { IdempotencyKeyEntity } from "../common/entities/idempotency-key.entity";
import { RegisterEntryEntity } from "../register/entities/register-entry.entity";
import { RegisterRevisionEntity } from "../register/entities/register-revision.entity";
import { NoticeEntity } from "../notices/entities/notice.entity";
import { NoticeVersionEntity } from "../notices/entities/notice-version.entity";
import { PublicVerificationSessionEntity } from "../participants/entities/public-verification-session.entity";
import { ConsentReceiptEntity } from "../consent/entities/consent-receipt.entity";
import { WithdrawalFollowupEntity } from "../consent/entities/withdrawal-followup.entity";
import { RightsRequestEntity } from "../rights/entities/rights-request.entity";
import { BreachIncidentEntity } from "../breach/entities/breach-incident.entity";

/**
 * Every TypeORM entity in the app, explicitly. Deliberately not a glob
 * string: TypeORM's own glob-based entity loader does a raw `require()`
 * on each matched file, bypassing whatever transform pipeline loaded the
 * rest of the process (ts-node/tsx in dev, vitest in tests) — harmless
 * against compiled `dist/*.entity.js`, but it means Node's own
 * (decorator-unaware) native TypeScript stripping chokes on
 * `.entity.ts` decorator syntax when tests run straight from source. An
 * explicit array only ever uses normal `import`, so it's loaded through
 * whatever transform is already active. Add a new entity here when you
 * add one — nowhere else needs to know this list exists.
 */
export const ALL_ENTITIES = [
  OrganisationEntity,
  BranchEntity,
  UserEntity,
  MembershipEntity,
  AuthChallengeEntity,
  SessionEntity,
  ActivityLogEntity,
  EvidenceLedgerEntryEntity,
  IdempotencyKeyEntity,
  RegisterEntryEntity,
  RegisterRevisionEntity,
  NoticeEntity,
  NoticeVersionEntity,
  PublicVerificationSessionEntity,
  ConsentReceiptEntity,
  WithdrawalFollowupEntity,
  RightsRequestEntity,
  BreachIncidentEntity,
];
