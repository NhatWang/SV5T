let adminUsername = "";
let adminRole = "";
let adminClassName = "";

const categoryLabels = {
  daoDucTot: "Đạo đức tốt",
  hocTapTot: "Học tập tốt",
  theLucTot: "Thể lực tốt",
  tinhNguyenTot: "Tình nguyện tốt",
  hoiNhapTot: "Hội nhập tốt"
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
  if (status === "need_more_info") return "Cần bổ sung";
  return status || "Chưa cập nhật";
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

  const tab = document.getElementById(tabId);

  if (tab) {
    tab.classList.add("active");
  }

  if (button) {
    button.classList.add("active");
  }
}

function setupSuperAdminView() {
  const studentsTabBtn = document.getElementById("studentsTabBtn");
  const studentsTab = document.getElementById("students");

  if (studentsTabBtn) {
    studentsTabBtn.style.display = "none";
    studentsTabBtn.classList.remove("active");
  }

  if (studentsTab) {
    studentsTab.classList.remove("active");
  }

  const overviewBtn = document.getElementById("overviewTabBtn");
  showAdminTab("overview", overviewBtn);
}

function initAdminDashboard() {
  const adminInfo = document.getElementById("adminInfo");

  if (adminInfo) {
    adminInfo.textContent =
      adminRole === "super_admin"
        ? `Super Admin: ${adminUsername}`
        : `Admin lớp: ${adminClassName}`;
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
  }

  if (adminRole === "super_admin") {
    document.getElementById("overviewTitle").textContent =
      "Tổng quan Liên chi Hội";

    document.getElementById("overviewDescription").textContent =
      "Bạn có thể xem tiến độ tập thể các lớp, duyệt minh chứng toàn khoa, upload sinh viên và upload hoạt động.";

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

    loadClassSummary();
    loadAllEvidences();
    loadAllCollectiveProgress();
    loadUploadedActivities();
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

    if (!data.success || data.students.length === 0) {
      table.innerHTML = `<tr><td colspan="5">Chưa có sinh viên trong lớp này.</td></tr>`;
      return;
    }

    data.students.forEach((student) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${student.studentId}</td>
        <td>${student.fullName}</td>
        <td>${student.className}</td>
        <td>${student.totalCompletedCriteria}/5 (${student.progressPercent}%)</td>
        <td>${formatSv5tStatus(student.sv5tStatus)}</td>
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

async function loadClassSummary() {
  try {
    const res = await fetch("/api/admin-dashboard/classes/summary", {
      credentials: "include"
    });

    const data = await res.json();
    const table = document.getElementById("classSummaryTable");

    if (!table) return;

    table.innerHTML = "";

    if (!data.success || data.summaries.length === 0) {
      table.innerHTML = `<tr><td colspan="5">Chưa có dữ liệu lớp.</td></tr>`;
      return;
    }

    data.summaries.forEach((item) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${item.className}</td>
        <td>${item.totalStudents}</td>
        <td>${item.completedStudents}</td>
        <td>${item.completedPercent}%</td>
        <td>
          ${
            item.collectiveProgress?.isCollectiveAchieved
              ? `<span class="status-note success">Đạt</span>`
              : `<span class="status-note warning">Chưa đạt</span>`
          }
        </td>
      `;

      table.appendChild(row);
    });
  } catch (error) {
    console.error("Load class summary error:", error);
  }
}

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

    renderEvidencesTable(data.evidences || []);
  } catch (error) {
    console.error("Load evidences error:", error);
    alert("Không thể kết nối server khi tải minh chứng.");
  }
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

      <td>${formatEvidenceStatus(evidence.status)}</td>

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

function renderEvidenceActions(evidence) {
  if (evidence.status === "approved_by_admin") {
    return `
      <span class="status-note success">Đã duyệt</span>
    `;
  }

  if (evidence.status === "rejected_by_admin") {
    return `
      <span class="status-note danger">Đã từ chối</span>
    `;
  }

  if (evidence.status === "pending") {
    return `
      <span class="status-note warning">AI đang kiểm tra</span>
    `;
  }

  return `
    <button onclick="reviewEvidence('${evidence._id}', 'approved_by_admin')">
      Duyệt
    </button>

    <button onclick="reviewEvidence('${evidence._id}', 'rejected_by_admin')">
      Từ chối
    </button>

    <button onclick="reviewEvidence('${evidence._id}', 'need_more_info')">
      Bổ sung
    </button>
  `;
}

async function reviewEvidence(evidenceId, status) {
  const note = prompt("Nhập ghi chú duyệt minh chứng:", "");

  try {
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
          reviewedBy: adminUsername
        })
      }
    );

    const data = await res.json();

    alert(data.message || "Đã xử lý minh chứng.");

    if (!data.success) return;

    await loadAllEvidences();

    if (adminRole === "admin" && adminClassName) {
      await loadClassStudents(adminClassName);
      await loadCollectiveProgress(adminClassName);
    }

    if (adminRole === "super_admin") {
      await loadClassSummary();
      await loadAllCollectiveProgress();
    }
  } catch (error) {
    console.error("Review evidence error:", error);
    alert("Không thể duyệt minh chứng");
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

    message.textContent =
      `${data.message}. Thêm mới: ${data.inserted || 0}, cập nhật: ${data.updated || 0}`;

    if (data.success) {
      fileInput.value = "";

      if (adminRole === "admin" && adminClassName) {
        loadClassStudents(adminClassName);
        loadCollectiveProgress(adminClassName);
      }

      if (adminRole === "super_admin") {
        loadClassSummary();
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
      await loadClassSummary();
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
      await loadClassSummary();
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

      row.innerHTML = `
  <td>${activity.title || "Không rõ"}</td>

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
    <button
      class="danger-btn"
      onclick="deleteUploadedActivity('${activity._id}')"
    >
      Xóa
    </button>
  </td>
`;

      table.appendChild(row);
    });
  } catch (error) {
    console.error("Load uploaded activities error:", error);
  }
}

function formatOrganizerLevel(level) {
  if (level === "bo_mon") return "Bộ môn";
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
        await loadClassSummary();
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

async function logoutAdmin() {
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