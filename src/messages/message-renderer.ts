import { AUTH_LIMITS } from '../constants/auth.constants.js';
import { EN_MESSAGES } from './locales/en.js';
import { HI_MESSAGES } from './locales/hi.js';
import type { Language, MessageCopy } from '../constants/message.constants.js';
export type { Language, MessageCopy } from '../constants/message.constants.js';
export function loginMessage(code: string, language: Language): MessageCopy {
  return (language === 'hi' ? HI_MESSAGES : EN_MESSAGES).login(
    code,
    AUTH_LIMITS.challengeLifetimeSeconds / 60,
  );
}
export function taskMessage(language: Language): MessageCopy {
  return { ...(language === 'hi' ? HI_MESSAGES : EN_MESSAGES).task };
}
