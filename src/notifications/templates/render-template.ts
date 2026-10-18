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
    case "staff_invited": {
      const organisationName = String(payload.organisationName);
      const role = String(payload.role);
      return en
        ? {
            subject: `You've been added to ${organisationName} on Sahmati`,
            body: `${organisationName} added you as "${role}" on Sahmati. Sign in with this email or phone number to get started — no password needed, we'll send you a one-time code.`,
          }
        : {
            subject: `आपको ${organisationName} में Sahmati पर जोड़ा गया है`,
            body: `${organisationName} ने आपको "${role}" के रूप में Sahmati पर जोड़ा है। शुरू करने के लिए इस ईमेल या फ़ोन नंबर से साइन इन करें — पासवर्ड की ज़रूरत नहीं, हम आपको एक बार का कोड भेजेंगे।`,
          };
    }
    case "retention_overdue": {
      const purposeEn = String(payload.purposeEn);
      const dueAt = String(payload.dueAt).slice(0, 10);
      return en
        ? {
            subject: "Data past its retention window",
            body: `"${purposeEn}" has been past its retention window since ${dueAt}. Review it in the retention desk and either erase it or place a hold with a reason.`,
          }
        : {
            subject: "डेटा अपनी धारण अवधि से आगे निकल गया है",
            body: `"${purposeEn}" ${dueAt} से अपनी धारण अवधि से आगे निकल गया है। इसे रिटेंशन डेस्क में देखें और इसे मिटा दें या कारण के साथ होल्ड लगाएं।`,
          };
    }
    default:
      throw new Error(`Unknown notification template: ${template}`);
  }
}
