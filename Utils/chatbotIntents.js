/**
 * Utils/chatbotIntents.js
 * Nhận diện intent từ tin nhắn sinh viên để chatbot trả lời đúng hướng.
 */

const INTENT_PATTERNS = [
  {
    intent: "check_progress",
    patterns: [
      "tiến độ", "còn thiếu", "cần làm gì", "đạt chưa", "hoàn thành chưa",
      "bao nhiêu tiêu chí", "tình trạng hồ sơ", "hồ sơ của tôi",
      "tôi đạt", "đang ở đâu", "còn bao nhiêu", "status"
    ]
  },
  {
    intent: "missing_evidence",
    patterns: [
      "minh chứng gì", "giấy tờ gì", "cần nộp gì", "nộp gì",
      "minh chứng nào", "giấy nào", "cần giấy", "tài liệu gì",
      "nộp minh chứng", "upload gì", "file gì"
    ]
  },
  {
    intent: "criterion_explanation",
    patterns: [
      "đạo đức tốt là gì", "học tập tốt là gì", "thể lực tốt là gì",
      "tình nguyện tốt là gì", "hội nhập tốt là gì",
      "tiêu chí gì", "điều kiện gì", "quy chế", "quy định",
      "cần đạt gì", "yêu cầu gì", "sv5t là gì", "sinh viên 5 tốt là gì"
    ]
  },
  {
    intent: "evidence_status",
    patterns: [
      "trạng thái", "minh chứng của tôi", "đã nộp chưa", "đang chờ",
      "đã duyệt chưa", "kết quả minh chứng", "xem minh chứng",
      "ai duyệt", "admin duyệt", "được duyệt chưa"
    ]
  },
  {
    intent: "rejected_evidence",
    patterns: [
      "bị từ chối", "không hợp lệ", "ai invalid", "rejected",
      "minh chứng sai", "nộp lại", "tại sao bị từ chối",
      "lý do từ chối", "bị trả về"
    ]
  },
  {
    intent: "activity_recommendation",
    patterns: [
      "hoạt động nào", "nên tham gia gì", "gợi ý hoạt động",
      "tham gia gì", "sự kiện nào", "câu lạc bộ", "clb",
      "tình nguyện ở đâu", "thể thao nào"
    ]
  },
  {
    intent: "contact_support",
    patterns: [
      "liên hệ", "email", "fanpage", "zalo", "hỗ trợ",
      "liên chi hội", "ban tổ chức", "gặp ai", "hỏi ai",
      "facebook", "nhóm zalo", "inbox", "nhắn tin"
    ]
  },
  {
    intent: "deadline_question",
    patterns: [
      "hạn nộp", "deadline", "ngày cuối", "thời hạn",
      "hạn chót", "nộp đến khi nào", "kết thúc khi nào",
      "mấy giờ", "ngày mấy", "tháng mấy"
    ]
  },
  {
    intent: "out_of_scope",
    patterns: [
      "thời tiết", "bóng đá", "phim", "nhạc", "nấu ăn",
      "yêu", "tình yêu", "game", "meme", "joke", "hài",
      "chứng khoán", "bitcoin", "crypto"
    ]
  }
];

/**
 * Nhận diện intent từ tin nhắn người dùng.
 * @param {string} message
 * @returns {{ intent: string, confidence: number }}
 */
function detectChatbotIntent(message) {
  if (!message || typeof message !== "string") {
    return { intent: "general_sv5t_question", confidence: 0 };
  }

  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // bỏ dấu
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();

  let bestMatch = { intent: "general_sv5t_question", confidence: 0 };

  for (const { intent, patterns } of INTENT_PATTERNS) {
    const matchCount = patterns.filter((p) => {
      const normalizedPattern = p
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .trim();
      return normalized.includes(normalizedPattern);
    }).length;

    const confidence = matchCount / patterns.length;

    if (matchCount > 0 && confidence > bestMatch.confidence) {
      bestMatch = { intent, confidence };
    }
  }

  return bestMatch;
}

module.exports = { detectChatbotIntent };