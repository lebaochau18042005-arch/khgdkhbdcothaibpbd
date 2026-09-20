/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Bộ từ điển và tiện ích chuyển đổi song ngữ (Anh - Việt)
 * Dành riêng cho Năng lực số (TT 02/2025/TT-BGDĐT) & Năng lực AI (QĐ 2422/QĐ-BGDĐT)
 */

export const NLS_COMPONENTS_EN_MAP: Record<string, string> = {
  // Domain 1: Data and Information Literacy
  "1.1": "Browsing, searching and filtering data, information and digital content",
  "1.2": "Evaluating data, information and digital content",
  "1.3": "Managing data, information and digital content",

  // Domain 2: Communication and Collaboration
  "2.1": "Interacting through digital technologies",
  "2.2": "Sharing through digital technologies",
  "2.3": "Engaging in citizenship through digital technologies",
  "2.4": "Collaborating through digital technologies",
  "2.5": "Netiquette",
  "2.6": "Managing digital identity",

  // Domain 3: Digital Content Creation
  "3.1": "Developing digital content",
  "3.2": "Integrating and re-elaborating digital content",
  "3.3": "Copyright and licenses",
  "3.4": "Programming",

  // Domain 4: Safety
  "4.1": "Protecting devices",
  "4.2": "Protecting personal data and privacy",
  "4.3": "Protecting health and well-being",
  "4.4": "Protecting the environment",

  // Domain 5: Problem Solving
  "5.1": "Solving technical problems",
  "5.2": "Identifying needs and technological responses",
  "5.3": "Creatively using digital technologies",
  "5.4": "Identifying digital competence gaps",

  // Domain 6: AI Applications
  "6.1": "Understanding AI concepts and principles",
  "6.2": "Using and interacting with AI systems",
  "6.3": "Assessing AI outputs and ethics"
};

export const AI_COMPONENTS_EN_MAP: Record<string, { name: string; description: string }> = {
  NLa: {
    name: "NLa - Human-centric mindset",
    description: "Human agency and oversight, critical evaluation and final decision making in AI systems."
  },
  NLb: {
    name: "NLb - AI ethics, safety, law and responsibility",
    description: "Copyright awareness, privacy, information security, recognizing biases and social risks."
  },
  NLc: {
    name: "NLc - AI techniques and applications",
    description: "Understanding AI mechanisms, prompt engineering, leveraging AI tools in learning and research."
  },
  NLd: {
    name: "NLd - AI system design, testing and refinement",
    description: "Designing, testing and improving AI-driven solutions to solve real-world problems."
  }
};

export const getNlsComponentNameEn = (code?: string, defaultViName?: string): string => {
  if (!code) return defaultViName || "Digital Competence Component";
  const match = code.match(/^(?:NLS-)?(\d+\.\d+)/i);
  if (match && NLS_COMPONENTS_EN_MAP[match[1]]) {
    return NLS_COMPONENTS_EN_MAP[match[1]];
  }
  // Try mapping by Vietnamese keywords
  const vi = (defaultViName || "").toLowerCase();
  if (vi.includes("tìm kiếm") || vi.includes("lọc")) return "Browsing, searching and filtering digital content";
  if (vi.includes("đánh giá")) return "Evaluating data, information and digital content";
  if (vi.includes("quản lý") || vi.includes("quản lí")) return "Managing data and digital content";
  if (vi.includes("tương tác")) return "Interacting through digital technologies";
  if (vi.includes("chia sẻ")) return "Sharing through digital technologies";
  if (vi.includes("hợp tác")) return "Collaborating through digital technologies";
  if (vi.includes("phát triển nội dung") || vi.includes("sáng tạo")) return "Developing digital content";
  if (vi.includes("bản quyền")) return "Copyright and licenses";
  if (vi.includes("lập trình")) return "Programming";
  if (vi.includes("an toàn") || vi.includes("bảo vệ")) return "Digital safety and data protection";
  if (vi.includes("giải quyết")) return "Problem solving with digital technologies";
  if (vi.includes("trí tuệ nhân tạo") || vi.includes("ai")) return "Using and interacting with AI systems";
  return defaultViName || "Digital Competence";
};

export const getAiComponentNameEn = (codeOrName?: string): string => {
  const norm = (codeOrName || "").toUpperCase();
  if (norm.includes("NLA") || norm.includes(".A") || norm.includes("CON NGƯỜI") || norm.includes("HUMAN")) {
    return AI_COMPONENTS_EN_MAP.NLa.name;
  }
  if (norm.includes("NLB") || norm.includes(".B") || norm.includes("ĐẠO ĐỨC") || norm.includes("ETHIC")) {
    return AI_COMPONENTS_EN_MAP.NLb.name;
  }
  if (norm.includes("NLC") || norm.includes(".C") || norm.includes("KỸ THUẬT") || norm.includes("KĨ THUẬT") || norm.includes("ỨNG DỤNG") || norm.includes("PROMPT") || norm.includes("TECHNIQUE")) {
    return AI_COMPONENTS_EN_MAP.NLc.name;
  }
  if (norm.includes("NLD") || norm.includes(".D") || norm.includes("THIẾT KẾ") || norm.includes("THỬ NGHIỆM") || norm.includes("DESIGN")) {
    return AI_COMPONENTS_EN_MAP.NLd.name;
  }
  return "AI Competence Component";
};

export const translateIntegrationLevelEn = (level?: string): string => {
  const norm = (level || "").toLowerCase();
  if (norm.includes("nhẹ") || norm.includes("light")) return "Light level";
  if (norm.includes("sâu") || norm.includes("deep") || norm.includes("heavy")) return "Deep level";
  return "Moderate level";
};

export const translateDevicePlanEn = (plan?: string): string => {
  const norm = (plan || "").toLowerCase();
  if (!norm) return "Option A/B; offline fallback with printed flashcards/materials";
  if (norm.includes("phương án a") || norm.includes("option a")) {
    return "Option A (1:1 personal devices), offline fallback: printed multiple-choice cards";
  }
  if (norm.includes("phương án b") || norm.includes("option b")) {
    return "Option B (group devices in pairs/teams), offline fallback: worksheets";
  }
  if (norm.includes("phương án c") || norm.includes("option c")) {
    return "Option C (computer lab), offline fallback: printed materials";
  }
  if (norm.includes("ngoại tuyến") || norm.includes("thẻ giấy") || norm.includes("offline")) {
    return "Option A/B, offline fallback: teacher uses printed multiple-choice flashcards or worksheets";
  }
  return plan || "Option A/B; offline fallback: teacher uses printed flashcards/worksheets";
};

/**
 * Check if the subject or text indicates an English language lesson plan
 */
export const checkIsEnglishSubject = (subject?: string, topic?: string, text?: string, fileName?: string): boolean => {
  const combined = `${subject || ""} ${topic || ""} ${text || ""} ${fileName || ""}`.toLowerCase();
  return (
    combined.includes("tiếng anh") ||
    combined.includes("tieng anh") ||
    combined.includes("english") ||
    combined.includes("global success") ||
    combined.includes("friends global") ||
    combined.includes("bright") ||
    combined.includes("smart world") ||
    combined.includes("ilearn smart") ||
    /\b(?:unit\s*\d+|getting started|looking back|language focus|reading comprehension)\b/i.test(combined)
  );
};
