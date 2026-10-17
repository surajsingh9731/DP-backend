import type { MessageLocale } from '../../constants/message.constants.js';
export const HI_MESSAGES: MessageLocale = {
  login: (code, expiryMinutes) => ({
    subject: 'सहमति का स्थानीय साइन इन कोड',
    body: `आपका कोड ${code} है। यह ${expiryMinutes} मिनट तक मान्य है। यह नमूना संदेश केवल स्थानीय मेलबॉक्स में रखा गया है।`,
  }),
  task: {
    subject: 'सहमति में एक सेटअप काम तैयार है',
    body: 'अपने स्थानीय कार्यक्षेत्र में डेटा सूची की समीक्षा करें। इस संदेश में व्यक्तिगत रिकॉर्ड नहीं हैं और यह कंप्यूटर से बाहर नहीं गया है।',
  },
};
