export type SafetyClassification = {
  blocked: boolean;
  reason: string;
  educationalReply: string;
};

const hatefulIdeologyPatterns = [
  /\bsieg\s+heil\b/i,
  /\bheil\s+hitler\b/i,
  /\bnazi\s+(power|glory|victory|forever)\b/i,
  /\bwhite\s+power\b/i,
  /\b1488\b/i,
];

const praisePatterns = /\b(praise|glorify|support|promote|celebrate|write slogan|make propaganda|join|recruit)\b/i;

export function classifySafetyIntent(text: string): SafetyClassification {
  const matchedIdeology = hatefulIdeologyPatterns.find((pattern) => pattern.test(text));
  if (!matchedIdeology) {
    return { blocked: false, reason: '', educationalReply: '' };
  }

  const educationalAllowed = /\b(history|historical|explain|meaning|context|why|danger|harm|study|class|exam)\b/i.test(text);
  const promotional = praisePatterns.test(text) || !educationalAllowed;

  if (!promotional && educationalAllowed) {
    return {
      blocked: false,
      reason: 'hateful_ideology_educational',
      educationalReply:
        'This phrase is associated with Nazi ideology and hate movements. I can help explain its historical context, harms, and why it is dangerous, but I will not promote or glorify it.',
    };
  }

  return {
    blocked: true,
    reason: 'hateful_ideology_promotion',
    educationalReply:
      'This phrase is associated with Nazi ideology and hate movements. I can help explain its historical context, harms, or why it is dangerous, but I will not promote, praise, recruit for, or glorify it.',
  };
}
