const express = require("express");

const { requireStudentAuth } = require("../Middlewares/authMiddleware");

const Student = require("../Models/Student");
const Evidence = require("../Models/Evidence");
const Activity = require("../Models/Activity");

const { callAzureOpenAI, callAzureOpenAIStream } = require("../Utils/azureAI");
const { detectChatbotIntent } = require("../Utils/chatbotIntents");
const globalSupport = require("../Utils/globalSupport");
const { getRegulationSummaryForPrompt } = require("../Utils/sv5tRegulations");
const {
  buildChatbotPrompt
} = require("../Utils/aiPrompts/index");

const router = express.Router();

// ─────────────────────────────────────────
// BUILD CONTEXT — tóm tắt tiến độ sinh viên
// ─────────────────────────────────────────

function buildProgressContext(student, evidences = [], activities = []) {
  const p = student.sv5tProgress || {};

  const categoryLabels = {
    daoDucTot: "Đạo đức tốt",
    hocTapTot: "Học tập tốt",
    theLucTot: "Thể lực tốt",
    tinhNguyenTot: "Tình nguyện tốt",
    hoiNhapTot: "Hội nhập tốt"
  };

  const completedByLabels = {
    activity: "đạt qua tham gia hoạt động hệ thống",
    evidence: "đạt qua nộp minh chứng",
    admin: "đạt do admin trực tiếp xác nhận",
    system: "đạt do hệ thống đồng bộ dữ liệu",
    student_declare: "đạt qua tự khai",
    student_declare_and_evidence: "đạt qua tự khai và nộp minh chứng",
    activity_and_evidence: "đạt qua hoạt động và có minh chứng",
    none: "chưa hoàn thành"
  };

  const requiredEvidenceMap = {
    daoDucTot: [
      "Bảng điểm rèn luyện",
      "Xác nhận Đoàn viên/Hội viên hoàn thành xuất sắc nhiệm vụ"
    ],

    hocTapTot: [
      "Bảng điểm học tập",
      "Giấy chứng nhận tham gia hoạt động học thuật",
      "Giấy xác nhận NCKH/khóa luận/bài báo/trợ giảng"
    ],

    theLucTot: [
      "Giấy chứng nhận Thanh niên khỏe",
      "Giấy chứng nhận/Huy chương thể thao",
      "Xác nhận tham gia CLB thể thao từ 3 hoạt động",
      "Giấy chứng nhận tập Gym/Yoga/Võ thuật từ 3 tháng kèm biên lai"
    ],

    tinhNguyenTot: [
      "Giấy xác nhận tham gia tình nguyện đủ 5 ngày",
      "Giấy khen tình nguyện cấp Trường trở lên"
    ],

    hoiNhapTot: [
      "Chứng chỉ ngoại ngữ B1/IELTS/TOEIC/TOEFL",
      "Giấy chứng nhận khóa kỹ năng thực hành xã hội",
      "Giấy chứng nhận giao lưu quốc tế/cuộc thi hội nhập"
    ]
  };

  const criteriaLines = Object.entries(categoryLabels)
    .map(([key, label]) => {
      const c = p[key] || {};
      const status = c.isCompleted ? "[ĐÃ ĐẠT]" : "[CHƯA ĐẠT]";

      const how = c.completedBy
        ? `(Hình thức: ${completedByLabels[c.completedBy] || c.completedBy})`
        : "";

      const requiredEvidence = requiredEvidenceMap[key]
        ? requiredEvidenceMap[key]
            .map((item) => `      + ${item}`)
            .join("\n")
        : "      + Chưa có danh sách minh chứng gợi ý.";

      let detail = "";

      if (key === "hocTapTot") {
        const mandatory = c.mandatoryPassed
          ? "Điều kiện bắt buộc: Đạt"
          : "Điều kiện bắt buộc: Chưa đạt";

        const actCount = c.academicActivityCount || 0;

        const direct = c.academicDirectPassed
          ? "(Có ghi nhận học thuật trực tiếp)"
          : "";

        detail = `\n    Chi tiết: ${mandatory} | Đã tham gia: ${actCount}/3 hoạt động học thuật ${direct}`;
      } else if (key === "tinhNguyenTot") {
        const days = c.volunteerDays || 0;
        const award = c.hasVolunteerAward
          ? " | Có giấy khen tình nguyện"
          : "";

        detail = `\n    Chi tiết: Đã tích lũy ${days}/5 ngày tình nguyện${award}`;
      } else if (key === "hoiNhapTot") {
        const sub = c.subProgress || {};

        const nn = sub.ngoaiNgu
          ? "Ngoại ngữ: Đạt"
          : "Ngoại ngữ: Chưa đạt";

        const kn = sub.kyNang
          ? "Kỹ năng: Đạt"
          : "Kỹ năng: Chưa đạt";

        const hn = sub.hoiNhap
          ? "Hội nhập: Đạt"
          : "Hội nhập: Chưa đạt";

        detail = `\n    Chi tiết: ${nn} | ${kn} | ${hn}`;
      }

      return `- ${label}: ${status} ${how}${detail}
Minh chứng gợi ý nếu chưa đạt:
${requiredEvidence}`;
    })
    .join("\n");

  const evidenceSummary = (() => {
    if (!evidences || evidences.length === 0) {
      return "Sinh viên chưa nộp minh chứng nào lên hệ thống.";
    }

    const total = evidences.length;
    const byStatus = {};

    evidences.forEach((evidence) => {
      byStatus[evidence.status] = (byStatus[evidence.status] || 0) + 1;
    });

    const statusLabels = {
      pending: "Đang chờ AI duyệt",
      ai_valid: "AI đã duyệt hợp lệ",
      ai_invalid: "AI đánh giá KHÔNG hợp lệ",
      partial_valid: "Hợp lệ một phần",
      manual_review: "Đang chờ Admin duyệt thủ công",
      approved_by_admin: "Admin đã duyệt hợp lệ",
      rejected_by_admin: "Admin đã TỪ CHỐI",
      need_more_info: "Admin yêu cầu bổ sung thêm thông tin"
    };

    const lines = Object.entries(byStatus)
      .map(([status, count]) => {
        return `- ${statusLabels[status] || status}: ${count} minh chứng`;
      })
      .join("\n  ");

    return `Tổng số: ${total} minh chứng đã nộp.\nChi tiết trạng thái:\n  ${lines}`;
  })();

  const activitySummary =
    activities.length > 0
      ? `Tham gia ${activities.length} hoạt động. Các hoạt động gần nhất: ${activities
          .slice(0, 3)
          .map((activity) => `"${activity.title}"`)
          .join(", ")}${activities.length > 3 ? "..." : ""}`
      : "Hệ thống chưa ghi nhận tham gia hoạt động nào.";

  return `
[THÔNG TIN CHUNG CỦA SINH VIÊN]

* Họ tên: ${student.fullName}
* MSSV: ${student.studentId}
* Lớp: ${student.className || "Chưa cập nhật"}
* Tiến độ tổng quan: Hoàn thành ${student.totalCompletedCriteria || 0}/5 tiêu chí (Đạt ${student.progressPercent || 0}%)
* Trạng thái hồ sơ đợt này: ${student.sv5tStatus || "Chưa bắt đầu (not_started)"}

[CHI TIẾT TIẾN ĐỘ TỪNG TIÊU CHÍ]
${criteriaLines}

[LỊCH SỬ NỘP MINH CHỨNG CỦA SINH VIÊN]
${evidenceSummary}

[LỊCH SỬ THAM GIA HOẠT ĐỘNG]
${activitySummary}
`.trim();
}

function buildEvidenceSummaryForChatbot(evidences = []) {
  return evidences.map((evidence) => ({
    category: evidence.category || "",
    awardLevel: evidence.awardLevel || "truong",
    status: evidence.status || "",
    reason: evidence.aiResult?.reason || "",
    missingInfo: evidence.aiResult?.missingInfo || [],
    warningFlags: evidence.aiResult?.warningFlags || [],
    decision: evidence.aiResult?.decision || "",
    createdAt: evidence.createdAt || null
  }));
}

function buildActivitySummaryForChatbot(activities = []) {
  return activities.map((activity) => ({
    title: activity.title || activity.name || "",
    category: activity.category || "",
    date: activity.date || activity.startDate || null
  }));
}

function buildRegulationContextForChatbot() {
  return `
${getRegulationSummaryForPrompt("truong")}
${getRegulationSummaryForPrompt("dhqg")}
${getRegulationSummaryForPrompt("thanh")}
${getRegulationSummaryForPrompt("trungUong")}
`.trim();
}

// ─────────────────────────────────────────
// RULE-BASED REPLY — trả lời nhanh không cần gọi AI
// ─────────────────────────────────────────

function buildRuleBasedReply(intent) {
  if (intent === "contact_support") {
    return `Bạn có thể liên hệ ${globalSupport.lienChiHoiName || "Liên Chi hội Khoa Hóa học"} qua:

* Email: ${globalSupport.supportEmail || "Thông tin email chưa được cập nhật trên hệ thống."}
* Fanpage: ${globalSupport.fanpageUrl || "Thông tin fanpage chưa được cập nhật trên hệ thống."}
* Nhóm Zalo: ${globalSupport.zaloGroupUrl || "Thông tin nhóm Zalo chưa được cập nhật trên hệ thống."}

Nếu thông tin trên chưa truy cập được, bạn nên kiểm tra fanpage chính thức hoặc liên hệ Văn phòng Khoa.`;
  }

  if (intent === "deadline_question") {
    return "Hiện chatbot chưa có dữ liệu hạn nộp chính thức. Bạn nên kiểm tra thông báo mới nhất từ Liên Chi hội Khoa Hóa học, fanpage hoặc hệ thống SV5T.";
  }

  if (intent === "out_of_scope") {
    return "Mình chỉ hỗ trợ các nội dung liên quan đến SV5T, học tập, rèn luyện, minh chứng và hoạt động sinh viên. Với câu hỏi này, mình chưa thể hỗ trợ trong phạm vi chatbot SV5T.";
  }

  return null;
}

function sanitizeHistory(history = []) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history.slice(-10).map((item) => {
    return {
      role: item.role === "assistant" ? "assistant" : "user",
      content: String(item.content || "").slice(0, 1000)
    };
  });
}

async function getStudentChatbotContext(studentId) {
  const [student, evidences, activities] = await Promise.all([
    Student.findOne({ studentId }).select("-password"),
    Evidence.find({
      studentId,
      awardLevel: "truong"
    })
      .sort({ createdAt: -1 })
      .limit(20),
    Activity.find({
      "participants.studentId": studentId
    })
      .sort({ date: -1 })
      .limit(20)
  ]);

  return {
    student,
    evidences,
    activities
  };
}

// ─────────────────────────────────────────
// ROUTE: POST /api/chatbot/student
// Body: { message: string, history: [{role, content}] }
// ─────────────────────────────────────────

router.post("/student", requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.studentId;
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập câu hỏi."
      });
    }

    if (message.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Câu hỏi quá dài. Vui lòng nhập tối đa 500 ký tự."
      });
    }

    const userMessage = message.trim();
    const detected = detectChatbotIntent(userMessage);

    const ruleBasedReply = buildRuleBasedReply(detected.intent);

    if (ruleBasedReply) {
      return res.json({
        success: true,
        intent: detected.intent,
        reply: ruleBasedReply
      });
    }

    const { student, evidences, activities } =
      await getStudentChatbotContext(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin sinh viên."
      });
    }

    const progressContext = buildProgressContext(
  student,
  evidences,
  activities
);

const evidenceSummary = buildEvidenceSummaryForChatbot(evidences);
const activitySummary = buildActivitySummaryForChatbot(activities);
const regulationContext = buildRegulationContextForChatbot();

const { systemPrompt, userPrompt } = buildChatbotPrompt({
  question: userMessage,
  intent: detected.intent,

  studentContext: {
    studentId: student.studentId || "",
    fullName: student.fullName || "",
    className: student.className || ""
  },

  progressSummary: {
    totalCompletedCriteria: student.totalCompletedCriteria || 0,
    progressPercent: student.progressPercent || 0,
    sv5tStatus: student.sv5tStatus || "not_started",
    sv5tProgress: student.sv5tProgress || {},
    textSummary: progressContext
  },

  evidenceSummary,
  activitySummary,
  regulationContext,
  faqContext: "",
  supportContact: globalSupport
});

const messages = [
  ...sanitizeHistory(history),
  {
    role: "user",
    content: userPrompt
  }
];

const reply = await callAzureOpenAI({
  system: systemPrompt,
  messages,
  maxTokens: 512,
  temperature: 0.2
});

    return res.json({
      success: true,
      intent: detected.intent,
      reply
    });
  } catch (error) {
    console.error("Chatbot route error:", error.message);

    const isAzureError = error.message?.includes("Azure OpenAI API");

    return res.status(isAzureError ? 503 : 500).json({
      success: false,
      message: isAzureError
        ? "Chatbot tạm thời không khả dụng. Vui lòng thử lại sau."
        : "Lỗi server khi xử lý câu hỏi."
    });
  }
});

// ─────────────────────────────────────────
// ROUTE: POST /api/chatbot/student/stream
// Streaming version — dùng SSE
// Body: { message: string, history: [{role, content}] }
// ─────────────────────────────────────────

router.post("/student/stream", requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.studentId;
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập câu hỏi."
      });
    }

    if (message.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Câu hỏi quá dài. Vui lòng nhập tối đa 500 ký tự."
      });
    }

    const userMessage = message.trim();
    const detected = detectChatbotIntent(userMessage);

    const ruleBasedReply = buildRuleBasedReply(detected.intent);

    if (ruleBasedReply) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
      }

      res.write(
        `data: ${JSON.stringify({
          type: "chunk",
          content: ruleBasedReply
        })}\n\n`
      );

      res.write(
        `data: ${JSON.stringify({
          type: "done",
          intent: detected.intent
        })}\n\n`
      );

      return res.end();
    }

    const { student, evidences, activities } =
      await getStudentChatbotContext(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin sinh viên."
      });
    }

    const progressContext = buildProgressContext(
  student,
  evidences,
  activities
);

const evidenceSummary = buildEvidenceSummaryForChatbot(evidences);
const activitySummary = buildActivitySummaryForChatbot(activities);
const regulationContext = buildRegulationContextForChatbot();

const { systemPrompt, userPrompt } = buildChatbotPrompt({
  question: userMessage,
  intent: detected.intent,

  studentContext: {
    studentId: student.studentId || "",
    fullName: student.fullName || "",
    className: student.className || ""
  },

  progressSummary: {
    totalCompletedCriteria: student.totalCompletedCriteria || 0,
    progressPercent: student.progressPercent || 0,
    sv5tStatus: student.sv5tStatus || "not_started",
    sv5tProgress: student.sv5tProgress || {},
    textSummary: progressContext
  },

  evidenceSummary,
  activitySummary,
  regulationContext,
  faqContext: "",
  supportContact: globalSupport
});

const messages = [
  ...sanitizeHistory(history),
  {
    role: "user",
    content: userPrompt
  }
];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    let streamWorked = false;

    await callAzureOpenAIStream({
      system: systemPrompt,
      messages,
      maxTokens: 512,
      temperature: 0.2,

      onChunk: (chunk) => {
        streamWorked = true;

        res.write(
          `data: ${JSON.stringify({
            type: "chunk",
            content: chunk
          })}\n\n`
        );
      },

      onDone: async () => {
        if (!streamWorked) {
          console.log("[Chatbot] Stream không có chunks, fallback non-streaming");

          try {
            const reply = await callAzureOpenAI({
              system: systemPrompt,
              messages,
              maxTokens: 512,
              temperature: 0.2
            });

            res.write(
              `data: ${JSON.stringify({
                type: "chunk",
                content: reply
              })}\n\n`
            );
          } catch (fallbackError) {
            console.error("[Chatbot] Fallback error:", fallbackError.message);

            res.write(
              `data: ${JSON.stringify({
                type: "error",
                message: "Chatbot tạm thời không khả dụng."
              })}\n\n`
            );
          }
        }

        res.write(
          `data: ${JSON.stringify({
            type: "done",
            intent: detected.intent
          })}\n\n`
        );

        return res.end();
      },

      onError: (streamError) => {
        console.error("Chatbot stream error:", streamError.message);

        res.write(
          `data: ${JSON.stringify({
            type: "error",
            message: "Chatbot tạm thời không khả dụng."
          })}\n\n`
        );

        return res.end();
      }
    });
  } catch (error) {
    console.error("Chatbot stream route error:", error.message);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi xử lý câu hỏi."
      });
    }

    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message: "Lỗi server."
      })}\n\n`
    );

    return res.end();
  }
});

module.exports = router;