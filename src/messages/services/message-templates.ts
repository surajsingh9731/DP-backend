export type MessageTemplate =
  "task_created" | "notice_decided" | "rights_responded";

export interface RenderedMessage {
  subject: string;
  body: string;
}

/**
 * Local, bilingual, non-sensitive notification text. These are internal
 * workflow notices (to the owner/staff who triggered the underlying
 * action) — never a message to a member of the public, and never
 * containing a personal record.
 */
export function renderMessage(
  template: MessageTemplate,
  language: "en" | "hi",
  payload: Record<string, unknown>,
): RenderedMessage {
  switch (template) {
    case "task_created":
      return language === "hi"
        ? {
            subject: "नया कार्य बनाया गया",
            body: `एक नया समीक्षा कार्य बनाया गया है (${payload.taskId}).`,
          }
        : {
            subject: "New review task created",
            body: `A new review task was created (${payload.taskId}).`,
          };
    case "notice_decided":
      return language === "hi"
        ? {
            subject: "सूचना निर्णय दर्ज किया गया",
            body: `सूचना ${payload.noticeId} पर निर्णय: ${payload.decision}.`,
          }
        : {
            subject: "Notice decision recorded",
            body: `A decision was recorded on notice ${payload.noticeId}: ${payload.decision}.`,
          };
    case "rights_responded":
      return language === "hi"
        ? {
            subject: "अधिकार अनुरोध पर प्रतिक्रिया दर्ज की गई",
            body: `अनुरोध ${payload.requestId} पर एक प्रतिक्रिया दर्ज की गई है।`,
          }
        : {
            subject: "Response recorded on a rights request",
            body: `A response was recorded on request ${payload.requestId}.`,
          };
  }
}
