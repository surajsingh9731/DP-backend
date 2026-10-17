import type { MessageLocale } from '../../constants/message.constants.js';
export const EN_MESSAGES: MessageLocale = {
  login: (code, expiryMinutes) => ({
    subject: 'Your Sahmati local sign-in code',
    body: `Your code is ${code}. It expires in ${expiryMinutes} minutes. This synthetic message is stored only in the local mailbox.`,
  }),
  task: {
    subject: 'A Sahmati setup task is ready',
    body: 'Review the data inventory in your local workspace. This message contains no personal records and has not left this computer.',
  },
};
