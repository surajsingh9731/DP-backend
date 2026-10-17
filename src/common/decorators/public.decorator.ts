import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Marks a route as reachable with no session — e.g. signup/login challenge endpoints, public notice reads. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
