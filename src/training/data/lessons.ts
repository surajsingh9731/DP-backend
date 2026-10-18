export interface TrainingQuizQuestion {
  id: string;
  prompt: { en: string; hi: string };
  options: { en: string; hi: string }[];
  correctIndex: number;
}

export interface TrainingLesson {
  code: string;
  title: { en: string; hi: string };
  summary: { en: string; hi: string };
  content: { en: string; hi: string };
  quiz: TrainingQuizQuestion[];
  /** Minimum score (0-100) to pass and receive a certificate. */
  passingScore: number;
}

/**
 * Module P's lesson catalogue — pure data, same reasoning as sector packs:
 * every organisation sees the same lessons for R2, so there's nothing to
 * gain from a database table a staff member could never edit anyway.
 * Quiz `correctIndex` never leaves this file — TrainingService strips it
 * before returning a lesson to a client and only ever compares against it
 * server-side when grading a submission.
 */
export const TRAINING_LESSONS: TrainingLesson[] = [
  {
    code: "dpdp-basics",
    title: {
      en: "DPDP Act basics",
      hi: "DPDP अधिनियम की मूल बातें",
    },
    summary: {
      en: "What the Digital Personal Data Protection Act, 2023 requires of your organisation, in plain language.",
      hi: "डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 आपके संगठन से क्या अपेक्षा रखता है, सरल भाषा में।",
    },
    content: {
      en: "The DPDP Act protects any personal data you collect about an identifiable person — students, parents, employees, patients. Three things matter most for your daily work: (1) only collect data for a purpose you've told people about in your notice; (2) record real consent where the law requires it, and let people withdraw it just as easily; (3) respond to a person's request to see, correct, or delete their data within the law's timelines. Getting these three right covers most of what the Act asks of a small organisation.",
      hi: "DPDP अधिनियम किसी पहचान योग्य व्यक्ति — छात्र, अभिभावक, कर्मचारी, रोगी — के बारे में आपके द्वारा एकत्र किए गए किसी भी व्यक्तिगत डेटा की सुरक्षा करता है। आपके दैनिक कार्य के लिए तीन बातें सबसे महत्वपूर्ण हैं: (1) केवल उस उद्देश्य के लिए डेटा एकत्र करें जिसके बारे में आपने अपनी सूचना में लोगों को बताया है; (2) जहां कानून आवश्यक करता है वहां वास्तविक सहमति दर्ज करें, और लोगों को उसे उतनी ही आसानी से वापस लेने दें; (3) किसी व्यक्ति के अपना डेटा देखने, सुधारने या हटाने के अनुरोध का कानून की समय-सीमा के भीतर जवाब दें। इन तीनों को सही करना एक छोटे संगठन से अधिनियम की अधिकांश अपेक्षाओं को पूरा करता है।",
    },
    passingScore: 70,
    quiz: [
      {
        id: "q1",
        prompt: {
          en: "Can you collect personal data for a purpose you never told people about?",
          hi: "क्या आप किसी ऐसे उद्देश्य के लिए व्यक्तिगत डेटा एकत्र कर सकते हैं जिसके बारे में आपने लोगों को कभी नहीं बताया?",
        },
        options: [
          {
            en: "Yes, as long as it's for internal use",
            hi: "हाँ, जब तक यह आंतरिक उपयोग के लिए है",
          },
          {
            en: "No — the notice must cover every purpose data is actually used for",
            hi: "नहीं — सूचना में डेटा के वास्तविक उपयोग के हर उद्देश्य को शामिल होना चाहिए",
          },
        ],
        correctIndex: 1,
      },
      {
        id: "q2",
        prompt: {
          en: "If someone withdraws their consent, what should happen?",
          hi: "यदि कोई अपनी सहमति वापस लेता है, तो क्या होना चाहिए?",
        },
        options: [
          {
            en: "Withdrawal should be just as easy as giving consent was",
            hi: "सहमति देने जितना ही आसान सहमति वापस लेना भी होना चाहिए",
          },
          {
            en: "They must submit a formal written request and wait 30 days",
            hi: "उन्हें एक औपचारिक लिखित अनुरोध प्रस्तुत करना होगा और 30 दिन प्रतीक्षा करनी होगी",
          },
        ],
        correctIndex: 0,
      },
      {
        id: "q3",
        prompt: {
          en: "A parent asks what data you hold about their child. What governs your response time?",
          hi: "एक अभिभावक पूछता है कि आप उनके बच्चे के बारे में क्या डेटा रखते हैं। आपके प्रतिक्रिया समय को क्या नियंत्रित करता है?",
        },
        options: [
          {
            en: "There's no deadline — respond whenever convenient",
            hi: "कोई समय-सीमा नहीं है — जब सुविधाजनक हो तब जवाब दें",
          },
          {
            en: "The Act's own timelines for rights requests",
            hi: "अधिकार संबंधी अनुरोधों के लिए अधिनियम की अपनी समय-सीमाएं",
          },
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    code: "handling-rights-requests",
    title: {
      en: "Handling a rights request",
      hi: "अधिकार निवेदन को संभालना",
    },
    summary: {
      en: "A practical walkthrough of what to do when a parent or staff member asks to see, fix, or delete their data.",
      hi: "व्यावहारिक मार्गदर्शन कि जब कोई अभिभावक या स्टाफ सदस्य अपना डेटा देखने, ठीक करने या हटाने के लिए कहे तो क्या करें।",
    },
    content: {
      en: "When a request comes in through the rights desk, first confirm who it's from — the public rights form already verifies this with an OTP before anyone can submit one, so you can trust the identity. Read what they're asking for: access (show me my data), correction (fix something wrong), erasure (delete it), or a grievance (a complaint). Respond honestly — if you need more time, say so and explain why, rather than letting the deadline pass silently. Every response is recorded, so there is always a record of what was asked and how it was handled.",
      hi: "जब अधिकार डेस्क के माध्यम से कोई अनुरोध आता है, तो पहले पुष्टि करें कि यह किसकी ओर से है — सार्वजनिक अधिकार फॉर्म पहले से ही किसी के सबमिट करने से पहले OTP से इसकी पुष्टि करता है, इसलिए आप पहचान पर भरोसा कर सकते हैं। पढ़ें कि वे क्या मांग रहे हैं: एक्सेस (मुझे मेरा डेटा दिखाएं), सुधार (कुछ गलत ठीक करें), मिटाना (इसे हटाएं), या शिकायत। ईमानदारी से जवाब दें — यदि आपको अधिक समय चाहिए, तो यह कहें और कारण बताएं, बजाय इसके कि समय-सीमा चुपचाप निकल जाए। हर जवाब दर्ज किया जाता है, इसलिए हमेशा एक रिकॉर्ड रहता है कि क्या मांगा गया था और इसे कैसे संभाला गया।",
    },
    passingScore: 70,
    quiz: [
      {
        id: "q1",
        prompt: {
          en: "How does the rights desk confirm who a public request is really from?",
          hi: "अधिकार डेस्क कैसे पुष्टि करता है कि सार्वजनिक अनुरोध वास्तव में किसकी ओर से है?",
        },
        options: [
          {
            en: "It doesn't — anyone can submit any request",
            hi: "यह नहीं करता — कोई भी कोई भी अनुरोध सबमिट कर सकता है",
          },
          {
            en: "An OTP verification before the request can be submitted",
            hi: "अनुरोध सबमिट होने से पहले एक OTP सत्यापन",
          },
        ],
        correctIndex: 1,
      },
      {
        id: "q2",
        prompt: {
          en: "If you can't finish a response on time, what should you do?",
          hi: "यदि आप समय पर जवाब पूरा नहीं कर सकते, तो आपको क्या करना चाहिए?",
        },
        options: [
          {
            en: "Let the deadline pass without saying anything",
            hi: "कुछ कहे बिना समय-सीमा निकल जाने दें",
          },
          {
            en: "Explain the delay rather than letting it pass silently",
            hi: "इसे चुपचाप निकलने देने के बजाय देरी की व्याख्या करें",
          },
        ],
        correctIndex: 1,
      },
    ],
  },
];

export function findLesson(code: string): TrainingLesson | undefined {
  return TRAINING_LESSONS.find((lesson) => lesson.code === code);
}
