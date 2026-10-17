import { SetMetadata } from "@nestjs/common";
import type { MembershipRole } from "../../auth/entities/membership.entity";

export const ROLES_KEY = "roles";

export const Roles = (...roles: MembershipRole[]) =>
  SetMetadata(ROLES_KEY, roles);
