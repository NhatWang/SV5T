const {
  buildEvidencePrompt,
  buildUniversalEvidenceSchema
} = require("./evidencePromptBuilder");

const {
  buildChatbotPrompt,
  buildChatbotSystemPrompt,
  buildChatbotUserPrompt
} = require("./chatbotPromptBuilder");

const {
  buildSuggestionPrompt,
  buildSuggestionSystemPrompt,
  buildSuggestionUserPrompt
} = require("./suggestionPromptBuilder");

/**
 * Kiểm tra văn bản có chứa từ khóa "thi thử" không.
 * Dùng để chặn minh chứng mock test cho cấp ĐHQG-HCM.
 */
function containsMockTestKeyword(text) {
  const normalized = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const mockKeywords = [
    "thi thu",
    "ky thi thu",
    "kiem tra thu",
    "chung nhan thu",
    "ket qua thi thu",
    "mock test",
    "practice test",
    "trial test",
    "placement test thu"
  ];

  return mockKeywords.some((keyword) => normalized.includes(keyword));
}

/**
 * Backward compatible wrapper.
 * Code cũ gọi buildPrompt(...) vẫn chạy được.
 * Nhưng code mới nên dùng buildEvidencePrompt(...).
 */
function buildPrompt(
  category,
  contentDescription,
  awardLevel = "truong",
  studentContext = {}
) {
  return buildEvidencePrompt({
    category,
    contentDescription,
    awardLevel,
    studentContext
  });
}

module.exports = {
  buildPrompt,
  buildEvidencePrompt,
  buildUniversalEvidenceSchema,

  buildChatbotPrompt,
  buildChatbotSystemPrompt,
  buildChatbotUserPrompt,

  buildSuggestionPrompt,
  buildSuggestionSystemPrompt,
  buildSuggestionUserPrompt,

  containsMockTestKeyword
};