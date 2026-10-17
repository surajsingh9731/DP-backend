import type { NotificationMessage } from "../notification-channel.port";

export interface RenderedNotification {
  subject: string;
  body: string;
}

/**
 * Bilingual EN/HI template rendering for every real notification Module M
 * sends. One function, one place — adding a template means adding a case
 * here, never duplicating copy per channel.
 */
export function renderTemplate(
  message: NotificationMessage,
): RenderedNotification {
  const { template, language, payload } = message;
  const en = language !== "hi";

  switch (template) {
    case "otp_login":
    case "otp_signup": {
      const code = String(payload.code);
      return en
        ? {
            subject: "Your Sahmati verification code",
            body: `Your code is ${code}. It expires in 5 minutes. Do not share it with anyone.`,
          }
        : {
            subject: "आपका Sahmati सत्यापन कोड",
            body: `आपका कोड ${code} है। यह 5 मिनट में समाप्त हो जाएगा। इसे किसी के साथ साझा न करें।`,
          };
    }
    default:
      throw new Error(`Unknown notification template: ${template}`);
  }
}
