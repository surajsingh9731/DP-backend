import { BranchEntity } from './branch.entity.js';
import { ChallengeEntity } from './challenge.entity.js';
import { LoginJobEntity } from './loginjob.entity.js';
import { MailboxEntity } from './mailbox.entity.js';
import { MembershipEntity } from './membership.entity.js';
import { OrganisationEntity } from './organisation.entity.js';
import { SessionEntity } from './session.entity.js';
import { TaskEntity } from './task.entity.js';
import { UserEntity } from './user.entity.js';
export { UserEntity };
export { MembershipEntity };
export { OrganisationEntity };
export { BranchEntity };
export { TaskEntity };
export { ChallengeEntity };
export { SessionEntity };
export { LoginJobEntity };
export { MailboxEntity };
export const FOUNDATION_ENTITIES = [
  UserEntity,
  MembershipEntity,
  OrganisationEntity,
  BranchEntity,
  TaskEntity,
  ChallengeEntity,
  SessionEntity,
  LoginJobEntity,
  MailboxEntity,
];
