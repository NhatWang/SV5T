let adminUsername = "";
let adminRole = "";
let adminClassName = "";
let currentCentralStudentId = "";
let currentStudentDetailData = null;
let currentStudentDetailLevel = "truong";
let _activityParticipantsMap = {};

const categoryLabels = {
  daoDucTot: "Đạo đức tốt",
  hocTapTot: "Học tập tốt",
  theLucTot: "Thể lực tốt",
  tinhNguyenTot: "Tình nguyện tốt",
  hoiNhapTot: "Hội nhập tốt",
  khac: "Khác"
};

async function checkAdminSession() {
  try {
    const res = await fetch("/api/admin/me", {
      method: "GET",
      credentials: "include"
    });

    const data = await res.json();

    if (!data.success) {
      window.location.href = "/admin.html";
      return;
    }

    adminUsername = data.admin.username;
    adminRole = data.admin.role;
    adminClassName = data.admin.className || "";
    if (typeof initPushNotifications === "function") {
  initPushNotifications("admin");
}

    initAdminDashboard();
  } catch (error) {
    console.error("Check admin session error:", error);
    window.location.href = "/admin.html";
  }
}

checkAdminSession();

function formatDateSafe(dateValue) {
  if (!dateValue) return "Chưa cập nhật";

  const date = new Date(dateValue);

  if (isNaN(date.getTime())) {
    return "Chưa cập nhật";
  }

  if (date.getFullYear() === 1970) {
    return "Chưa cập nhật";
  }

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatAwardLevel(level) {
  if (level === "truong") return "Cấp Trường";
  if (level === "dhqg") return "Cấp ĐHQG-HCM";
  if (level === "thanh") return "Cấp Thành phố";
  if (level === "trung_uong") return "Cấp Trung ương";
  return "Chưa xác định";
}

function formatCategory(category) {
  return categoryLabels[category] || category || "Chưa rõ";
}

function formatAiValidity(value) {
  if (value === true) return "Đề xuất hợp lệ";
  if (value === false) return "Đề xuất chưa hợp lệ";
  return "Không xác định / cần kiểm tra";
}

function formatEvidenceStatus(status) {
  if (status === "pending") return "Đang chờ xử lý";
  if (status === "ai_valid") return "AI đánh giá hợp lệ";
  if (status === "ai_invalid") return "AI đánh giá không hợp lệ";
  if (status === "partial_valid") return "Hợp lệ một phần";
  if (status === "manual_review") return "Cần admin kiểm tra";
  if (status === "approved_by_admin") return "Đã duyệt";
  if (status === "rejected_by_admin") return "Từ chối";
  if (status === "rejected") return "Từ chối";
  if (status === "need_more_info") return "Cần bổ sung";
  return status || "Chưa cập nhật";
}

function formatQRVerification(evidence) {
  const qr = evidence?.qrVerification;
  if (!qr || !qr.hasQR) return "";
  if (qr.studentNameFound || qr.studentIdFound) {
    const parts = [];
    if (qr.ocrMethod === "vision" && qr.foundPage) {
      parts.push(`Vision OCR: trang ${qr.foundPage}`);
    } else if (qr.ocrMethod === "text") {
      parts.push("Text match");
    }
    if (qr.pdfFileName) parts.push(escapeHtml(qr.pdfFileName));
    const detail = parts.length ? ` — ${parts.join(" | ")}` : "";
    return `<br><small style="color:#065f46;background:#d1fae5;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px">QR xác nhận hợp lệ${detail}</small>`;
  }
  if (qr.error) {
    return `<br><small style="color:#6b7280;background:#f3f4f6;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px">QR lỗi: ${escapeHtml(qr.error)}</small>`;
  }
  return `<br><small style="color:#92400e;background:#fef3c7;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px">QR: Không tìm thấy tên sinh viên trong tài liệu</small>`;
}

function formatSv5tStatus(status) {
  if (status === "not_started") return "Chưa đăng ký hệ thống SV5T";
  if (status === "in_progress") return "Đang thực hiện";
  if (status === "completed") return "Hoàn thành 5/5";
  if (status === "submitted") return "Đã nộp xét duyệt";
  if (status === "approved") return "Đã duyệt";
  if (status === "rejected") return "Từ chối";
  return status || "Chưa cập nhật";
}

function showAdminTab(tabId, button) {
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  document.querySelectorAll(".sidebar-submenu button").forEach((btn) => {
    btn.classList.remove("active");
  });

  const tab = document.getElementById(tabId);

  if (tab) {
    tab.classList.add("active");
  }

  if (button) {
    button.classList.add("active");
  }

  const uploadTabs = [
    "uploadStudents",
    "uploadClassAdmins",
    "uploadActivities"
  ];

  const uploadMenu = document.getElementById("uploadDataMenu");
  const uploadArrow = document.getElementById("uploadMenuArrow");

  if (uploadTabs.includes(tabId)) {
    if (uploadMenu) {
      uploadMenu.classList.add("open");
    }

    if (uploadArrow) {
      uploadArrow.textContent = "▴";
    }

    if (button) {
      button.classList.add("active");
    }
  }

  if (tabId === "centralEvidenceTab") {
    loadCentralEvidences();
  }

  if (tabId === "checkin") {
    loadCheckinSessions();
  }

  if (window.innerWidth <= 768) closeSidebar();
}

async function loadClassSelectorForSuperAdmin() {
  if (adminRole !== "super_admin") return;

  const picker = document.getElementById("superAdminClassPicker");
  const select = document.getElementById("superAdminClassSelect");
  const table = document.getElementById("studentsTable");

  if (picker) {
    picker.classList.remove("hidden");
  }

  if (!select) return;

  select.innerHTML = `<option value="">Chọn lớp cần xem</option>`;

  try {
    const res = await fetch("/api/admin-dashboard/classes/summary", {
      credentials: "include"
    });

    const data = await res.json();

    if (!data.success) {
      if (table) {
        table.innerHTML = `
          <tr>
            <td colspan="5">Không thể tải danh sách lớp.</td>
          </tr>
        `;
      }
      return;
    }

    const summaries = (data.summaries || []).slice().sort((a, b) =>
      a.className.localeCompare(b.className, undefined, { numeric: true, sensitivity: "base" })
    );

    summaries.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.className;
      option.textContent = item.className;
      select.appendChild(option);
    });

    if (table) {
      table.innerHTML = `
        <tr>
          <td colspan="6">Vui lòng chọn lớp để xem danh sách sinh viên.</td>
        </tr>
      `;
    }
  } catch (error) {
    console.error("Load class selector error:", error);

    if (table) {
      table.innerHTML = `
        <tr>
          <td colspan="6">Không thể kết nối server khi tải danh sách lớp.</td>
        </tr>
      `;
    }
  }
}

function handleSuperAdminClassChange() {
  const select = document.getElementById("superAdminClassSelect");

  if (!select || !select.value) {
    const table = document.getElementById("studentsTable");
    const countLabel = document.getElementById("studentsCountLabel");
    if (countLabel) countLabel.textContent = "";

    if (table) {
      table.innerHTML = `
        <tr>
          <td colspan="6">Vui lòng chọn lớp để xem danh sách sinh viên.</td>
        </tr>
      `;
    }

    return;
  }

  loadClassStudents(select.value);
}

window.handleSuperAdminClassChange = handleSuperAdminClassChange;

function setupSuperAdminView() {
  const studentsTabBtn = document.getElementById("studentsTabBtn");
  const studentsTab = document.getElementById("students");

  if (studentsTabBtn) {
    studentsTabBtn.style.display = "block";
    studentsTabBtn.classList.remove("active");
  }

  if (studentsTab) {
    studentsTab.classList.remove("active");
  }

  const overviewBtn = document.getElementById("overviewTabBtn");
  showAdminTab("overview", overviewBtn);

  loadClassSelectorForSuperAdmin();
}

function initAdminDashboard() {
  const adminInfo = document.getElementById("adminInfo");

  if (adminInfo) {
    adminInfo.textContent =
      adminRole === "super_admin"
        ? `Super Admin: ${adminUsername}`
        : `Admin lớp: ${adminClassName}`;
  }

  const adminClassUploadNote = document.getElementById("adminClassUploadNote");
  if (adminClassUploadNote) {
    adminClassUploadNote.style.display = adminRole === "admin" ? "" : "none";
  }

  if (adminRole === "admin") {
    const classSummaryTabBtn = document.getElementById("classSummaryTabBtn");

    if (classSummaryTabBtn) {
      classSummaryTabBtn.style.display = "none";
    }

    const evidenceTabBtn = document.getElementById("evidenceTabBtn");

    if (evidenceTabBtn) {
      evidenceTabBtn.style.display = "block";
    }

    const collectiveEvaluationTabBtn = document.getElementById(
      "collectiveEvaluationTabBtn"
    );

    if (collectiveEvaluationTabBtn) {
      collectiveEvaluationTabBtn.style.display = "block";
    }

    const collectiveEvaluationPanel = document.getElementById(
      "collectiveEvaluationPanel"
    );

    if (collectiveEvaluationPanel) {
      collectiveEvaluationPanel.classList.remove("hidden");
    }

    const evaluationClassNameInput = document.getElementById("evaluationClassName");

    if (evaluationClassNameInput) {
      evaluationClassNameInput.value = adminClassName;
      evaluationClassNameInput.readOnly = true;
    }

    document.getElementById("overviewTitle").textContent =
      `Quản lý lớp ${adminClassName}`;

    document.getElementById("overviewDescription").textContent =
      "Bạn có thể xem tiến độ sinh viên, duyệt minh chứng, upload hoạt động và cập nhật đánh giá Chi Hội của lớp mình.";

    loadClassStudents(adminClassName);
    loadCollectiveProgress(adminClassName);
    loadAllEvidences();
    loadUploadedActivities();
    loadOverviewStats();
  }

  if (adminRole === "super_admin") {
    document.getElementById("overviewTitle").textContent =
      "Tổng quan Liên chi Hội";

    document.getElementById("overviewDescription").textContent =
      "Bạn có thể xem tiến độ tập thể các lớp, duyệt minh chứng toàn khoa, upload sinh viên và upload hoạt động.";

    const fixSection = document.getElementById("fixActivatedSection");
    if (fixSection) fixSection.classList.remove("hidden");

    const maintenanceSection = document.getElementById("maintenanceSection");
    if (maintenanceSection) maintenanceSection.classList.remove("hidden");

    const broadcastPushSection = document.getElementById("broadcastPushSection");
    if (broadcastPushSection) broadcastPushSection.classList.remove("hidden");

    const classSupportListSection = document.getElementById("classSupportListSection");
    if (classSupportListSection) classSupportListSection.classList.remove("hidden");

    loadMaintenanceStatus();
    loadClassSupportList();

    const collectiveEvaluationTabBtn = document.getElementById(
      "collectiveEvaluationTabBtn"
    );

    if (collectiveEvaluationTabBtn) {
      collectiveEvaluationTabBtn.style.display = "none";
    }

    const collectiveEvaluationPanel = document.getElementById(
      "collectiveEvaluationPanel"
    );

    if (collectiveEvaluationPanel) {
      collectiveEvaluationPanel.classList.add("hidden");
    }

    setupSuperAdminView();

    loadAllEvidences();
    loadAllCollectiveProgress();
    loadUploadedActivities();
    loadOverviewStats();
  }
}

async function loadClassStudents(className) {
  if (!className) return;

  try {
    const res = await fetch(
      `/api/admin-dashboard/class/${encodeURIComponent(className)}/students`,
      {
        credentials: "include"
      }
    );

    const data = await res.json();
    const table = document.getElementById("studentsTable");

    if (!table) return;

    table.innerHTML = "";

    const countLabel = document.getElementById("studentsCountLabel");
    if (countLabel) {
      countLabel.textContent = `Tổng số sinh viên: ${data.totalStudents || 0}`;
    }

    if (!data.success || data.students.length === 0) {
      table.innerHTML = `<tr><td colspan="6">Chưa có sinh viên trong lớp này.</td></tr>`;
      return;
    }

    data.students.forEach((student) => {
      const row = document.createElement("tr");

      row.innerHTML = `
  <td>${escapeHtml(student.studentId)}</td>
  <td>
    <button
      class="student-detail-link"
      onclick="openStudentDetail('${escapeHtml(student.studentId)}')"
    >
      ${escapeHtml(student.fullName)}
    </button>
  </td>
  <td>${escapeHtml(student.className)}</td>
  <td>${student.totalCompletedCriteria}/5 (${student.progressPercent}%)</td>
  <td>${formatSv5tStatus(student.sv5tStatus)}</td>
  <td>
    <button
      class="danger-btn"
      onclick="deleteStudent('${escapeHtml(student.studentId)}', '${escapeHtml(student.className)}')"
    >Xóa</button>
  </td>
`;

      table.appendChild(row);
    });
  } catch (error) {
    console.error("Load class students error:", error);
  }
}

async function loadCollectiveProgress(className) {
  if (!className) return;

  try {
    const res = await fetch(
      `/api/admin-dashboard/class/${encodeURIComponent(className)}/collective-progress`,
      {
        credentials: "include"
      }
    );

    const data = await res.json();

    if (!data.success) return;

    const collective = data.collectiveProgress;

    document.getElementById("collectiveClassName").textContent =
      `Lớp ${data.className}`;

    document.getElementById("collectiveProgressFill").style.width =
      `${data.completedPercent}%`;

    document.getElementById("collectiveProgressText").innerHTML = `
      <strong>Kết quả tập thể:</strong>
      ${
        collective.isCollectiveAchieved
          ? `<span class="status-note success">Đạt danh hiệu tập thể Chi Hội</span>`
          : `<span class="status-note warning">Chưa đạt danh hiệu tập thể Chi Hội</span>`
      }
      <br><br>

      <strong>Sinh viên đạt SV5T:</strong>
      ${data.completedStudents}/${data.totalStudents} sinh viên
      (${data.completedPercent}%)
      <br>

      <strong>Yêu cầu tối thiểu:</strong>
      ${collective.requiredPercent}% sinh viên đạt SV5T
      ${
        collective.requiredStudentCount !== undefined
          ? `, tương đương tối thiểu ${collective.requiredStudentCount} sinh viên`
          : ""
      }
      <br>

      <strong>Ghi chú:</strong> ${collective.note}
    `;

    const categoryStats = document.getElementById("categoryStats");
    categoryStats.innerHTML = "";

    const checks = collective.checks || {};
    const criteria = collective.criteria || {};

    const checkItems = [
      {
        key: "chiHoiRatingStrong",
        label: criteria.chiHoiRatingStrong || "Chi Hội xếp loại Mạnh"
      },
      {
        key: "hasRegistrationForm",
        label: criteria.hasRegistrationForm || "Có hình thức đăng ký SV5T"
      },
      {
        key: "hasSupportActivities",
        label: criteria.hasSupportActivities || "Có hoạt động tạo môi trường SV5T"
      },
      {
        key: "enoughSv5tRate",
        label:
          criteria.enoughSv5tRate ||
          "Đạt tỷ lệ sinh viên SV5T theo quy mô Chi Hội"
      },
      {
        key: "noViolation",
        label: criteria.noViolation || "Không có sinh viên vi phạm"
      }
    ];

    const checkTitle = document.createElement("h4");
    checkTitle.textContent = "Điều kiện danh hiệu tập thể Chi Hội";
    categoryStats.appendChild(checkTitle);

    checkItems.forEach((item) => {
      const div = document.createElement("div");
      div.className = "activity-item";

      div.innerHTML = `
        ${checks[item.key] ? "✅" : "❌"}
        <strong>${item.label}</strong>
      `;

      categoryStats.appendChild(div);
    });

    const categoryTitle = document.createElement("h4");
    categoryTitle.textContent = "Thống kê từng tiêu chí SV5T";
    categoryStats.appendChild(categoryTitle);

    Object.keys(data.categoryStats).forEach((category) => {
      const item = data.categoryStats[category];

      const div = document.createElement("div");
      div.className = "activity-item";

      div.innerHTML = `
        <strong>${item.label}</strong>:
        ${item.completedCount}/${data.totalStudents} sinh viên đạt
        (${item.percent}%)
      `;

      categoryStats.appendChild(div);
    });
  } catch (error) {
    console.error("Load collective progress error:", error);
  }
}

async function loadAllCollectiveProgress() {
  try {
    const res = await fetch("/api/admin-dashboard/classes/summary", {
      credentials: "include"
    });

    const data = await res.json();

    if (!data.success) return;

    document.getElementById("collectiveClassName").textContent =
      "Tiến độ tập thể tất cả các lớp";

    const totalClasses = data.summaries.length;

    const achievedClasses = data.summaries.filter((item) => {
      return item.collectiveProgress?.isCollectiveAchieved === true;
    }).length;

    const averagePercent =
      totalClasses > 0
        ? Math.round(
            data.summaries.reduce((sum, item) => {
              return sum + item.completedPercent;
            }, 0) / totalClasses
          )
        : 0;

    document.getElementById("collectiveProgressFill").style.width =
      `${averagePercent}%`;

    document.getElementById("collectiveProgressText").innerHTML = `
      <strong>Kết quả tập thể:</strong>
      ${achievedClasses}/${totalClasses} lớp đạt danh hiệu tập thể Chi Hội
      <br>

      <strong>Tiến độ trung bình:</strong>
      ${averagePercent}%
    `;

    const categoryStats = document.getElementById("categoryStats");
    categoryStats.innerHTML = "";

    data.summaries.forEach((item) => {
      const collective = item.collectiveProgress || {};

      const requiredPercent = collective.requiredPercent || 0;
      const requiredStudentCount = collective.requiredStudentCount || 0;
      const isAchieved = collective.isCollectiveAchieved === true;

      const div = document.createElement("div");
      div.className = "activity-item";

      div.innerHTML = `
        ${isAchieved ? "✅" : "❌"}
        <strong>${item.className}</strong>:
        ${item.completedStudents}/${item.totalStudents} sinh viên đạt SV5T
        (${item.completedPercent}%).
        Yêu cầu: ${requiredPercent}% (${requiredStudentCount} sinh viên cần đạt).
        ${isAchieved ? "Đạt danh hiệu tập thể Chi Hội." : "Chưa đạt danh hiệu tập thể Chi Hội."}
      `;

      categoryStats.appendChild(div);
    });
  } catch (error) {
    console.error("Load all collective progress error:", error);
  }
}

let allEvidencesCache = [];

async function loadAllEvidences() {
  try {
    const awardLevel =
      document.getElementById("evidenceAwardLevelFilter")?.value || "";

    const status =
      document.getElementById("evidenceStatusFilter")?.value || "";

    const category =
      document.getElementById("evidenceCategoryFilter")?.value || "";

    const params = new URLSearchParams();

    if (awardLevel) params.append("awardLevel", awardLevel);
    if (status) params.append("status", status);
    if (category) params.append("category", category);

    const res = await fetch(
      `/api/admin-dashboard/evidences/all?${params.toString()}`,
      {
        credentials: "include"
      }
    );

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Không thể tải danh sách minh chứng.");
      return;
    }

    allEvidencesCache = data.evidences || [];
    applyEvidenceFilters();
  } catch (error) {
    console.error("Load evidences error:", error);
    alert("Không thể kết nối server khi tải minh chứng.");
  }
}

function applyEvidenceFilters() {
  const search = (document.getElementById("evidenceSearch")?.value || "").trim().toLowerCase();
  const sortDir = document.getElementById("evidenceClassSort")?.value || "";

  let list = [...allEvidencesCache];

  if (search) {
    list = list.filter((ev) => {
      const student = ev.student || {};
      return (
        (student.studentId || "").toLowerCase().includes(search) ||
        (student.fullName || "").toLowerCase().includes(search)
      );
    });
  }

  if (sortDir === "asc") {
    list.sort((a, b) =>
      (a.student?.className || "").localeCompare(b.student?.className || "", "vi", { numeric: true })
    );
  } else if (sortDir === "desc") {
    list.sort((a, b) =>
      (b.student?.className || "").localeCompare(a.student?.className || "", "vi", { numeric: true })
    );
  }

  renderEvidencesTable(list);
}

function renderEvidencesTable(evidences) {
  const tbody = document.getElementById("evidencesTable");

  if (!tbody) return;

  tbody.innerHTML = "";

  if (!evidences || evidences.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">Không có minh chứng nào.</td>
      </tr>
    `;
    return;
  }

  evidences.forEach((evidence) => {
    const row = document.createElement("tr");
    const student = evidence.student || {};

    const fileUrl = evidence.fileUrl
      ? evidence.fileUrl
      : evidence.filePath
      ? `/${evidence.filePath.replace(/\\/g, "/")}`
      : "";

    row.innerHTML = `
      <td>${evidence.studentId || ""}</td>

      <td>${student.fullName || "Chưa rõ"}</td>

      <td>${student.className || "Chưa cập nhật"}</td>

      <td>
        <span class="award-badge ${evidence.awardLevel || "truong"}">
          ${formatAwardLevel(evidence.awardLevel)}
        </span>
      </td>

      <td>${formatCategory(evidence.category)}</td>

      <td>
        ${
          fileUrl
            ? `<a href="${fileUrl}" target="_blank">Xem file</a>`
            : `<span>Chưa lưu R2 / không có file</span>`
        }
      </td>

      <td>
        <small>
          <strong>AI:</strong> ${formatAiValidity(evidence.aiResult?.isValid)}
          <br>
          <strong>Độ tin cậy:</strong> ${evidence.aiResult?.confidence || 0}%
          <br>
          <strong>Lý do:</strong> ${evidence.aiResult?.reason || "Không có"}
        </small>
      </td>

      <td>
        ${formatEvidenceStatus(evidence.status)}
        ${evidence.adminReview?.note ? `<br><small style="color:#92400e;background:#fef3c7;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px">Ghi chú: ${escapeHtml(evidence.adminReview.note)}</small>` : ""}
        ${formatQRVerification(evidence)}
      </td>

      <td>${renderEvidenceActions(evidence)}</td>
    `;

    tbody.appendChild(row);
  });
}

function formatKyNangEvidenceType(value) {
  if (value === "skill_course") {
    return "Khóa kỹ năng thực hành xã hội";
  }

  if (value === "skill_competition_award_khoa_or_above") {
    return "Giải cuộc thi kỹ năng từ cấp Khoa trở lên";
  }

  if (value === "skill_competition_award_truong_or_above") {
    return "Giải cuộc thi kỹ năng từ cấp Trường trở lên";
  }

  if (value === "skill_reporter_khoa_or_above") {
    return "Báo cáo viên lớp kỹ năng từ cấp Khoa trở lên";
  }

  if (value === "skill_reporter_truong_or_above") {
    return "Báo cáo viên lớp kỹ năng từ cấp Trường trở lên";
  }

  if (value === "union_association_award_truong_or_above") {
    return "Khen thưởng Đoàn/Hội từ cấp Trường trở lên";
  }

  if (value === "student_leader_competition_finalist_truong_or_above") {
    return "Chung kết thủ lĩnh sinh viên cấp Trường trở lên";
  }

  return "Không áp dụng";
}

function shouldShowManualEvidenceFields(evidence) {
  const confidence = Number(evidence.aiResult?.confidence || 0);
  const isValid = evidence.aiResult?.isValid;

  const matchedType = String(evidence.aiResult?.matchedType || "")
    .trim()
    .toLowerCase();

  const unknownMatchedType =
    !matchedType ||
    matchedType.includes("không xác định") ||
    matchedType.includes("khong xac dinh") ||
    matchedType.includes("unknown");

  return isValid !== true || confidence < 70 || unknownMatchedType;
}

function renderManualEvidenceFields(evidence) {
  if (!shouldShowManualEvidenceFields(evidence)) {
    return "";
  }

  if (evidence.category === "hoiNhapTot") {
    return `
      <div class="manual-evidence-fields">
        <label>Admin chọn nhóm Hội nhập</label>
        <select class="manual-subcriteria-select">
          <option value="">Chọn nhóm</option>
          <option value="ngoaiNgu">Ngoại ngữ</option>
          <option value="kyNang">Kỹ năng</option>
          <option value="hoiNhap">Hoạt động hội nhập</option>
        </select>

        <label>Loại minh chứng ngoại ngữ nếu chọn Ngoại ngữ</label>
<select class="manual-foreign-language-select">
  <option value="">Không áp dụng</option>
  <option value="course_score">Điểm học phần ngoại ngữ</option>
  <option value="language_certificate">Chứng chỉ ngoại ngữ</option>
  <option value="international_exchange">Giao lưu quốc tế / hội nghị / hội thảo quốc tế</option>
  <option value="integration_competition_award">Giải cuộc thi kiến thức hội nhập</option>
  <option value="foreign_language_academic_competition_award">Giải cuộc thi học thuật bằng ngoại ngữ</option>
</select>

        <label>Loại kỹ năng nếu chọn Kỹ năng</label>
        <select class="manual-ky-nang-select">
          <option value="">Không áp dụng</option>
          <option value="skill_course">Khóa kỹ năng thực hành xã hội</option>
          <option value="skill_competition_award_khoa_or_above">Giải cuộc thi kỹ năng từ cấp Khoa trở lên</option>
          <option value="skill_competition_award_truong_or_above">Giải cuộc thi kỹ năng từ cấp Trường trở lên</option>
          <option value="skill_reporter_khoa_or_above">Báo cáo viên lớp kỹ năng từ cấp Khoa trở lên</option>
          <option value="skill_reporter_truong_or_above">Báo cáo viên lớp kỹ năng từ cấp Trường trở lên</option>
          <option value="union_association_award_truong_or_above">Khen thưởng Đoàn/Hội từ cấp Trường trở lên</option>
          <option value="student_leader_competition_finalist_truong_or_above">Chung kết thủ lĩnh sinh viên cấp Trường trở lên</option>
        </select>

        <label>Loại hoạt động hội nhập nếu chọn Hoạt động hội nhập</label>
        <select class="manual-hoi-nhap-select">
          <option value="">Không áp dụng</option>
          <option value="international_exchange">Giao lưu quốc tế / hội nghị / hội thảo quốc tế</option>
          <option value="integration_competition_khoa_or_above">Cuộc thi tìm hiểu văn hóa/hội nhập từ cấp Khoa trở lên</option>
          <option value="integration_competition_award_truong_or_above">Giải Ba trở lên cuộc thi kiến thức hội nhập từ cấp Trường trở lên</option>
          <option value="foreign_language_academic_competition_award_truong_or_above">Giải Ba trở lên cuộc thi học thuật bằng ngoại ngữ</option>
          <option value="official_international_program_member">Thành viên chính thức chương trình quốc tế</option>
          <option value="international_program_volunteer">Tình nguyện viên chương trình quốc tế</option>
          <option value="integration_activity_truong_or_above">Hoạt động hội nhập từ cấp Trường trở lên</option>
        </select>
      </div>
    `;
  }

  if (evidence.category === "hocTapTot") {
    return `
      <div class="manual-evidence-fields">
        <label>Admin chọn loại minh chứng học tập</label>
        <select class="manual-academic-type-select">
          <option value="">Chọn loại học tập</option>
          <option value="hocThuat_3_activities">Hoạt động học thuật 1/3</option>
          <option value="nghienCuu">Nghiên cứu khoa học / khóa luận</option>
          <option value="sangTao">Ý tưởng sáng tạo / nghiên cứu</option>
          <option value="troGiang">Trợ giảng</option>
          <option value="baiBao">Bài báo / tham luận</option>
          <option value="doiTuyen">Đội tuyển học thuật</option>
          <option value="khac_direct">Minh chứng học thuật đạt trực tiếp</option>
        </select>
      </div>
    `;
  }

  if (evidence.category === "tinhNguyenTot") {
    return `
      <div class="manual-evidence-fields">
        <label>Số ngày tình nguyện admin xác nhận</label>
        <input
          class="manual-volunteer-days-input"
          type="number"
          min="0"
          step="1"
          placeholder="Ví dụ: 5"
        />

        <label>
          <input class="manual-volunteer-award-checkbox" type="checkbox" />
          Có khen thưởng / xác nhận tình nguyện
        </label>
      </div>
    `;
  }

  return "";
}

function renderEvidenceActions(evidence) {
  if (evidence.status === "approved_by_admin") {
    return `<span class="status-note success">Đã duyệt</span>`;
  }

  if (evidence.status === "rejected_by_admin") {
    return `<span class="status-note danger">Đã từ chối</span>`;
  }

  if (evidence.status === "pending") {
    return `<span class="status-note warning">AI đang kiểm tra</span>`;
  }

  return `
    ${renderManualEvidenceFields(evidence)}

    <button onclick="reviewEvidence('${evidence._id}', 'approved_by_admin', this)">
      Duyệt
    </button>

    <button onclick="reviewEvidence('${evidence._id}', 'rejected_by_admin', this)">
      Từ chối
    </button>

    <button onclick="reviewEvidence('${evidence._id}', 'need_more_info', this)">
      Bổ sung
    </button>
  `;
}

async function reviewEvidence(evidenceId, status, buttonElement) {
  const note = prompt("Nhập ghi chú duyệt minh chứng:", "");

  try {

    const row = buttonElement?.closest("tr");

const manualSubCriteria =
  row?.querySelector(".manual-subcriteria-select")?.value || "";

const manualForeignLanguageEvidenceType =
  row?.querySelector(".manual-foreign-language-select")?.value || "";

const manualKyNangEvidenceType =
  row?.querySelector(".manual-ky-nang-select")?.value || "";

const manualHoiNhapEvidenceType =
  row?.querySelector(".manual-hoi-nhap-select")?.value || "";

const manualAcademicEvidenceType =
  row?.querySelector(".manual-academic-type-select")?.value || "";

const manualVolunteerDays =
  row?.querySelector(".manual-volunteer-days-input")?.value || "";

const manualHasVolunteerAward =
  row?.querySelector(".manual-volunteer-award-checkbox")?.checked || false;
    const res = await fetch(
      `/api/admin-dashboard/evidences/${evidenceId}/review`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
  status,
  note: note || "",
  reviewedBy: adminUsername,

manualReview: {
  subCriteria: manualSubCriteria,
  foreignLanguageEvidenceType: manualForeignLanguageEvidenceType,
  kyNangEvidenceType: manualKyNangEvidenceType,
  hoiNhapEvidenceType: manualHoiNhapEvidenceType,
  academicEvidenceType: manualAcademicEvidenceType,
  volunteerDays: manualVolunteerDays,
  hasVolunteerAward: manualHasVolunteerAward
}
})
      }
    );

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Không thể xử lý minh chứng.");
      return;
    }

    updateEvidenceRowAfterReview(buttonElement, status);

    if (adminRole === "admin" && adminClassName) {
      loadClassStudents(adminClassName);
      loadCollectiveProgress(adminClassName);
    }

    if (adminRole === "super_admin") {
      loadAllCollectiveProgress();
    }
  } catch (error) {
    console.error("Review evidence error:", error);
    alert("Không thể duyệt minh chứng");
  }
}

function updateEvidenceRowAfterReview(buttonElement, status) {
  if (!buttonElement) return;

  const row = buttonElement.closest("tr");

  if (!row) return;

  const statusCell = row.children[7];
  const actionCell = row.children[8];

  if (!statusCell || !actionCell) return;

  statusCell.textContent = formatEvidenceStatus(status);

  if (status === "approved_by_admin") {
    actionCell.innerHTML = `<span class="status-note success">Đã duyệt</span>`;
    return;
  }

  if (status === "rejected_by_admin") {
    actionCell.innerHTML = `<span class="status-note danger">Đã từ chối</span>`;
    return;
  }

  if (status === "need_more_info") {
    actionCell.innerHTML = `<span class="status-note warning">Cần bổ sung</span>`;
  }
}

async function uploadStudentsExcel() {
  const fileInput = document.getElementById("studentExcelFile");
  const message = document.getElementById("uploadStudentsMessage");

  message.textContent = "";

  if (!fileInput.files[0]) {
    message.textContent = "Vui lòng chọn file Excel.";
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  try {
    const res = await fetch("/api/admin-dashboard/upload-students", {
      method: "POST",
      body: formData,
      credentials: "include"
    });

    const data = await res.json();

    if (!data.success) {
      message.textContent = data.message || "Upload thất bại.";
      return;
    }

    message.textContent =
      `${data.message}. Thêm mới: ${data.inserted || 0}, cập nhật: ${data.updated || 0}`;

    if (data.success) {
      fileInput.value = "";

      if (adminRole === "admin" && adminClassName) {
        loadClassStudents(adminClassName);
        loadCollectiveProgress(adminClassName);
      }

      if (adminRole === "super_admin") {
        loadAllCollectiveProgress();
      }
    }
  } catch (error) {
    console.error("Upload students error:", error);
    message.textContent = "Không thể upload danh sách sinh viên.";
  }
}

async function uploadActivitiesExcel() {
  const fileInput = document.getElementById("activityExcelFile");
  const message = document.getElementById("uploadActivitiesMessage");

  message.textContent = "";

  if (!fileInput || !fileInput.files[0]) {
    message.textContent = "Vui lòng chọn file Excel hoạt động.";
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  try {
    const res = await fetch("/api/admin-dashboard/upload-activities", {
      method: "POST",
      body: formData,
      credentials: "include"
    });

    const data = await res.json();

    if (!data.success) {
      message.textContent = data.message || "Upload hoạt động thất bại.";
      return;
    }

    message.textContent =
      `Upload hoạt động thành công. Số hoạt động đã tạo: ${data.createdActivities || 0}.`;

    if (data.errors && data.errors.length > 0) {
      message.textContent += ` Có ${data.errors.length} dòng bị lỗi, vui lòng kiểm tra lại file Excel.`;
      console.warn("Upload activity row errors:", data.errors);
    }

    fileInput.value = "";

    await loadUploadedActivities();

    if (adminRole === "admin" && adminClassName) {
      await loadClassStudents(adminClassName);
      await loadCollectiveProgress(adminClassName);
    }

    if (adminRole === "super_admin") {
      await loadAllCollectiveProgress();
    }
  } catch (error) {
    console.error("Upload activities error:", error);
    message.textContent = "Không thể upload hoạt động.";
  }
}

async function updateCollectiveEvaluation() {
  let className = document.getElementById("evaluationClassName").value.trim();

  if (adminRole === "admin") {
    className = adminClassName;
  }

  const chiHoiRating = document.getElementById("chiHoiRating").value;
  const hasRegistrationForm =
    document.getElementById("hasRegistrationForm").checked;
  const hasSupportActivities =
    document.getElementById("hasSupportActivities").checked;
  const hasViolation = document.getElementById("hasViolation").checked;

  const message = document.getElementById("collectiveEvaluationMessage");

  message.textContent = "";
  message.className = "";

  if (!className) {
    message.textContent = "Vui lòng nhập tên lớp / Chi Hội";
    message.className = "msg-error";
    return;
  }

  try {
    const res = await fetch(
      `/api/admin-dashboard/class/${encodeURIComponent(className)}/collective-evaluation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          chiHoiRating,
          hasRegistrationForm,
          hasSupportActivities,
          hasViolation
        })
      }
    );

    const data = await res.json();

    if (!data.success) {
      message.textContent =
        data.message || "Không thể cập nhật đánh giá Chi Hội";
      message.className = "msg-error";
      return;
    }

    message.textContent = data.message;
    message.className = "msg-success";

    if (adminRole === "super_admin") {
      await loadAllCollectiveProgress();
    }

    if (adminRole === "admin" && adminClassName === className) {
      await loadCollectiveProgress(className);
    }
  } catch (error) {
    console.error("Update collective evaluation error:", error);

    message.textContent = "Không thể kết nối server";
    message.className = "msg-error";
  }
}

function fillCollectiveEvaluationForm(className) {
  const input = document.getElementById("evaluationClassName");

  if (input) {
    input.value = className;
  }

  const tabBtn = document.getElementById("collectiveEvaluationTabBtn");
  showAdminTab("collectiveEvaluation", tabBtn);
}

async function loadUploadedActivities() {
  try {
    const organizerLevel =
      document.getElementById("activityOrganizerLevelFilter")?.value || "";

    const params = new URLSearchParams();

    if (organizerLevel) {
      params.append("organizerLevel", organizerLevel);
    }

    const res = await fetch(
      `/api/admin-dashboard/activities/uploaded?${params.toString()}`,
      {
        credentials: "include"
      }
    );

    const data = await res.json();

    const table = document.getElementById("uploadedActivitiesTable");

    if (!table) return;

    table.innerHTML = "";
    _activityParticipantsMap = {};

    if (!data.success || !data.activities || data.activities.length === 0) {
      table.innerHTML = `
        <tr>
          <td colspan="9">Chưa có hoạt động nào được upload.</td>
        </tr>
      `;
      return;
    }

    data.activities.forEach((activity) => {
      const row = document.createElement("tr");

      const participantCount = activity.participants
        ? activity.participants.length
        : 0;

      let detail = "";

      if (activity.category === "hoiNhapTot") {
        detail = formatHoiNhapSubCriteria(activity.subCriteria);
      } else if (activity.category === "hocTapTot") {
        detail = formatAcademicEvidenceType(activity.academicEvidenceType);
      } else if (activity.category === "tinhNguyenTot") {
        detail = activity.volunteerDays
          ? `${activity.volunteerDays} ngày`
          : "Chưa cập nhật số ngày";
      } else {
        detail = "-";
      }

      const activityId = String(activity._id);
      _activityParticipantsMap[activityId] = {
        title: activity.title || "Không rõ",
        participants: activity.participants || [],
        activity
      };

      row.innerHTML = `
  <td>
    <button class="activity-title-btn" onclick="openActivityParticipantsModal('${activityId}')" style="background:none;border:none;padding:0;color:var(--blue,#2563eb);font-weight:600;cursor:pointer;text-align:left;font-size:inherit;text-decoration:underline;text-underline-offset:2px;">
      ${escapeHtml(activity.title || "Không rõ")}
    </button>
  </td>

  <td>
    <span class="award-badge ${activity.organizerLevel || "khac"}">
      ${formatOrganizerLevel(activity.organizerLevel)}
    </span>
  </td>

  <td>${categoryLabels[activity.category] || activity.category}</td>

  <td>
  ${
    activity.category === "hoiNhapTot" && activity.subCriteria === "kyNang"
      ? formatKyNangEvidenceType(activity.kyNangEvidenceType)
      : activity.category === "hoiNhapTot" && activity.subCriteria === "hoiNhap"
      ? formatHoiNhapEvidenceType(activity.hoiNhapEvidenceType)
      : "Không áp dụng"
  }
</td>

  <td>${detail}</td>
  <td>${formatDateSafe(activity.date)}</td>
  <td>${participantCount}</td>
  <td>${activity.uploadedBy || "admin"}</td>
  <td>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <button
        class="edit-btn"
        onclick="openEditActivityModal(_activityParticipantsMap[String('${activityId}')]?.activity)"
      >
        Sửa
      </button>
      <button
        class="danger-btn"
        onclick="deleteUploadedActivity('${activity._id}')"
      >
        Xóa
      </button>
    </div>
  </td>
`;

      table.appendChild(row);
    });
  } catch (error) {
    console.error("Load uploaded activities error:", error);
  }
}

function formatOrganizerLevel(level) {
  if (level === "chi_hoi") return "Chi Hội";
  if (level === "bo_mon") return "Chi Hội";
  if (level === "khoa") return "Khoa";
  if (level === "truong") return "Trường";
  if (level === "dhqg") return "ĐHQG-HCM";
  if (level === "thanh") return "Thành phố";
  if (level === "quoc_gia") return "Quốc gia";
  if (level === "quoc_te") return "Quốc tế";
  return "Khác / chưa rõ";
}

function formatHoiNhapSubCriteria(value) {
  if (value === "ngoaiNgu") return "Ngoại ngữ";
  if (value === "kyNang") return "Kỹ năng";
  if (value === "hoiNhap") return "Hoạt động hội nhập";
  return "-";
}

function formatAcademicEvidenceType(value) {
  if (value === "hocThuat_3_activities") return "Hoạt động học thuật 1/3";
  if (value === "nghienCuu") return "Nghiên cứu khoa học / khóa luận";
  if (value === "sangTao") return "Ý tưởng sáng tạo / nghiên cứu";
  if (value === "troGiang") return "Trợ giảng";
  if (value === "baiBao") return "Bài báo / tham luận";
  if (value === "doiTuyen") return "Đội tuyển học thuật";
  if (value === "khac_direct") return "Minh chứng học thuật đạt trực tiếp";
  return "-";
}

async function deleteUploadedActivity(activityId) {
  const confirmed = confirm(
    "Bạn có chắc muốn xóa hoạt động này? Tiến độ của sinh viên liên quan sẽ được cập nhật lại nếu đây là hoạt động cấp Trường."
  );

  if (!confirmed) return;

  try {
    const res = await fetch(`/api/admin-dashboard/activities/${activityId}`, {
      method: "DELETE",
      credentials: "include"
    });

    const data = await res.json();

    alert(data.message || "Đã xử lý yêu cầu xóa hoạt động");

    if (data.success) {
      await loadUploadedActivities();

      if (adminRole === "admin" && adminClassName) {
        await loadClassStudents(adminClassName);
        await loadCollectiveProgress(adminClassName);
      }

      if (adminRole === "super_admin") {
        await loadAllCollectiveProgress();
      }
    }
  } catch (error) {
    console.error("Delete uploaded activity error:", error);
    alert("Không thể xóa hoạt động");
  }
}

function formatHoiNhapEvidenceType(value) {
  if (value === "international_exchange") {
    return "Hoạt động giao lưu quốc tế / hội nghị / hội thảo quốc tế";
  }

  if (value === "integration_competition_khoa_or_above") {
    return "Cuộc thi tìm hiểu văn hóa/hội nhập từ cấp Khoa trở lên";
  }

  if (value === "integration_competition_award_truong_or_above") {
    return "Giải Ba trở lên cuộc thi kiến thức hội nhập từ cấp Trường trở lên";
  }

  if (value === "foreign_language_academic_competition_award_truong_or_above") {
    return "Giải Ba trở lên cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên";
  }

  if (value === "official_international_program_member") {
    return "Thành viên chính thức chương trình giao lưu/hợp tác quốc tế";
  }

  if (value === "international_program_volunteer") {
    return "Tình nguyện viên chương trình giao lưu/hợp tác quốc tế";
  }

  if (value === "integration_activity_truong_or_above") {
    return "Hoạt động hội nhập do cấp Trường tổ chức trở lên";
  }

  return "Không áp dụng";
} 

async function generateStudentResetCode() {
  const studentIdInput = document.getElementById("resetStudentIdByAdmin");
  const resultBox = document.getElementById("adminResetResult");

  if (!studentIdInput || !resultBox) return;

  const studentId = studentIdInput.value.trim();

  resultBox.classList.add("hidden");
  resultBox.innerHTML = "";

  if (!studentId) {
    resultBox.classList.remove("hidden");
    resultBox.innerHTML = `
      <p class="msg-error">Vui lòng nhập MSSV cần reset.</p>
    `;
    return;
  }

  try {
    const res = await fetch(
      `/api/admin-dashboard/students/${encodeURIComponent(studentId)}/generate-reset-code`,
      {
        method: "POST",
        credentials: "include"
      }
    );

    const data = await res.json();

    resultBox.classList.remove("hidden");

    if (!data.success) {
      resultBox.innerHTML = `
        <p class="msg-error">${data.message || "Không thể tạo mã reset."}</p>
      `;
      return;
    }

    resultBox.innerHTML = `
      <div class="reset-result-header">
        <h3>Mã reset đã tạo</h3>
        <p>Mã này chỉ hiển thị một lần. Hãy gửi cho đúng sinh viên sau khi xác minh.</p>
      </div>

      <div class="reset-student-info">
        <p><strong>Sinh viên:</strong> ${data.student.fullName}</p>
        <p><strong>MSSV:</strong> ${data.student.studentId}</p>
        <p><strong>Lớp:</strong> ${data.student.className || "Chưa cập nhật"}</p>
      </div>

      <div class="reset-code-display">
        ${data.resetCode}
      </div>

      <p class="helper-text">
        Mã có hiệu lực trong ${data.expiresInMinutes || 10} phút.
      </p>
    `;
  } catch (error) {
    console.error("Generate reset code error:", error);

    resultBox.classList.remove("hidden");
    resultBox.innerHTML = `
      <p class="msg-error">Không thể kết nối server.</p>
    `;
  }
}

async function uploadClassSupportExcel() {
  const fileInput = document.getElementById("classSupportExcelFile");
  const message = document.getElementById("uploadClassSupportMessage");

  if (!message) return;

  message.textContent = "";
  message.className = "";

  if (!fileInput || !fileInput.files[0]) {
    message.textContent = "Vui lòng chọn file Excel.";
    message.className = "status-text-warning";
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  try {
    const res = await fetch("/api/admin-dashboard/upload-class-support", {
      method: "POST",
      body: formData,
      credentials: "include"
    });

    const data = await res.json();

    if (!data.success) {
      const errorText =
        Array.isArray(data.errors) && data.errors.length > 0
          ? data.errors
              .slice(0, 5)
              .map((item, index) => `${index + 1}. ${item.reason}`)
              .join("<br>")
          : "";

      message.innerHTML = `
        ${data.message || "Upload thất bại."}
        ${errorText ? `<br>${errorText}` : ""}
      `;
      message.className = "status-text-warning";
      return;
    }

    fileInput.value = "";

    message.innerHTML = `
      Upload thông tin hỗ trợ lớp thành công.
      <br>
      Đã cập nhật: <strong>${data.updatedCount || 0}</strong> /
      ${data.totalRows || 0} dòng.
    `;
    message.className = "status-text-success";
  } catch (error) {
    console.error("Upload class support error:", error);

    message.textContent = "Không thể kết nối server.";
    message.className = "status-text-warning";
  }
}

async function loadCentralEvidences() {
  try {
    const res = await fetch("/api/admin-dashboard/central-evidences", {
  credentials: "include"
});

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Không thể tải minh chứng Trung ương.");
      return;
    }

    renderCentralEvidenceTable(data.evidences || []);
  } catch (error) {
    console.error("Load central evidences error:", error);
    alert("Không thể kết nối server.");
  }
}

function renderCentralEvidenceTable(evidences) {
  const table = document.getElementById("centralEvidenceTable");

  if (!table) return;

  if (!Array.isArray(evidences) || evidences.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="9">Chưa có minh chứng cấp Trung ương.</td>
      </tr>
    `;
    return;
  }

  table.innerHTML = evidences
    .map((evidence) => {
      const fileUrl = evidence.fileUrl || evidence.url || "#";

      return `
        <tr>
          <td>${escapeHtml(evidence.fullName || evidence.studentName || evidence.student?.fullName || "Chưa cập nhật")}</td>
          <td>${escapeHtml(evidence.studentId || evidence.student?.studentId || "")}</td>
          <td>${escapeHtml(formatCategoryLabel(evidence.category))}</td>
          <td>${escapeHtml(formatCentralEvidenceType(evidence.evidenceType))}</td>
          <td>${escapeHtml(formatAdditionalCriteriaKey(evidence.additionalCriteriaKey))}</td>
          <td>
            ${
              fileUrl && fileUrl !== "#"
                ? `<a href="${fileUrl}" target="_blank" rel="noopener noreferrer">Xem file</a>`
                : "Không có file"
            }
          </td>
          <td>
            ${escapeHtml(formatEvidenceStatus(evidence.status))}
            ${evidence.adminReview?.note ? `<br><small style="color:#92400e;background:#fef3c7;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px">Ghi chú: ${escapeHtml(evidence.adminReview.note)}</small>` : ""}
            ${formatQRVerification(evidence)}
          </td>
          <td>${formatDate(evidence.createdAt)}</td>
          <td>
            ${
              evidence.status === "manual_review"
                ? `
                  <button onclick="reviewCentralEvidence('${evidence._id}', 'approve', this)">
                    Duyệt
                  </button>
                  <button onclick="reviewCentralEvidence('${evidence._id}', 'reject', this)">
                    Không duyệt
                  </button>
                `
                : "Đã xử lý"
            }
          </td>
        </tr>
      `;
    })
    .join("");
}

async function reviewCentralEvidence(evidenceId, action, buttonElement) {
  const note =
    action === "reject"
      ? prompt("Nhập lý do không duyệt minh chứng:")
      : prompt("Ghi chú duyệt minh chứng, có thể bỏ trống:");

  if (action === "reject" && !note) {
    alert("Vui lòng nhập lý do không duyệt.");
    return;
  }

  try {
    const res = await fetch(
      `/api/admin-dashboard/central-evidence/${evidenceId}/review`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action,
          note: note || ""
        })
      }
    );

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Không thể xử lý minh chứng.");
      return;
    }

    updateCentralEvidenceRowAfterReview(buttonElement, action);
  } catch (error) {
    console.error("Review central evidence error:", error);
    alert("Không thể kết nối server.");
  }
}

function updateCentralEvidenceRowAfterReview(buttonElement, action) {
  if (!buttonElement) return;

  const row = buttonElement.closest("tr");

  if (!row) return;

  const statusCell = row.children[6];
  const actionCell = row.children[8];

  if (!statusCell || !actionCell) return;

  if (action === "approve") {
    statusCell.textContent = "Đã duyệt";
    actionCell.innerHTML = `<span class="status-note success">Đã xử lý</span>`;
    return;
  }

  if (action === "reject") {
    statusCell.textContent = "Từ chối";
    actionCell.innerHTML = `<span class="status-note danger">Đã xử lý</span>`;
  }
}

window.reviewCentralEvidence = reviewCentralEvidence;

async function deleteStudent(studentId, className) {
  const confirmed = window.confirm(
    `Bạn có chắc muốn xóa sinh viên ${studentId} không?\n\nHành động này sẽ xóa toàn bộ minh chứng của sinh viên và không thể khôi phục.`
  );

  if (!confirmed) return;

  try {
    const res = await fetch(
      `/api/admin-dashboard/students/${encodeURIComponent(studentId)}`,
      {
        method: "DELETE",
        credentials: "include"
      }
    );

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Không thể xóa sinh viên.");
      return;
    }

    alert(data.message);
    loadClassStudents(className);
  } catch (error) {
    console.error("Delete student error:", error);
    alert("Không thể kết nối server.");
  }
}

window.deleteStudent = deleteStudent;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCategoryLabel(category) {
  return categoryLabels[category] || category || "Chưa cập nhật";
}

function formatCentralEvidenceType(type) {
  const map = {
    central_mandatory: "Tiêu chuẩn bắt buộc",
    central_additional: "Tiêu chí đạt thêm",
    default: "Minh chứng"
  };

  return map[type] || type || "Minh chứng";
}

function formatAdditionalCriteriaKey(key) {
  const map = {
    daoDuc_1: "Đạo đức - Gương tiêu biểu",
    daoDuc_2: "Đạo đức - Đảng viên xuất sắc",

    hocTap_1: "Học tập - Nghiên cứu khoa học",
    hocTap_2: "Học tập - Bài báo WoS/Scopus Q1, Q2",
    hocTap_3: "Học tập - Bài báo WoS/Scopus Q3, Q4",
    hocTap_4: "Học tập - Sản phẩm sáng tạo",
    hocTap_5: "Học tập - Giải học thuật quốc gia/quốc tế",

    theLuc_1: "Thể lực - Giải thể thao từ cấp tỉnh",

    tinhNguyen_1: "Tình nguyện - Dự án tình nguyện",
    tinhNguyen_2: "Tình nguyện - Khen thưởng tình nguyện",

    hoiNhap_1: "Hội nhập - Ban chủ nhiệm CLB ngoại ngữ",
    hoiNhap_2: "Hội nhập - Giải hội nhập/học thuật bằng ngoại ngữ",
    hoiNhap_3: "Hội nhập - Hai ngoại ngữ"
  };

  return map[key] || key || "-";
}

function formatDate(value) {
  return formatDateSafe(value);
}

function toggleUploadMenu() {
  const menu = document.getElementById("uploadDataMenu");
  const arrow = document.getElementById("uploadMenuArrow");

  if (!menu) return;

  menu.classList.toggle("open");

  if (arrow) {
    arrow.textContent = menu.classList.contains("open") ? "▴" : "▾";
  }
}

function openSidebar() {
  document.getElementById("mainSidebar")?.classList.add("open");
  document.getElementById("sidebarOverlay")?.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  document.getElementById("mainSidebar")?.classList.remove("open");
  document.getElementById("sidebarOverlay")?.classList.remove("active");
  document.body.style.overflow = "";
}

window.applyEvidenceFilters = applyEvidenceFilters;
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.toggleUploadMenu = toggleUploadMenu;
window.showAdminTab = showAdminTab;

async function openStudentDetail(studentId) {
  const modal = document.getElementById("studentDetailModal");
  const title = document.getElementById("studentDetailTitle");
  const subtitle = document.getElementById("studentDetailSubtitle");
  const body = document.getElementById("studentDetailBody");

  if (!modal || !body) return;

  modal.classList.remove("hidden");
  currentStudentDetailLevel = "truong";

  title.textContent = "Chi tiết sinh viên";
  subtitle.textContent = `MSSV: ${studentId}`;
  body.innerHTML = "Đang tải dữ liệu...";

  try {
    const res = await fetch(
      `/api/admin-dashboard/students/${encodeURIComponent(studentId)}/sv5t-detail`,
      {
        credentials: "include"
      }
    );

    const data = await res.json();

    if (!data.success) {
      body.innerHTML = `
        <p class="msg-error">${escapeHtml(data.message || "Không thể tải chi tiết sinh viên.")}</p>
      `;
      return;
    }

    renderStudentDetailModal(data);
  } catch (error) {
    console.error("Open student detail error:", error);

    body.innerHTML = `
      <p class="msg-error">Không thể kết nối server.</p>
    `;
  }
}

function closeStudentDetailModal() {
  const modal = document.getElementById("studentDetailModal");

  if (modal) {
    modal.classList.add("hidden");
  }
}

function renderStudentDetailModal(data) {
  currentStudentDetailData = data;

  const title = document.getElementById("studentDetailTitle");
  const subtitle = document.getElementById("studentDetailSubtitle");
  const body = document.getElementById("studentDetailBody");

  const student = data.student || {};
  const details = data.details || {};

  if (title) {
    title.textContent = student.fullName || "Chi tiết sinh viên";
  }

  if (subtitle) {
    subtitle.textContent =
      `MSSV: ${student.studentId || ""} • Lớp: ${student.className || "Chưa cập nhật"} • Tiến độ cấp Trường: ${data.completedCount || 0}/5 (${data.progressPercent || 0}%)`;
  }

  if (!body) return;

  body.innerHTML = `
    ${renderStudentLevelTabs()}

    <div class="student-detail-grid">
      ${Object.keys(categoryLabels)
        .map((category) => {
          return renderStudentCategoryDetail(
            category,
            details[category] || {},
            currentStudentDetailLevel
          );
        })
        .join("")}
    </div>
  `;
}

function renderStudentLevelTabs() {
  const levelList = [
    {
      key: "truong",
      label: "Cấp Trường"
    },
    {
      key: "dhqg",
      label: "Cấp ĐHQG-HCM"
    },
    {
      key: "thanh",
      label: "Cấp Thành phố"
    },
    {
      key: "trung_uong",
      label: "Cấp Trung ương"
    }
  ];

  return `
    <div class="student-level-tabs">
      ${levelList
        .map((level) => {
          const active = currentStudentDetailLevel === level.key;

          return `
            <button
              type="button"
              class="student-level-tab ${active ? "active" : ""}"
              onclick="setStudentDetailLevel('${level.key}')"
            >
              ${escapeHtml(level.label)}
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function setStudentDetailLevel(level) {
  currentStudentDetailLevel = level;

  if (currentStudentDetailData) {
    renderStudentDetailModal(currentStudentDetailData);
  }
}

window.setStudentDetailLevel = setStudentDetailLevel;

function renderLevelProgress(levels = {}) {
  const levelList = [
    {
      key: "truong",
      label: "Cấp Trường"
    },
    {
      key: "dhqg",
      label: "Cấp ĐHQG-HCM"
    },
    {
      key: "thanh",
      label: "Cấp Thành phố"
    },
    {
      key: "trung_uong",
      label: "Cấp Trung ương"
    }
  ];

  return `
    <div class="student-level-progress">
      ${levelList
        .map((level) => {
          const item = levels[level.key] || {};
          const completed = item.isCompleted === true;

          return `
            <div class="student-level-chip ${completed ? "completed" : "missing"}">
              <span class="student-level-name">${escapeHtml(level.label)}</span>
              <span class="student-level-status">
                ${completed ? "Đạt" : "Chưa đạt"}
              </span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderStudentCategoryDetail(category, detail, selectedLevel = "truong") {
  if (category === "khac") {
  return renderStudentOtherEvidenceDetail(detail, selectedLevel);
}

  const levelData = detail.levels?.[selectedLevel] || {};
  const isCompleted = levelData.isCompleted === true;

  return `
    <div class="student-category-card ${isCompleted ? "completed" : "missing"}">
      <div class="student-category-header">
        <div>
          <h3>${escapeHtml(categoryLabels[category] || category)}</h3>
          <p class="student-category-level-label">
            ${escapeHtml(levelData.label || formatModalAwardLevel(selectedLevel))}
          </p>
        </div>

        <span class="status-pill ${isCompleted ? "success" : "warning"}">
          ${isCompleted ? "Đạt" : "Chưa đạt"}
        </span>
      </div>

      ${renderSingleLevelDetailBlock(levelData, category)}
    </div>
  `;
}

function renderStudentOtherEvidenceDetail(detail, selectedLevel = "truong") {
  const levelData = detail.levels?.[selectedLevel] || {};
  const approvedEvidences = levelData.approvedEvidences || [];
  const otherEvidences = levelData.otherEvidences || [];
  const allEvidences = [...approvedEvidences, ...otherEvidences];

  return `
    <div class="student-category-card other-evidence-card">
      <div class="student-category-header">
        <div>
          <h3>Khác</h3>
          <p class="student-category-level-label">
            Minh chứng SV5T các năm trước
          </p>
        </div>

        <span class="status-pill neutral">
          Hồ sơ bổ sung
        </span>
      </div>

      <div class="student-level-detail-card single-level-card">
        <div class="student-level-detail-content">
          <div class="student-level-section">
            <h6>Giấy chứng nhận / bằng khen SV5T đã nộp</h6>

            ${
              allEvidences.length > 0
                ? allEvidences.map(renderOtherStudentEvidenceItem).join("")
                : `<p class="empty-note">Chưa có minh chứng khác.</p>`
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderOtherStudentEvidenceItem(evidence) {
  const ai = evidence.aiResult || {};

  return `
    <div class="student-detail-item other-evidence-item">
      <strong>${escapeHtml(evidence.fileName || "Minh chứng")}</strong>

      <small>
        <br>
        <strong>Trạng thái:</strong> ${escapeHtml(formatEvidenceStatus(evidence.status))}
        <br>
        <strong>AI xác định:</strong> ${escapeHtml(formatOtherAchievementType(ai.sv5tHistoryType || ai.matchedType))}
        <br>
        <strong>Cấp danh hiệu:</strong> ${escapeHtml(formatOtherAchievementLevel(ai.sv5tHistoryLevel))}
        <br>
        <strong>Số năm liền:</strong>
        ${Number(ai.consecutiveYears || 0) > 0 ? ai.consecutiveYears : "Không xác định"}
        <br>
        <strong>Năm:</strong>
        ${
          Array.isArray(ai.sv5tHistoryYears) && ai.sv5tHistoryYears.length > 0
            ? ai.sv5tHistoryYears.map(escapeHtml).join(", ")
            : "Không xác định"
        }
        <br>
        <strong>Đơn vị cấp/khen thưởng:</strong>
        ${escapeHtml(ai.issuer || "Không xác định")}
        <br>
        <strong>Lý do AI:</strong>
        ${escapeHtml(ai.reason || "Chưa có")}
      </small>

      ${
        evidence.fileUrl
          ? `<br><a href="${escapeHtml(evidence.fileUrl)}" target="_blank">Xem file</a>`
          : ""
      }
    </div>
  `;
}

function formatOtherAchievementType(type) {
  const map = {
    sv5t_khoa: "Đạt Sinh viên 5 tốt cấp Khoa",
    sv5t_truong: "Đạt Sinh viên 5 tốt cấp Trường",
    sv5t_khoa_2_nam_lien: "Đạt Sinh viên 5 tốt cấp Khoa 2 năm liền",
    sv5t_khoa_3_nam_lien: "Đạt Sinh viên 5 tốt cấp Khoa 3 năm liền",
    sv5t_khoa_4_nam_lien: "Đạt Sinh viên 5 tốt cấp Khoa 4 năm liền",
    sv5t_truong_2_nam_lien: "Đạt Sinh viên 5 tốt cấp Trường 2 năm liền",
    sv5t_truong_3_nam_lien: "Đạt Sinh viên 5 tốt cấp Trường 3 năm liền",
    sv5t_truong_4_nam_lien: "Đạt Sinh viên 5 tốt cấp Trường 4 năm liền",
    sv5t_dhqg: "Đạt Sinh viên 5 tốt cấp ĐHQG-HCM",
    sv5t_thanh: "Đạt Sinh viên 5 tốt cấp Thành phố",
    sv5t_trung_uong: "Đạt Sinh viên 5 tốt cấp Trung ương",
    bang_khen_giam_doc_dhqg_sv5t_tieu_bieu:
      "Bằng khen của Giám đốc ĐHQG cho Sinh viên 5 tốt tiêu biểu",
    unknown: "Không xác định"
  };

  return map[type] || type || "Không xác định";
}

function formatOtherAchievementLevel(level) {
  const map = {
    khoa: "Cấp Khoa",
    truong: "Cấp Trường",
    dhqg: "Cấp ĐHQG-HCM",
    thanh: "Cấp Thành phố",
    trung_uong: "Cấp Trung ương",
    unknown: "Không xác định"
  };

  return map[level] || level || "Không xác định";
}

function renderSingleLevelDetailBlock(item = {}, category = "") {
  return `
    <div class="student-level-detail-card single-level-card ${item.isCompleted ? "completed" : "missing"}">
      <div class="student-level-detail-header">
        <div>
          <h5>${escapeHtml(item.label || "Cấp xét")}</h5>
          <p>${renderCompletedByText(item.completedBy)}</p>
        </div>

        <span class="student-level-status-pill ${item.isCompleted ? "success" : "warning"}">
          ${item.isCompleted ? "Đạt" : "Chưa đạt"}
        </span>
      </div>

      <div class="student-level-detail-content">
      ${category === "tinhNguyenTot" ? renderVolunteerSummary(item) : ""}
        <div class="student-level-section">
          <h6>Dữ liệu sinh viên tự khai ở cấp này</h6>
          ${renderDeclarationBlock(item.declaration)}
        </div>

        <div class="student-level-section">
          <h6>Hoạt động được tính ở cấp này</h6>
          ${renderActivityList(item.activities || [])}
        </div>

        <div class="student-level-section">
          <h6>Minh chứng đã được duyệt ở cấp này</h6>
          ${renderEvidenceList(item.approvedEvidences || [])}
        </div>

        <div class="student-level-section">
          <h6>Minh chứng khác ở cấp này</h6>
          ${renderEvidenceList(item.otherEvidences || [])}
        </div>

        <div class="student-level-section">
          <h6>Còn thiếu ở cấp này</h6>
          ${renderMissingList(item.missingItems || [])}
        </div>
      </div>
    </div>
  `;
}

function renderVolunteerSummary(item = {}) {
  const progress = item.progress || {};

  const volunteerDays =
    Number(progress.volunteerDays || item.volunteerDays || 0);

  const hasVolunteerAward =
    progress.hasVolunteerAward === true || item.hasVolunteerAward === true;

  return `
    <div class="student-level-section">
      <h6>Tổng quan tình nguyện</h6>

      <div class="volunteer-summary-grid">
        <div class="volunteer-summary-card">
          <span>Số ngày tình nguyện ghi nhận</span>
          <strong>${volunteerDays}</strong>
        </div>

        <div class="volunteer-summary-card">
          <span>Khen thưởng / xác nhận tình nguyện</span>
          <strong>${hasVolunteerAward ? "Có" : "Chưa có"}</strong>
        </div>
      </div>
    </div>
  `;
}

function formatModalAwardLevel(level) {
  if (level === "truong") return "Cấp Trường";
  if (level === "dhqg") return "Cấp ĐHQG-HCM";
  if (level === "thanh") return "Cấp Thành phố";
  if (level === "trung_uong") return "Cấp Trung ương";
  return "Cấp xét";
}

function renderCompletedByText(value) {
  const map = {
    system: "Hoàn thành từ dữ liệu hệ thống",
    activity: "Hoàn thành từ hoạt động admin upload",
    evidence: "Hoàn thành từ minh chứng",
    activity_and_evidence: "Hoàn thành từ hoạt động và minh chứng",
    reference_school: "Tham chiếu từ cấp Trường",
    reference_lower_level: "Tham chiếu từ cấp trước",
    admin_approved_evidence: "Admin đã duyệt minh chứng",
    admin_approved_mandatory_evidence: "Admin đã duyệt minh chứng bắt buộc",
    reference_and_evidence: "Tham chiếu và minh chứng",
    reference_and_activity_or_evidence: "Tham chiếu và hoạt động/minh chứng",
    none: "Chưa có nguồn hoàn thành"
  };

  return escapeHtml(map[value] || "Chưa có nguồn hoàn thành");
}

function renderActivityList(activities) {
  if (!activities || activities.length === 0) {
    return `<p class="empty-note">Chưa có hoạt động được ghi nhận.</p>`;
  }

  return `
    <div class="student-detail-list">
      ${activities
        .map((activity) => {
          return `
            <div class="student-detail-item">
              <strong>${escapeHtml(activity.title || "Hoạt động")}</strong>
              <br>
              <small>
                Cấp tổ chức: ${escapeHtml(formatOrganizerLevel(activity.organizerLevel))}
                • Ngày: ${formatDateSafe(activity.date)}
              </small>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderEvidenceList(evidences) {
  if (!evidences || evidences.length === 0) {
    return `<p class="empty-note">Chưa có minh chứng.</p>`;
  }

  return `
    <div class="student-detail-list">
      ${evidences
        .map((evidence) => {
          const fileUrl = evidence.fileUrl
            ? evidence.fileUrl
            : evidence.filePath
            ? `/${String(evidence.filePath).replace(/\\/g, "/")}`
            : "";

          return `
            <div class="student-detail-item">
              <strong>${escapeHtml(evidence.fileName || "Minh chứng")}</strong>
              <br>
              <small>
                Trạng thái: ${escapeHtml(formatEvidenceStatus(evidence.status))}
                • Ngày nộp: ${formatDateSafe(evidence.createdAt)}
              </small>
              ${evidence.adminReview?.note ? `<br><small style="color:#92400e;background:#fef3c7;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px">Ghi chú admin: ${escapeHtml(evidence.adminReview.note)}</small>` : ""}
              ${formatQRVerification(evidence)}
              ${
                fileUrl
                  ? `<br><a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer">Xem file</a>`
                  : ""
              }
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderMissingList(items) {
  if (!items || items.length === 0) {
    return `<p class="empty-note">Không còn thiếu mục nào trong tiêu chí này.</p>`;
  }

  return `
    <ul class="missing-list">
      ${items
        .map((item) => {
          return `<li>${escapeHtml(item)}</li>`;
        })
        .join("")}
    </ul>
  `;
}

function renderDeclarationBlock(declaration) {
  if (
    !declaration ||
    !Array.isArray(declaration.groups) ||
    declaration.groups.length === 0
  ) {
    return `<p class="empty-note">Chưa có dữ liệu tự khai.</p>`;
  }

  return `
    <div class="student-declaration-card">
      <div class="student-declaration-title">
        ${escapeHtml(declaration.title || "Dữ liệu tự khai")}
      </div>

      <div class="student-declaration-groups">
        ${declaration.groups
          .map((group) => {
            return `
              <div class="student-declaration-group">
                <div class="student-declaration-group-header">
                  <div>
                    <strong>${escapeHtml(formatDeclarationType(group.title))}</strong>
                    <small>
                      ${group.declaredAt ? `Ngày khai: ${formatDateSafe(group.declaredAt)}` : "Chưa cập nhật ngày khai"}
                    </small>
                  </div>

                  <span class="student-level-status-pill ${group.isCompleted ? "success" : "warning"}">
                    ${group.isCompleted ? "Đạt" : "Chưa đạt"}
                  </span>
                </div>

                ${
                  group.reason
                    ? `<p class="student-declaration-reason">${escapeHtml(group.reason)}</p>`
                    : ""
                }

                ${
                  Array.isArray(group.items) && group.items.length > 0
                    ? `
                      <div class="student-declaration-grid">
                        ${group.items
                          .map((item) => {
                            return `
                              <div class="student-declaration-item">
                                <span>${escapeHtml(formatDeclarationLabel(item.label))}</span>
                                <strong>${escapeHtml(formatDeclarationDisplayValue(item.value))}</strong>
                              </div>
                            `;
                          })
                          .join("")}
                      </div>
                    `
                    : `<p class="empty-note">Không có dữ liệu chi tiết.</p>`
                }
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function formatDeclarationType(type) {
  const map = {
    mandatory: "Điều kiện bắt buộc",
    extra: "Điều kiện bổ sung",

    dao_duc_mandatory: "Đạo đức tốt - Điều kiện bắt buộc",
    hoc_tap_mandatory: "Học tập tốt - Điều kiện bắt buộc",

    foreign_language_course_score: "Điểm học phần tiếng Anh",
    foreign_language_certificate: "Chứng chỉ ngoại ngữ",
    foreign_language_basic: "Ngoại ngữ cơ bản",
    foreign_language_extra: "Điều kiện bổ sung ngoại ngữ",

    ky_nang: "Kỹ năng",
    hoi_nhap: "Hoạt động hội nhập",

    volunteer_days: "Số ngày tình nguyện",
    volunteer_award: "Khen thưởng tình nguyện"
  };

  return map[type] || type || "Tự khai";
}

function formatDeclarationLabel(label) {
  const map = {
    trainingScore: "Điểm rèn luyện",
    noLawViolation: "Không vi phạm pháp luật",
    noRuleViolation: "Không vi phạm quy chế/nội quy",
    excellentUnionMember: "Đoàn viên/Hội viên xuất sắc",

    gpa: "GPA",
    gpaScale: "Thang điểm GPA",
    gpaValue: "Điểm GPA",
    studentType: "Loại sinh viên",
    properLearningAttitude: "Thái độ học tập đúng đắn",
    noFailedSubjects: "Không nợ môn",
    noAcademicViolation: "Không vi phạm học thuật",

    scoreScale: "Thang điểm ngoại ngữ",
    scoreValue: "Điểm ngoại ngữ",
    confirmed: "Đã xác nhận",

    foreignLanguageScore: "Điểm học phần ngoại ngữ",
    foreignLanguageCertificate: "Chứng chỉ ngoại ngữ",

    volunteerDays: "Số ngày tình nguyện",
    hasVolunteerAward: "Có khen thưởng/xác nhận tình nguyện"
  };

  return map[label] || label || "Tự khai";
}

function formatDeclarationDisplayValue(value) {
  if (value === true) return "Có";
  if (value === false) return "Không";
  if (value === null || value === undefined || value === "") return "Chưa khai";

  return String(value);
}

window.openStudentDetail = openStudentDetail;
window.closeStudentDetailModal = closeStudentDetailModal;

// ── Overview charts & stats ──────────────────────────────────────────────────

let statusChartInstance = null;
let criteriaChartInstance = null;

const STATUS_LABELS = {
  not_started: "Chưa đăng ký",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  submitted: "Đã nộp hồ sơ",
  approved: "Được duyệt",
  rejected: "Bị từ chối"
};

const STATUS_COLORS = {
  not_started: "#9ca3af",
  in_progress: "#1560c8",
  completed: "#059669",
  submitted: "#d97706",
  approved: "#0b3d91",
  rejected: "#dc2626"
};

const CRITERIA_LABELS = {
  daoDucTot: "Đạo đức tốt",
  hocTapTot: "Học tập tốt",
  theLucTot: "Thể lực tốt",
  tinhNguyenTot: "Tình nguyện tốt",
  hoiNhapTot: "Hội nhập tốt"
};

function renderOverviewCharts(stats) {
  const { totalStudents, activatedStudents, statusBreakdown, criteriaBreakdown } = stats;

  document.getElementById("statTotal").textContent = totalStudents;
  document.getElementById("statActivated").textContent = activatedStudents;
  document.getElementById("statInProgress").textContent =
    (statusBreakdown.in_progress || 0) + (statusBreakdown.submitted || 0) + (statusBreakdown.approved || 0) + (statusBreakdown.rejected || 0);
  document.getElementById("statCompleted").textContent = statusBreakdown.completed || 0;

  document.getElementById("overviewStatCards").classList.remove("hidden");
  document.getElementById("overviewCharts").classList.remove("hidden");

  // Donut — trạng thái
  const statusKeys = Object.keys(statusBreakdown).filter(k => statusBreakdown[k] > 0);
  const statusCtx = document.getElementById("statusChart")?.getContext("2d");
  if (statusCtx) {
    if (statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(statusCtx, {
      type: "doughnut",
      data: {
        labels: statusKeys.map(k => STATUS_LABELS[k] || k),
        datasets: [{
          data: statusKeys.map(k => statusBreakdown[k]),
          backgroundColor: statusKeys.map(k => STATUS_COLORS[k] || "#ccc"),
          borderWidth: 2,
          borderColor: "#fff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: "bottom", labels: { font: { family: "Nunito", size: 13 }, padding: 12 } }
        }
      }
    });
  }

  // Bar — tiêu chí
  const criteriaKeys = Object.keys(criteriaBreakdown);
  const criteriaCtx = document.getElementById("criteriaChart")?.getContext("2d");
  if (criteriaCtx) {
    if (criteriaChartInstance) criteriaChartInstance.destroy();
    criteriaChartInstance = new Chart(criteriaCtx, {
      type: "bar",
      data: {
        labels: criteriaKeys.map(k => CRITERIA_LABELS[k] || k),
        datasets: [{
          label: "Số sinh viên hoàn thành",
          data: criteriaKeys.map(k => criteriaBreakdown[k]),
          backgroundColor: "#1560c8cc",
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { family: "Nunito" } },
            max: totalStudents || undefined
          },
          x: { ticks: { font: { family: "Nunito", size: 12 } } }
        }
      }
    });
  }
}

async function loadOverviewStats() {
  try {
    let url;
    if (adminRole === "super_admin") {
      url = "/api/admin-dashboard/all-students/status-stats";
    } else {
      url = `/api/admin-dashboard/class/${encodeURIComponent(adminClassName)}/overview-stats`;
    }

    const res = await fetch(url, { credentials: "include" });
    const data = await res.json();
    if (data.success) {
      renderOverviewCharts(data);
    }
  } catch (error) {
    console.error("Load overview stats error:", error);
  }
}

async function fixActivatedStudentsStatus() {
  const btn = document.getElementById("fixActivatedBtn");
  const result = document.getElementById("fixActivatedResult");
  if (!btn || !result) return;

  btn.disabled = true;
  btn.textContent = "Đang cập nhật...";
  result.textContent = "";

  try {
    const res = await fetch("/api/admin-dashboard/fix-activated-status", {
      method: "PATCH",
      credentials: "include"
    });
    const data = await res.json();
    if (data.success) {
      result.textContent = data.message;
      result.className = "fix-result-msg fix-result-msg--success";
      loadOverviewStats();
    } else {
      result.textContent = data.message || "Có lỗi xảy ra.";
      result.className = "fix-result-msg fix-result-msg--error";
    }
  } catch (error) {
    result.textContent = "Lỗi kết nối server.";
    result.className = "fix-result-msg fix-result-msg--error";
  } finally {
    btn.disabled = false;
    btn.textContent = "Cập nhật trạng thái hàng loạt";
  }
}

window.fixActivatedStudentsStatus = fixActivatedStudentsStatus;

// ── Maintenance Mode ──────────────────────────────────────────────────────

async function loadMaintenanceStatus() {
  try {
    const res = await fetch("/api/admin-dashboard/maintenance-mode", { credentials: "include" });
    const data = await res.json();
    if (data.success) {
      const toggle = document.getElementById("maintenanceToggle");
      if (toggle) toggle.checked = data.enabled;
      updateMaintenanceDesc(data.enabled);
    }
  } catch (e) {
    console.error("Load maintenance status error:", e);
  }
}

function onMaintenanceToggle(checkbox) {
  const enabled = checkbox.checked;
  checkbox.checked = !enabled;
  const codeBox = document.getElementById("maintenanceCodeBox");
  const codeInput = document.getElementById("maintenanceSecurityCode");
  const codeError = document.getElementById("maintenanceCodeError");
  if (codeBox) { codeBox.style.display = "block"; codeBox.dataset.target = enabled ? "1" : "0"; }
  if (codeError) codeError.style.display = "none";
  if (codeInput) { codeInput.value = ""; codeInput.focus(); }
}

async function confirmMaintenanceEnable() {
  const codeInput = document.getElementById("maintenanceSecurityCode");
  const codeError = document.getElementById("maintenanceCodeError");
  const codeBox = document.getElementById("maintenanceCodeBox");
  const code = codeInput ? codeInput.value.trim() : "";
  const targetEnabled = codeBox?.dataset.target === "1";

  if (!code) {
    if (codeError) { codeError.textContent = "Vui lòng nhập mã bảo mật."; codeError.style.display = "block"; }
    return;
  }

  await applyMaintenanceChange(targetEnabled, code);
}

function cancelMaintenanceEnable() {
  const codeBox = document.getElementById("maintenanceCodeBox");
  const codeInput = document.getElementById("maintenanceSecurityCode");
  const codeError = document.getElementById("maintenanceCodeError");
  if (codeBox) codeBox.style.display = "none";
  if (codeInput) codeInput.value = "";
  if (codeError) codeError.style.display = "none";
}

async function applyMaintenanceChange(enabled, securityCode) {
  const checkbox = document.getElementById("maintenanceToggle");
  const result = document.getElementById("maintenanceResult");
  const codeBox = document.getElementById("maintenanceCodeBox");
  const codeError = document.getElementById("maintenanceCodeError");
  if (checkbox) checkbox.disabled = true;

  try {
    const res = await fetch("/api/admin-dashboard/maintenance-mode", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, securityCode })
    });
    const data = await res.json();
    if (data.success) {
      if (checkbox) checkbox.checked = enabled;
      if (codeBox) codeBox.style.display = "none";
      result.textContent = data.message;
      result.className = "fix-result-msg fix-result-msg--success";
      updateMaintenanceDesc(enabled);
    } else {
      if (enabled && codeError) {
        codeError.textContent = data.message || "Mã bảo mật không đúng.";
        codeError.style.display = "block";
      } else {
        result.textContent = data.message || "Có lỗi xảy ra.";
        result.className = "fix-result-msg fix-result-msg--error";
      }
      if (checkbox) checkbox.checked = !enabled;
    }
  } catch (e) {
    result.textContent = "Lỗi kết nối server.";
    result.className = "fix-result-msg fix-result-msg--error";
    if (checkbox) checkbox.checked = !enabled;
  } finally {
    if (checkbox) checkbox.disabled = false;
    setTimeout(() => { result.textContent = ""; }, 4000);
  }
}

function updateMaintenanceDesc(enabled) {
  const desc = document.getElementById("maintenanceDesc");
  if (!desc) return;
  if (enabled) {
    desc.innerHTML =
      '<strong style="color:var(--red)">Đang bật — sinh viên không thể truy cập hệ thống.</strong> ' +
      'Admin vẫn hoạt động bình thường.';
  } else {
    desc.textContent =
      "Khi bật, sinh viên sẽ thấy trang thông báo bảo trì thay vì truy cập hệ thống. Admin vẫn đăng nhập và quản lý bình thường.";
  }
}

window.onMaintenanceToggle = onMaintenanceToggle;
window.confirmMaintenanceEnable = confirmMaintenanceEnable;
window.cancelMaintenanceEnable = cancelMaintenanceEnable;

// ── Broadcast Push Notification ───────────────────────────────────────────

async function sendBroadcastPush() {
  const btn = document.getElementById("broadcastPushBtn");
  const result = document.getElementById("broadcastPushResult");
  const title = document.getElementById("broadcastTitle").value.trim();
  const body = document.getElementById("broadcastBody").value.trim();
  const url = document.getElementById("broadcastUrl").value.trim();
  const target = document.getElementById("broadcastTarget").value;

  if (!title || !body) {
    result.textContent = "Vui lòng nhập tiêu đề và nội dung thông báo.";
    result.className = "fix-result-msg fix-result-msg--error";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Đang gửi...";
  result.textContent = "";

  try {
    const res = await fetch("/api/admin-dashboard/broadcast-push", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, url: url || undefined, target })
    });
    const data = await res.json();
    if (data.success) {
      result.textContent = data.message;
      result.className = "fix-result-msg fix-result-msg--success";
      document.getElementById("broadcastTitle").value = "";
      document.getElementById("broadcastBody").value = "";
      document.getElementById("broadcastUrl").value = "";
    } else {
      result.textContent = data.message || "Có lỗi xảy ra.";
      result.className = "fix-result-msg fix-result-msg--error";
    }
  } catch (e) {
    result.textContent = "Lỗi kết nối server.";
    result.className = "fix-result-msg fix-result-msg--error";
  } finally {
    btn.disabled = false;
    btn.textContent = "Gửi thông báo";
    setTimeout(() => { result.textContent = ""; }, 6000);
  }
}

window.sendBroadcastPush = sendBroadcastPush;

// ── Class Support List ────────────────────────────────────────────────────

function renderPersonRow(label, person) {
  if (!person || !person.fullName) return "";
  const phone = person.phone ? `<span style="color:var(--text-secondary);margin-left:8px;">📞 ${escapeHtml(person.phone)}</span>` : "";
  const zalo  = person.zalo  ? `<span style="color:var(--text-secondary);margin-left:8px;">Zalo: ${escapeHtml(person.zalo)}</span>`  : "";
  return `<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px;font-size:0.88rem;">
    <span style="min-width:120px;font-weight:600;color:var(--text-secondary);">${label}</span>
    <span>${escapeHtml(person.fullName)}</span>${phone}${zalo}
  </div>`;
}

async function loadClassSupportList() {
  const container = document.getElementById("classSupportListBody");
  if (!container) return;

  try {
    const res = await fetch("/api/admin-dashboard/all-class-support", { credentials: "include" });
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `<p style="color:var(--red);font-size:0.9rem;">${data.message || "Không thể tải dữ liệu."}</p>`;
      return;
    }

    if (!data.list || data.list.length === 0) {
      container.innerHTML = `<p style="color:var(--text-secondary);font-size:0.9rem;">Chưa có thông tin nào được upload.</p>`;
      return;
    }

    container.innerHTML = data.list.map(item => {
      const uyVienRows = (item.uyVienBCHList || [])
        .map((uv, idx) => renderPersonRow(`Ủy viên BCH ${idx + 1}`, uv))
        .join("");
      const updatedAt = item.updatedAt
        ? new Date(item.updatedAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "";

      return `<div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-weight:700;font-size:1rem;">${escapeHtml(item.className)}</span>
          ${updatedAt ? `<span style="font-size:0.8rem;color:var(--text-secondary);">Cập nhật: ${updatedAt}</span>` : ""}
        </div>
        ${renderPersonRow("Chi Hội trưởng", item.chiHoiTruong)}
        ${renderPersonRow("Chi Hội phó", item.chiHoiPho)}
        ${uyVienRows}
        ${renderPersonRow("CTV BCH", item.ctvBCH)}
      </div>`;
    }).join("");
  } catch (e) {
    container.innerHTML = `<p style="color:var(--red);font-size:0.9rem;">Lỗi kết nối server.</p>`;
  }
}

// ── Activity Participants Modal ───────────────────────────────────────────

function openActivityParticipantsModal(activityId) {
  const modal = document.getElementById("activityParticipantsModal");
  const titleEl = document.getElementById("activityParticipantsTitle");
  const countEl = document.getElementById("activityParticipantsCount");
  const thead = document.getElementById("activityParticipantsHead");
  const tbody = document.getElementById("activityParticipantsBody");

  if (!modal) return;

  const entry = _activityParticipantsMap[activityId] || { title: "Không rõ", participants: [], activity: null };
  const { title, participants, activity: act } = entry;

  titleEl.textContent = title;
  countEl.textContent = `${participants.length} sinh viên tham gia`;

  const TH = (label) => `<th style="padding:8px 10px;border-bottom:2px solid var(--border);border-right:1px solid var(--border);white-space:nowrap;background:var(--surface-alt,#f9fafb);font-size:0.82rem;">${label}</th>`;
  const TD = (val, bold) => `<td style="padding:7px 10px;border-bottom:1px solid var(--border);border-right:1px solid var(--border);white-space:nowrap;${bold ? "font-weight:600;" : "color:var(--text-secondary);"}">${escapeHtml(String(val ?? ""))}</td>`;

  const hasSubCriteria     = participants.some(p => p.subCriteria);
  const hasAcademic        = act?.category === "hocTapTot";
  const hasKyNang          = participants.some(p => p.kyNangEvidenceType);
  const hasHoiNhap         = participants.some(p => p.hoiNhapEvidenceType);
  const hasVolunteerDays   = participants.some(p => p.volunteerDays);

  const actDate = act?.date ? new Date(act.date).toLocaleDateString("vi-VN") : "";
  const actOrg  = formatOrganizerLevel(act?.organizerLevel);
  const actCat  = categoryLabels[act?.category] || act?.category || "";

  thead.innerHTML = `<tr>
    ${TH("#")}${TH("MSSV")}${TH("Họ và tên")}${TH("Chi Hội")}
    ${TH("Tên hoạt động")}${TH("Tiêu chí")}${TH("Cấp tổ chức")}${TH("Ngày")}
    ${hasSubCriteria   ? TH("Phân nhóm")          : ""}
    ${hasAcademic      ? TH("Loại học thuật")      : ""}
    ${hasKyNang        ? TH("Loại kỹ năng")        : ""}
    ${hasHoiNhap       ? TH("Loại hội nhập")       : ""}
    ${hasVolunteerDays ? TH("Số ngày TN")          : ""}
  </tr>`;

  if (participants.length === 0) {
    const cols = 8 + [hasSubCriteria, hasAcademic, hasKyNang, hasHoiNhap, hasVolunteerDays].filter(Boolean).length;
    tbody.innerHTML = `<tr><td colspan="${cols}" style="padding:14px 10px;color:var(--text-secondary);">Không có sinh viên nào.</td></tr>`;
  } else {
    tbody.innerHTML = participants.map((p, i) => {
      const bg = i % 2 === 1 ? "background:var(--surface-alt,#f9fafb);" : "";
      return `<tr style="${bg}">
        ${TD(i + 1)}
        ${TD(p.studentId || "—", true)}
        ${TD(p.fullName || "—", true)}
        ${TD(p.className || "—")}
        ${TD(title)}
        ${TD(actCat)}
        ${TD(actOrg)}
        ${TD(actDate)}
        ${hasSubCriteria   ? TD(formatHoiNhapSubCriteria(p.subCriteria))         : ""}
        ${hasAcademic      ? TD(formatAcademicEvidenceType(p.academicEvidenceType)) : ""}
        ${hasKyNang        ? TD(formatKyNangEvidenceType(p.kyNangEvidenceType))   : ""}
        ${hasHoiNhap       ? TD(formatHoiNhapEvidenceType(p.hoiNhapEvidenceType)) : ""}
        ${hasVolunteerDays ? TD(p.volunteerDays ? `${p.volunteerDays} ngày` : "—") : ""}
      </tr>`;
    }).join("");
  }

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeActivityParticipantsModal() {
  const modal = document.getElementById("activityParticipantsModal");
  if (modal) modal.classList.add("hidden");
  document.body.style.overflow = "";
}

window.openActivityParticipantsModal = openActivityParticipantsModal;
window.closeActivityParticipantsModal = closeActivityParticipantsModal;

// ── Edit Activity Modal ────────────────────────────────────────────────────

function openEditActivityModal(activity) {
  document.getElementById("editActivityId").value = activity._id;
  document.getElementById("editActivityTitle").value = activity.title || "";
  document.getElementById("editActivityCategory").value = activity.category || "daoDucTot";
  document.getElementById("editActivityOrganizerLevel").value = activity.organizerLevel || "khac";

  const dateVal = activity.date ? activity.date.slice(0, 10) : "";
  document.getElementById("editActivityDate").value = dateVal;

  document.getElementById("editActivityAcademicType").value = activity.academicEvidenceType || "";
  document.getElementById("editActivityVolunteerDays").value = activity.volunteerDays ?? 0;
  document.getElementById("editActivitySubCriteria").value = activity.subCriteria || "ngoaiNgu";
  document.getElementById("editActivityKyNangType").value = activity.kyNangEvidenceType || "";
  document.getElementById("editActivityHoiNhapType").value = activity.hoiNhapEvidenceType || "";

  document.getElementById("editActivityEligibleInfo").classList.add("hidden");

  onEditCategoryChange();

  document.getElementById("editActivityModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeEditActivityModal() {
  document.getElementById("editActivityModal").classList.add("hidden");
  document.body.style.overflow = "";
}

function onEditCategoryChange() {
  const cat = document.getElementById("editActivityCategory").value;
  document.getElementById("editAcademicGroup").classList.toggle("hidden", cat !== "hocTapTot");
  document.getElementById("editVolunteerGroup").classList.toggle("hidden", cat !== "tinhNguyenTot");
  document.getElementById("editHoiNhapGroup").classList.toggle("hidden", cat !== "hoiNhapTot");
  onEditSubCriteriaChange();
}

function onEditSubCriteriaChange() {
  const cat = document.getElementById("editActivityCategory").value;
  const sub = document.getElementById("editActivitySubCriteria").value;
  const isHoiNhap = cat === "hoiNhapTot";
  document.getElementById("editKyNangGroup").classList.toggle("hidden", !(isHoiNhap && sub === "kyNang"));
  document.getElementById("editHoiNhapTypeGroup").classList.toggle("hidden", !(isHoiNhap && sub === "hoiNhap"));
}

async function saveEditActivity() {
  const id = document.getElementById("editActivityId").value;
  const cat = document.getElementById("editActivityCategory").value;

  const body = {
    title:            document.getElementById("editActivityTitle").value.trim(),
    category:         cat,
    organizerLevel:   document.getElementById("editActivityOrganizerLevel").value,
    date:             document.getElementById("editActivityDate").value
  };

  if (cat === "hocTapTot") {
    body.academicEvidenceType = document.getElementById("editActivityAcademicType").value;
  }
  if (cat === "tinhNguyenTot") {
    body.volunteerDays = Number(document.getElementById("editActivityVolunteerDays").value) || 0;
  }
  if (cat === "hoiNhapTot") {
    const sub = document.getElementById("editActivitySubCriteria").value;
    body.subCriteria = sub;
    if (sub === "kyNang")   body.kyNangEvidenceType  = document.getElementById("editActivityKyNangType").value;
    if (sub === "hoiNhap")  body.hoiNhapEvidenceType = document.getElementById("editActivityHoiNhapType").value;
  }

  const saveBtn = document.querySelector("#editActivityModal .btn-primary");
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Đang lưu..."; }

  try {
    const res = await fetch(`/api/admin-dashboard/activities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (data.success) {
      const info = document.getElementById("editActivityEligibleInfo");
      const levels = (data.eligibleAwardLevels || []).map(l =>
        l === "truong" ? "Cấp Trường" : l === "dhqg" ? "ĐHQG-HCM" : "Thành phố"
      ).join(", ");
      info.textContent = `Đã lưu. Cấp công nhận: ${levels || "Chưa xác định"}`;
      info.className = "edit-eligible-info edit-eligible-info--ok";

      await loadUploadedActivities();
      closeEditActivityModal();
    } else {
      const info = document.getElementById("editActivityEligibleInfo");
      info.textContent = data.message || "Lưu thất bại.";
      info.className = "edit-eligible-info edit-eligible-info--err";
    }
  } catch (err) {
    console.error("Save edit activity error:", err);
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Lưu thay đổi"; }
  }
}

window.openEditActivityModal = openEditActivityModal;
window.closeEditActivityModal = closeEditActivityModal;
window.onEditCategoryChange = onEditCategoryChange;
window.onEditSubCriteriaChange = onEditSubCriteriaChange;
window.saveEditActivity = saveEditActivity;

// ===============================
// CHECK-IN HOẠT ĐỘNG
// ===============================

let activeCheckinSessionId = null;
let checkinScannerRunning = false;
let currentFacingMode = "environment";

async function loadCheckinSessions() {
  try {
    const res = await fetch("/api/admin-dashboard/checkin/sessions", { credentials: "include" });
    const data = await res.json();

    const list = document.getElementById("checkinSessionList");
    if (!list) return;

    if (!data.sessions || data.sessions.length === 0) {
      list.innerHTML = '<p style="color:var(--gray-500);font-size:0.85rem;">Chưa có phiên nào.</p>';
      return;
    }

    list.innerHTML = data.sessions.map((s) => `
      <div class="checkin-session-item ${s._id === activeCheckinSessionId ? "active" : ""}" onclick="selectCheckinSession('${s._id}', ${JSON.stringify(s.title).replace(/"/g, '&quot;')}, ${JSON.stringify(s.description || "").replace(/"/g, '&quot;')})">
        <div style="font-weight:600;font-size:0.9rem;">${s.title}</div>
        ${s.description ? `<div style="font-size:0.8rem;color:var(--gray-500);">${s.description}</div>` : ""}
        <div style="font-size:0.78rem;color:var(--gray-400);margin-top:2px;">${new Date(s.createdAt).toLocaleString("vi-VN")}</div>
      </div>
    `).join("");
  } catch (error) {
    console.error("Load checkin sessions error:", error);
  }
}

async function createCheckinSession() {
  const title = document.getElementById("checkinSessionTitle").value.trim();
  const description = document.getElementById("checkinSessionDesc").value.trim();
  const msg = document.getElementById("createCheckinMsg");

  msg.textContent = "";
  msg.className = "checkin-msg";

  if (!title) {
    msg.textContent = "Vui lòng nhập tên phiên.";
    msg.classList.add("checkin-msg-error");
    return;
  }

  try {
    const res = await fetch("/api/admin-dashboard/checkin/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title, description })
    });
    const data = await res.json();

    if (!data.success) {
      msg.textContent = data.message || "Tạo phiên thất bại.";
      msg.classList.add("checkin-msg-error");
      return;
    }

    document.getElementById("checkinSessionTitle").value = "";
    document.getElementById("checkinSessionDesc").value = "";
    msg.textContent = "Tạo phiên thành công!";
    msg.classList.add("checkin-msg-success");

    await loadCheckinSessions();
    selectCheckinSession(data.session._id, data.session.title, data.session.description || "");
  } catch (error) {
    console.error("Create checkin session error:", error);
    msg.textContent = "Lỗi kết nối.";
    msg.classList.add("checkin-msg-error");
  }
}

async function selectCheckinSession(id, title, description) {
  stopCheckinScanner();
  activeCheckinSessionId = id;

  document.getElementById("checkinActiveTitle").textContent = title;
  document.getElementById("checkinActiveDesc").textContent = description;
  document.getElementById("checkinActivePanel").classList.remove("hidden");
  document.getElementById("checkinNoSession").classList.add("hidden");
  document.getElementById("checkinScanMsg").textContent = "";

  await loadCheckinSessions();
  await loadCheckinRecords();
}

async function loadCheckinRecords() {
  if (!activeCheckinSessionId) return;

  try {
    const res = await fetch(`/api/admin-dashboard/checkin/sessions/${activeCheckinSessionId}`, { credentials: "include" });
    const data = await res.json();

    if (!data.success) return;

    const checkins = data.session.checkins || [];
    const badge = document.getElementById("checkinCount");
    badge.textContent = `${checkins.length} sinh viên`;

    const tbody = document.getElementById("checkinRecordBody");
    if (checkins.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:12px;color:var(--gray-500);text-align:center;">Chưa có ai check-in.</td></tr>';
      return;
    }

    const sorted = [...checkins].sort((a, b) => new Date(b.checkinAt) - new Date(a.checkinAt));
    tbody.innerHTML = sorted.map((c, i) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid var(--gray-200);">${checkins.length - i}</td>
        <td style="padding:8px;border-bottom:1px solid var(--gray-200);font-family:monospace;">${c.studentId}</td>
        <td style="padding:8px;border-bottom:1px solid var(--gray-200);font-weight:500;">${c.fullName}</td>
        <td style="padding:8px;border-bottom:1px solid var(--gray-200);">${c.className}</td>
        <td style="padding:8px;border-bottom:1px solid var(--gray-200);color:var(--gray-500);font-size:0.83rem;">${new Date(c.checkinAt).toLocaleString("vi-VN")}</td>
      </tr>
    `).join("");
  } catch (error) {
    console.error("Load checkin records error:", error);
  }
}

async function processCheckin(studentId) {
  if (!activeCheckinSessionId || !studentId?.trim()) return;

  const msg = document.getElementById("checkinScanMsg");

  try {
    const res = await fetch(`/api/admin-dashboard/checkin/sessions/${activeCheckinSessionId}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ studentId: studentId.trim() })
    });
    const data = await res.json();

    msg.className = "checkin-msg";

    if (!data.success) {
      msg.textContent = data.message || "Check-in thất bại.";
      msg.classList.add("checkin-msg-error");
      return;
    }

    const c = data.checkin;
    msg.textContent = `✓ ${c.fullName} (${c.studentId}) — ${c.className}`;
    msg.classList.add("checkin-msg-success");

    if (navigator.vibrate) navigator.vibrate(150);
    msg.classList.add("checkin-shake");
    setTimeout(() => msg.classList.remove("checkin-shake"), 400);

    await loadCheckinRecords();
  } catch (error) {
    console.error("Checkin scan error:", error);
    msg.textContent = "Lỗi kết nối.";
    msg.className = "checkin-msg checkin-msg-error";
  }
}

function exportCheckinExcel() {
  if (!activeCheckinSessionId) return;
  window.open(`/api/admin-dashboard/checkin/sessions/${activeCheckinSessionId}/export`, "_blank");
}

async function doManualCheckin() {
  const input = document.getElementById("checkinManualInput");
  const studentId = input.value.trim();
  if (!studentId) return;

  await processCheckin(studentId);
  input.value = "";
  input.focus();
}

function startCheckinScanner() {
  if (checkinScannerRunning) return;

  const wrap = document.getElementById("checkinScannerWrap");
  const off = document.getElementById("checkinScannerOff");

  wrap.classList.remove("hidden");
  off.style.display = "none";

  const config = {
    inputStream: {
      type: "LiveStream",
      target: document.getElementById("checkinScannerViewport"),
      constraints: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      // Chỉ xử lý vùng giữa frame, giảm nhiễu từ background
      area: { top: "20%", right: "5%", bottom: "20%", left: "5%" }
    },
    locator: {
      patchSize: "medium",  // "small" nhanh hơn nhưng kém hơn với barcode nhỏ
      halfSample: true
    },
    decoder: {
      readers: ["code_128_reader"]  // JsBarcode dùng Code128 — chỉ cần reader này
    },
    frequency: 12,  // xử lý 12 frame/giây, đủ nhanh mà không tốn CPU
    locate: true
  };

  // Xác nhận đa frame: chỉ commit sau khi cùng 1 mã xuất hiện CONFIRM_NEEDED lần liên tiếp
  const CONFIRM_NEEDED = 3;
  // Sau khi đã check-in thành công, bỏ qua cùng mã trong COOLDOWN ms
  const COOLDOWN_MS = 3000;

  let detectionBuffer = [];
  let lastConfirmed = "";
  let lastConfirmedTime = 0;

  Quagga.init(config, (err) => {
    if (err) {
      console.error("Quagga init error:", err);
      // Ẩn wrap bất kể checkinScannerRunning vì init chưa kịp set flag
      document.getElementById("checkinScannerWrap").classList.add("hidden");
      document.getElementById("checkinScannerOff").style.display = "flex";
      document.getElementById("switchCamBtn")?.classList.add("hidden");
      const msg = document.getElementById("checkinScanMsg");
      msg.textContent = "Không thể bật camera. Vui lòng dùng nhập thủ công.";
      msg.className = "checkin-msg checkin-msg-error";
      return;
    }

    Quagga.start();
    checkinScannerRunning = true;

    // Hiện nút switch nếu thiết bị có nhiều camera
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      const videoCams = devices.filter((d) => d.kind === "videoinput");
      const btn = document.getElementById("switchCamBtn");
      if (btn) btn.classList.toggle("hidden", videoCams.length < 2);
    }).catch(() => {});

    Quagga.onDetected((result) => {
      const code = result?.codeResult?.code;
      if (!code) return;

      // Lọc theo error rate trung bình từng ký tự — bỏ qua đọc có chất lượng thấp
      const charErrors = (result.codeResult.decodedCodes || [])
        .filter((c) => c.error !== undefined)
        .map((c) => c.error);
      if (charErrors.length > 0) {
        const avgError = charErrors.reduce((a, b) => a + b, 0) / charErrors.length;
        if (avgError > 0.12) return;
      }

      // Rolling buffer xác nhận đa frame
      detectionBuffer.push(code);
      if (detectionBuffer.length > CONFIRM_NEEDED) detectionBuffer.shift();

      const confirmed = detectionBuffer.length === CONFIRM_NEEDED
        && detectionBuffer.every((c) => c === code);

      if (!confirmed) return;

      detectionBuffer = [];

      // Cooldown sau khi đã xử lý mã này gần đây
      const now = Date.now();
      if (code === lastConfirmed && now - lastConfirmedTime < COOLDOWN_MS) return;

      lastConfirmed = code;
      lastConfirmedTime = now;

      processCheckin(code);
    });
  });
}

function stopCheckinScanner() {
  if (!checkinScannerRunning) return;

  Quagga.stop();
  checkinScannerRunning = false;

  document.getElementById("checkinScannerWrap").classList.add("hidden");
  document.getElementById("checkinScannerOff").style.display = "flex";

  const btn = document.getElementById("switchCamBtn");
  if (btn) btn.classList.add("hidden");
}

function switchCheckinCamera() {
  currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
  Quagga.stop();
  checkinScannerRunning = false;
  startCheckinScanner();
}

async function logoutAdmin() {
  stopCheckinScanner();

  try {
    await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "include"
    });
  } catch (error) {
    console.error("Logout admin error:", error);
  }

  localStorage.removeItem("adminUsername");
  localStorage.removeItem("adminRole");
  localStorage.removeItem("adminClassName");
  localStorage.removeItem("adminLoggedIn");

  window.location.href = "/admin.html";
}