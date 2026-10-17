export const MESSAGE_LANGUAGES = ['en', 'hi'];
export const DEFAULT_MESSAGE_LANGUAGE = 'en';
export type Language = 'en' | 'hi';
export interface MessageCopy {
  subject: string;
  body: string;
}
export interface MessageLocale {
  login: (code: string, expiryMinutes: number) => MessageCopy;
  task: MessageCopy;
}
