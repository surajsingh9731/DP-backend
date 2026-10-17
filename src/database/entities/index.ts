import { RETENTION_ENTITIES } from '../../retention/entities/index.js';
import { RIGHTS_ENTITIES } from '../../rights/entities/index.js';
import { CHECK_ENTITIES } from '../../checks/entities/index.js';
import { FOLLOWUP_ENTITIES } from '../../followups/entities/index.js';
import { CONSENT_ENTITIES } from '../../consent-sandbox/entities/index.js';
import { PREPARATION_ENTITIES } from '../../preparation/entities/index.js';
import { NOTICE_ENTITIES } from '../../notices/entities/index.js';
import { FOUNDATION_ENTITIES } from './foundation.entities.js';
import { RegisterEntryEntity } from './register-entries.entity.js';
import { RegisterPackSourceEntity } from './register-pack-sources.entity.js';
import { RegisterRevisionEntity } from './register-revisions.entity.js';
import { SetupDraftEntity } from './setup-drafts.entity.js';
export * from './foundation.entities.js';
export { RegisterEntryEntity };
export { RegisterRevisionEntity };
export { RegisterPackSourceEntity };
export { SetupDraftEntity };
export const DATABASE_ENTITIES = [
  ...RETENTION_ENTITIES,
  ...RIGHTS_ENTITIES,
  ...CHECK_ENTITIES,
  ...FOLLOWUP_ENTITIES,
  ...CONSENT_ENTITIES,
  ...FOUNDATION_ENTITIES,
  ...PREPARATION_ENTITIES,
  ...NOTICE_ENTITIES,
  RegisterEntryEntity,
  RegisterRevisionEntity,
  RegisterPackSourceEntity,
  SetupDraftEntity,
];
