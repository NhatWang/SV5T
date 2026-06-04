const express = require("express");
const { requireStudentAuth } = require("../Middlewares/authMiddleware");
const Student = require("../Models/Student");
const Evidence = require("../Models/Evidence");
const Activity = require("../Models/Activity");
const { callAzureClaude, callAzureClaudeStream } = require("../Utils/azureAI");

const router = express.Router();

// ─────────────────────────────────────────
// BUILD CONTEXT — tóm tắt tiến độ sinh viên
// ─────────────────────────────────────────

function buildProgressContext(student, evidences, activities) {
  const p = student.sv5tProgress || {};

  const categoryLabels = {
    daoDucTot:    "Đạo đức tốt",
    hocTapTot:    "Học tập tốt",
    theLucTot:    "Thể lực tốt",
    tinhNguyenTot:"Tình nguyện tốt",
    hoiNhapTot:   "Hội nhập tốt"
  };

  const completedByLabels = {
    activity:                     "đạt qua tham gia hoạt động hệ thống",
    evidence:                     "đạt qua nộp minh chứng",
    admin:                        "đạt do admin trực tiếp xác nhận",
    system:                       "đạt do hệ thống đồng bộ dữ liệu",
    student_declare:              "đạt qua tự khai",
    student_declare_and_evidence: "đạt qua tự khai và nộp minh chứng",
    activity_and_evidence:        "đạt qua hoạt động và có minh chứng",
    none:                         "chưa hoàn thành"
  };

  // Tóm tắt từng tiêu chí
  const criteriaLines = Object.entries(categoryLabels).map(([key, label]) => {
    const c = p[key] || {};
    const status = c.isCompleted ? "[ĐÃ ĐẠT]" : "[CHƯA ĐẠT]";
    const how = c.completedBy ? `(Hình thức: ${completedByLabels[c.completedBy] || c.completedBy})` : "";

    let detail = "";
    if (key === "hocTapTot") {
      const mandatory = c.mandatoryPassed ? "Điều kiện bắt buộc: Đạt" : "Điều kiện bắt buộc: Chưa đạt";
      const actCount = c.academicActivityCount || 0;
      const direct = c.academicDirectPassed ? "(Có ghi nhận học thuật trực tiếp)" : "";
      detail = `\n    Chi tiết: ${mandatory} | Đã tham gia: ${actCount}/3 hoạt động học thuật ${direct}`;
    }
    else if (key === "tinhNguyenTot") {
      const days = c.volunteerDays || 0;
      const award = c.hasVolunteerAward ? " | Có giấy khen tình nguyện" : "";
      detail = `\n    Chi tiết: Đã tích lũy ${days}/5 ngày tình nguyện${award}`;
    }
    else if (key === "hoiNhapTot") {
      const sub = c.subProgress || {};
      const nn = sub.ngoaiNgu ? "Ngoại ngữ: Đạt" : "Ngoại ngữ: Chưa đạt";
      const kn = sub.kyNang   ? "Kỹ năng: Đạt"   : "Kỹ năng: Chưa đạt";
      const hn = sub.hoiNhap  ? "Hội nhập: Đạt"  : "Hội nhập: Chưa đạt";
      detail = `\n    Chi tiết: ${nn} | ${kn} | ${hn}`;
    }

    return `- ${label}: ${status} ${how}${detail}`;
  }).join("\n");

  // Thống kê minh chứng rõ ràng hơn cho AI dễ đếm
  const evidenceSummary = (() => {
    if (!evidences || evidences.length === 0) return "Sinh viên chưa nộp minh chứng nào lên hệ thống.";
    const total = evidences.length;
    const byStatus = {};
    evidences.forEach(e => {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    });
    const statusLabels = {
      pending:           "Đang chờ AI duyệt",
      ai_valid:          "AI đã duyệt hợp lệ",
      ai_invalid:        "AI đánh giá KHÔNG hợp lệ",
      partial_valid:     "Hợp lệ một phần",
      manual_review:     "Đang chờ Admin duyệt thủ công",
      approved_by_admin: "Admin đã duyệt hợp lệ",
      rejected_by_admin: "Admin đã TỪ CHỐI",
      need_more_info:    "Admin yêu cầu bổ sung thêm thông tin"
    };
    const lines = Object.entries(byStatus)
      .map(([s, n]) => `- ${statusLabels[s] || s}: ${n} minh chứng`)
      .join("\n  ");
    return `Tổng số: ${total} minh chứng đã nộp.\nChi tiết trạng thái:\n  ${lines}`;
  })();

  // Thống kê hoạt động
  const activitySummary = activities.length > 0
    ? `Tham gia ${activities.length} hoạt động. Các hoạt động gần nhất: ${activities.slice(0, 3).map(a => `"${a.title}"`).join(", ")}${activities.length > 3 ? "..." : ""}`
    : "Hệ thống chưa ghi nhận tham gia hoạt động nào.";

  return `
[THÔNG TIN CHUNG CỦA SINH VIÊN]
- Họ tên: ${student.fullName}
- MSSV: ${student.studentId}
- Lớp: ${student.className || "Chưa cập nhật"}
- Tiến độ tổng quan: Hoàn thành ${student.totalCompletedCriteria || 0}/5 tiêu chí (Đạt ${student.progressPercent || 0}%)
- Trạng thái hồ sơ đợt này: ${student.sv5tStatus || "Chưa bắt đầu (not_started)"}

[CHI TIẾT TIẾN ĐỘ TỪNG TIÊU CHÍ (Cấp Trường)]
${criteriaLines}

[LỊCH SỬ NỘP MINH CHỨNG CỦA SINH VIÊN]
${evidenceSummary}

[LỊCH SỬ THAM GIA HOẠT ĐỘNG]
${activitySummary}
`.trim();
}

// ─────────────────────────────────────────
// SYSTEM PROMPT — định nghĩa vai trò chatbot
// ─────────────────────────────────────────

function buildSystemPrompt(progressContext) {
  return `Bạn là trợ lý AI chuyên trách tư vấn danh hiệu "Sinh viên 5 tốt" (SV5T) của Trường Đại học Khoa học Tự nhiên - ĐHQG-HCM, trực thuộc Khoa Hóa học.

VAI TRÒ & THÁI ĐỘ:
- Bạn là người hướng dẫn tận tâm, thân thiện, chuyên nghiệp và luôn mang tính khích lệ sinh viên.
- Bạn phải tuyệt đối trung thực dựa trên DỮ LIỆU được cung cấp, tuyệt đối KHÔNG tự bịa đặt thông tin, thành tích hay số liệu.

NHIỆM VỤ CỐT LÕI:
1. Đọc hiểu [DỮ LIỆU TIẾN ĐỘ SINH VIÊN] để xác định sinh viên đã đạt/chưa đạt tiêu chí nào.
2. Phân tích nguyên nhân chưa đạt (VD: thiếu minh chứng, chưa đủ số lượng, minh chứng bị hệ thống/admin từ chối).
3. Hướng dẫn sinh viên bổ sung ĐÚNG TÊN giấy tờ/minh chứng cần thiết dựa theo [QUY CHẾ SV5T TÓM TẮT].
4. Trả lời các thắc mắc về quy chế một cách dễ hiểu nhất.

CẤU TRÚC TRẢ LỜI BẮT BUỘC:
- Bước 1 (Tổng quan): Chào hỏi thân thiện bằng tên sinh viên và nhận xét ngắn gọn (1 câu) về tổng quan tiến độ (VD: khen ngợi nếu tiến độ tốt, động viên nếu mới bắt đầu).
- Bước 2 (Phân tích trọng tâm): Dùng gạch đầu dòng (-) hoặc danh sách đánh số để liệt kê các tiêu chí CÒN THIẾU. In đậm (**...**) tên tiêu chí và giấy tờ cần nộp.
- Bước 3 (Hành động ngay): Chốt lại bằng 1-2 bước cụ thể nhất sinh viên cần làm trên hệ thống ngay lúc này (VD: Nộp minh chứng gì, tham gia hoạt động nào).

NGUYÊN TẮC VÀ RÀNG BUỘC (QUAN TRỌNG):
- NGẮN GỌN: Không vượt quá 300 từ. Viết súc tích để dễ đọc trên điện thoại. Không nói vòng vo.
- KHÔNG VƯỢT QUYỀN: Bạn không có quyền duyệt minh chứng. 
  + Nếu minh chứng đang "đang chờ AI" hoặc "chờ admin duyệt", hãy khuyên sinh viên kiên nhẫn.
  + Nếu minh chứng "AI từ chối" hoặc "admin từ chối", hãy nhắc sinh viên kiểm tra lại quy định và nộp lại.
- BÁM SÁT NGỮ CẢNH: Nếu sinh viên đã hoàn thành tiêu chí nào, chỉ lướt qua hoặc khen ngợi, dồn sự tập trung vào tiêu chí CHƯA ĐẠT.
- TỪ CHỐI NGOÀI LỀ: Nếu sinh viên hỏi ngoài chủ đề SV5T, học tập, rèn luyện, hãy lịch sự từ chối.

QUY CHẾ SV5T TÓM TẮT (Dùng làm cẩm nang đối chiếu):
- **Đạo đức tốt:** Điểm rèn luyện >= 70, không vi phạm pháp luật/quy chế, là Đoàn viên/Hội viên hoàn thành xuất sắc nhiệm vụ.
- **Học tập tốt:** + Bắt buộc: GPA đạt ngưỡng, không nợ môn, không gian lận.
  + Điều kiện thêm (chọn 1): Tham gia >=3 hoạt động học thuật / NCKH hoặc khóa luận >=7.0 / Có bài báo khoa học / Làm trợ giảng >=1 học kỳ / Là thành viên đội tuyển học thuật.
- **Thể lực tốt (đạt 1 trong các điều kiện):**
  + Giấy chứng nhận "Thanh niên khỏe" cấp Trường.
  + Giấy chứng nhận/Huy chương thi đấu thể thao từ cấp Khoa trở lên.
  + Xác nhận tham gia >=3 hoạt động CLB Thể dục-Thể thao.
  + Giấy chứng nhận tập Gym/Yoga/Võ thuật >=3 tháng (kèm biên lai/hóa đơn).
- **Tình nguyện tốt (đạt 1 trong 2):**
  + Xác nhận tham gia >=5 ngày tình nguyện trong năm học (được cộng dồn).
  + Giấy khen tình nguyện từ cấp Trường trở lên.
- **Hội nhập tốt (Bắt buộc đủ 3 nhóm):**
  + Ngoại ngữ: Chứng chỉ B1 trở lên (IELTS 4.5+, TOEIC 401+, TOEFL iBT 35+...) hoặc điểm học phần ngoại ngữ đạt ngưỡng.
  + Kỹ năng: Hoàn thành >=1 khóa kỹ năng thực hành xã hội HOẶC đạt giải cuộc thi kỹ năng từ cấp Khoa trở lên.
  + Hội nhập: Tham gia giao lưu quốc tế HOẶC cuộc thi tìm hiểu văn hóa/chuyên ngành từ cấp Khoa trở lên.

DỮ LIỆU TIẾN ĐỘ SINH VIÊN HIỆN TẠI (Dùng để trả lời):
${progressContext}
`;
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
      return res.status(400).json({ success: false, message: "Vui lòng nhập câu hỏi." });
    }

    if (message.trim().length > 500) {
      return res.status(400).json({ success: false, message: "Câu hỏi quá dài (tối đa 500 ký tự)." });
    }

    // Lấy dữ liệu sinh viên
    const [student, evidences, activities] = await Promise.all([
      Student.findOne({ studentId }).select("-password"),
      Evidence.find({ studentId, awardLevel: "truong" }).sort({ createdAt: -1 }).limit(20),
      Activity.find({ "participants.studentId": studentId }).sort({ date: -1 }).limit(20)
    ]);

    if (!student) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông tin sinh viên." });
    }

    // Build context từ tiến độ thực tế
    const progressContext = buildProgressContext(student, evidences, activities);
    const systemPrompt = buildSystemPrompt(progressContext);

    // Giới hạn history tối đa 10 lượt để tránh vượt token
    const recentHistory = history.slice(-10);

    // Chuyển history sang format Azure Claude
    const messages = [
      ...recentHistory.map(h => ({
        role: h.role === "assistant" ? "assistant" : "user",
        content: h.content
      })),
      { role: "user", content: message.trim() }
    ];

    const reply = await callAzureClaude({
      system: systemPrompt,
      messages,
      maxTokens: 512,
      temperature: 0.7
    });

    res.json({ success: true, reply });

  } catch (error) {
    console.error("Chatbot route error:", error.message);
    const isAzureError = error.message?.includes("Azure Claude API");
    res.status(isAzureError ? 503 : 500).json({
      success: false,
      message: isAzureError
        ? "Chatbot tạm thời không khả dụng. Vui lòng thử lại sau."
        : "Lỗi server khi xử lý câu hỏi."
    });
  }
});

module.exports = router;

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
      return res.status(400).json({ success: false, message: "Vui lòng nhập câu hỏi." });
    }

    if (message.trim().length > 500) {
      return res.status(400).json({ success: false, message: "Câu hỏi quá dài (tối đa 500 ký tự)." });
    }

    const [student, evidences, activities] = await Promise.all([
      Student.findOne({ studentId }).select("-password"),
      Evidence.find({ studentId, awardLevel: "truong" }).sort({ createdAt: -1 }).limit(20),
      Activity.find({ "participants.studentId": studentId }).sort({ date: -1 }).limit(20)
    ]);

    if (!student) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông tin sinh viên." });
    }

    const progressContext = buildProgressContext(student, evidences, activities);
    const systemPrompt = buildSystemPrompt(progressContext);
    const recentHistory = history.slice(-10);

    const messages = [
      ...recentHistory.map(h => ({
        role: h.role === "assistant" ? "assistant" : "user",
        content: h.content
      })),
      { role: "user", content: message.trim() }
    ];

    // Thiết lập SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Tắt nginx buffering nếu có
    res.flushHeaders();

    // Stream từng chunk về client, fallback non-streaming nếu cần
    let streamWorked = false;

    await callAzureClaudeStream({
      system: systemPrompt,
      messages,
      maxTokens: 512,
      temperature: 0.7,
      onChunk: (chunk) => {
        streamWorked = true;
        res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
      },
      onDone: async () => {
        if (!streamWorked) {
          console.log("[Chatbot] Stream không có chunks, fallback non-streaming");
          try {
            const reply = await callAzureClaude({ system: systemPrompt, messages, maxTokens: 512, temperature: 0.7 });
            res.write(`data: ${JSON.stringify({ type: "chunk", content: reply })}\n\n`);
          } catch (err) {
            console.error("[Chatbot] Fallback error:", err.message);
            res.write(`data: ${JSON.stringify({ type: "error", message: "Chatbot tạm thời không khả dụng." })}\n\n`);
          }
        }
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      },
      onError: (error) => {
        console.error("Chatbot stream error:", error.message);
        res.write(`data: ${JSON.stringify({ type: "error", message: "Chatbot tạm thời không khả dụng." })}\n\n`);
        res.end();
      }
    });

  } catch (error) {
    console.error("Chatbot stream route error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Lỗi server khi xử lý câu hỏi." });
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", message: "Lỗi server." })}\n\n`);
      res.end();
    }
  }
});