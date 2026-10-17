import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as not requiring a signed-in session (e.g. auth challenge/verify, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
