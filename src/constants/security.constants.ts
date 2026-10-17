export const SECURITY_HASH_ALGORITHM = 'sha256';
export const SESSION_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
export const WORKSPACE_ROLES = { owner: 'owner', staff: 'staff', viewer: 'viewer' } as const;
