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
    case "rights_response_ready": {
      const kind = String(payload.kind);
      const status = String(payload.status);
      return en
        ? {
            subject: "Update on your request to Sahmati",
            body: `Your ${kind} request has been updated to "${status}". Sign in to the verification link you used earlier to see the full response.`,
          }
        : {
            subject: "आपके अनुरोध पर अपडेट",
            body: `आपका ${kind} अनुरोध अब "${status}" स्थिति में है। पूरा जवाब देखने के लिए आपने पहले इस्तेमाल किए गए सत्यापन लिंक से साइन इन करें।`,
          };
    }
    default:
      throw new Error(`Unknown notification template: ${template}`);
  }
}
