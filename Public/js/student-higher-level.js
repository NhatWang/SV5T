let currentStudent = null;
let studentId = "";
let autoRefreshIntervalId = null;

const params = new URLSearchParams(window.location.search);
let currentAwardLevel = params.get("level") || "dhqg";

if (!["dhqg", "thanh"].includes(currentAwardLevel)) {
  currentAwardLevel = "dhqg";
}

const awardLevelLabels = {
  dhqg: "Cấp ĐHQG-HCM",
  thanh: "Cấp Thành phố Hồ Chí Minh"
};

const categories = [
  "daoDucTot",
  "hocTapTot",
  "theLucTot",
  "tinhNguyenTot",
  "hoiNhapTot"
];

const uploadCategories = [
  "hocTapTot",
  "theLucTot",
  "tinhNguyenTot",
  "hoiNhapTot"
];

const categoryLabels = {
  daoDucTot: "Đạo đức tốt",
  hocTapTot: "Học tập tốt",
  theLucTot: "Thể lực tốt",
  tinhNguyenTot: "Tình nguyện tốt",
  hoiNhapTot: "Hội nhập tốt"
};

checkStudentSession();

function startAutoRefreshDashboard() {
  if (autoRefreshIntervalId) {
    clearInterval(autoRefreshIntervalId);
  }

  autoRefreshIntervalId = setInterval(() => {
    loadHigherLevelDashboard();
  }, 5 * 60 * 1000);
}

async function checkStudentSession() {
  try {
    const res = await fetch("/api/student/me", {
      method: "GET",
      credentials: "include"
    });

    const data = await res.json();

    if (!data.success) {
      window.location.href = "/student.html";
      return;
    }

    currentStudent = data.student;
    studentId = data.student.studentId;

    setupPageTitle();

    await loadHigherLevelDashboard();
    startAutoRefreshDashboard();
  } catch (error) {
    console.error("Check student session error:", error);
    window.location.href = "/student.html";
  }
}

function setupPageTitle() {
  const label = awardLevelLabels[currentAwardLevel];

  const title = document.getElementById("higherLevelTitle");
  if (title) {
    title.textContent = `Xét danh hiệu Sinh viên 5 tốt ${label}`;
  }

  const progressTitle = document.getElementById("higherProgressTitle");
  if (progressTitle) {
    progressTitle.textContent = `Tiến độ xét ${label}`;
  }

  document.title = `Xét SV5T ${label}`;
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

function showTab(tabId, button) {
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  const selectedTab = document.getElementById(tabId);

  if (selectedTab) {
    selectedTab.classList.add("active");
  }

  if (button) {
    button.classList.add("active");
  }

  if (window.innerWidth <= 768) closeSidebar();
}

async function loadHigherLevelDashboard() {
  try {
    const res = await fetch(
      `/api/student-dashboard/me/higher-level?level=${currentAwardLevel}`,
      {
        credentials: "include"
      }
    );

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Không thể tải dashboard cấp cao hơn");
      window.location.href = "/student-dashboard.html";
      return;
    }

    renderOverview(data);
    renderCentralPrerequisiteCard(data);
    renderCriterionTabs(data);
    renderStorage(data.evidences || []);
  } catch (error) {
    console.error("Load higher level dashboard error:", error);
    alert("Không thể kết nối server");
  }
}

function renderOverview(data) {
  const student = data.student || {};

  const studentName = document.getElementById("studentName");
  const studentIdText = document.getElementById("studentIdText");
  const classNameText = document.getElementById("classNameText");

  if (studentName) studentName.textContent = student.fullName || "Chưa cập nhật";
  if (studentIdText) studentIdText.textContent = student.studentId || "";
  if (classNameText) classNameText.textContent = student.className || "Chưa cập nhật";

  const schoolLevelStatus = document.getElementById("schoolLevelStatus");

  if (schoolLevelStatus) {
    if (data.schoolLevelCompleted) {
      schoolLevelStatus.innerHTML =
        "Đã đạt Sinh viên 5 tốt cấp Trường. Bạn có thể tiếp tục xét cấp cao hơn.";
      schoolLevelStatus.className = "status-text-success";
    } else {
      schoolLevelStatus.innerHTML =
        "Bạn chưa đạt đủ 5/5 tiêu chí cấp Trường nên chưa đủ điều kiện xét cấp cao hơn.";
      schoolLevelStatus.className = "status-text-warning";
    }
  }

  const progressFill = document.getElementById("progressFill");
  if (progressFill) {
    progressFill.style.width = `${data.progressPercent || 0}%`;
  }

  const progressText = document.getElementById("progressText");
  if (progressText) {
    progressText.textContent =
      `${data.completedCount || 0}/5 tiêu chí đã đạt (${data.progressPercent || 0}%)`;
  }

  const aiSuggestions = document.getElementById("aiSuggestions");

  if (!aiSuggestions) return;

  aiSuggestions.innerHTML = "";

  if (!data.aiSuggestions || data.aiSuggestions.length === 0) {
    aiSuggestions.innerHTML = "<li>Chưa có gợi ý mới.</li>";
    return;
  }

  data.aiSuggestions.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = parseAISuggestionMarkdown(item.message);
    aiSuggestions.appendChild(li);
  });
}

function parseAISuggestionMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

function renderCentralPrerequisiteCard(data) {
  const card = document.getElementById("centralPrerequisiteCard");
  const content = document.getElementById("centralPrerequisiteContent");

  if (!card || !content) return;

  if (currentAwardLevel !== "thanh") {
    card.classList.add("hidden");
    return;
  }

  card.classList.remove("hidden");

  const central = data.centralPrerequisites || {};

  const hasProvincialAward =
    central.hasProvincialAward?.isApproved === true;

  const canProceedToCentral =
    central.canProceedToCentral === true || hasProvincialAward;

  content.innerHTML = `
  <div class="activity-item">
    ${hasProvincialAward ? "Đạt" : "Chưa đạt"}
    <strong>Đã đạt danh hiệu Sinh viên 5 tốt cấp tỉnh/cấp Thành phố:</strong>
    ${
      hasProvincialAward
        ? "Hệ thống tự động xác định vì bạn đã hoàn thành 5/5 tiêu chí cấp Thành phố."
        : "Bạn chưa hoàn thành đủ 5/5 tiêu chí cấp Thành phố."
    }
  </div>

  <p class="${
    canProceedToCentral ? "status-text-success" : "status-text-warning"
  }">
    ${
      canProceedToCentral
        ? "Bạn đã đủ điều kiện đầu vào để tiếp tục chuẩn bị hồ sơ cấp Trung ương."
        : "Bạn chưa đủ điều kiện đầu vào để chuyển sang xét cấp Trung ương."
    }
  </p>

  ${
    canProceedToCentral
      ? `
        <button class="primary-btn" onclick="goToCentralLevelPage()">
          Xét SV5T cấp Trung ương
        </button>
      `
      : ""
  }
`;
}
/**
 * Dữ liệu Đạo đức/GPA cấp cao hơn được suy ra từ dữ liệu đã khai ở cấp Trường.
 * Backend nên trả:
 * schoolSelfDeclarations: {
 *   daoDucTot: {...},
 *   hocTapTot: {...}
 * }
 * derivedSelfDeclarationResults: {
 *   daoDucTot: {...},
 *   hocTapTot: {...}
 * }
 */
function getSchoolDeclaration(data, category) {
  if (!data.schoolSelfDeclarations) return null;
  return data.schoolSelfDeclarations[category] || null;
}

function getDerivedSelfDeclarationResult(data, category) {
  if (!data.derivedSelfDeclarationResults) return null;
  return data.derivedSelfDeclarationResults[category] || null;
}

function renderDerivedSelfDeclarationInfo(data, category) {
  const schoolDeclaration = getSchoolDeclaration(data, category);
  const derivedResult = getDerivedSelfDeclarationResult(data, category);

  if (!schoolDeclaration || !schoolDeclaration.data) {
    return `
      <div class="self-declare-info">
        <p><strong>Dữ liệu lấy từ cấp Trường:</strong></p>
        <p class="status-text-warning">
          Chưa có dữ liệu tự khai ở cấp Trường cho tiêu chí này.
        </p>
      </div>
    `;
  }

  const declaredAt = schoolDeclaration.declaredAt
    ? formatDate(schoolDeclaration.declaredAt)
    : "Chưa cập nhật";

  if (category === "daoDucTot") {
    const trainingScore = schoolDeclaration.data.trainingScore;

    return `
      <div class="self-declare-info">
        <p><strong>Dữ liệu lấy từ cấp Trường:</strong></p>

        <ul>
          <li>Điểm rèn luyện đã khai: <strong>${trainingScore ?? "Chưa khai"}/100</strong></li>
          <li>Không vi phạm pháp luật/quy chế: <strong>${
            schoolDeclaration.data.noLawViolation && schoolDeclaration.data.noRuleViolation
              ? "Có"
              : "Chưa xác nhận"
          }</strong></li>
          <li>Đoàn viên/Hội viên hoàn thành xuất sắc: <strong>${
            schoolDeclaration.data.excellentUnionMember ? "Có" : "Chưa đạt"
          }</strong></li>
          <li>Ngày khai ở cấp Trường: <strong>${declaredAt}</strong></li>
        </ul>

        <p class="${derivedResult?.isCompleted ? "status-text-success" : "status-text-warning"}">
          ${derivedResult?.reason || "Chưa có kết quả đánh giá theo cấp hiện tại."}
        </p>
      </div>
    `;
  }

  if (category === "hocTapTot") {
    const gpaScale = schoolDeclaration.data.gpaScale || "";
    const gpaValue = schoolDeclaration.data.gpaValue;

    return `
      <div class="self-declare-info">
        <p><strong>Dữ liệu lấy từ cấp Trường:</strong></p>

        <ul>
          <li>GPA đã khai: <strong>${gpaValue ?? "Chưa khai"}/${gpaScale === "10" ? "10" : "4.0"}</strong></li>
          <li>Không nợ môn/học phần/tín chỉ: <strong>${
            schoolDeclaration.data.noFailedSubjects ? "Có" : "Chưa xác nhận"
          }</strong></li>
          <li>Không gian lận trong thi cử: <strong>${
            schoolDeclaration.data.noAcademicViolation ? "Có" : "Chưa xác nhận"
          }</strong></li>
          <li>Thái độ học tập đúng đắn: <strong>${
            schoolDeclaration.data.properLearningAttitude ? "Có" : "Chưa xác nhận"
          }</strong></li>
          <li>Ngày khai ở cấp Trường: <strong>${declaredAt}</strong></li>
        </ul>

        <p class="${derivedResult?.isCompleted ? "status-text-success" : "status-text-warning"}">
          ${derivedResult?.reason || "Chưa có kết quả đánh giá theo cấp hiện tại."}
        </p>
      </div>
    `;
  }

  return "";
}

function renderDerivedNgoaiNguCourseScoreInfo(data) {
  const declaration =
    data.schoolSelfDeclarations?.ngoaiNguCourseScore || null;

  const result =
    data.derivedSelfDeclarationResults?.ngoaiNguCourseScore || null;

  if (!declaration || !declaration.data) {
    return `
      <div class="self-declare-info">
        <p><strong>Dữ liệu lấy từ cấp Trường:</strong></p>
        <p class="status-text-warning">
          Chưa có dữ liệu điểm học phần ngoại ngữ đã khai ở cấp Trường.
        </p>
      </div>
    `;
  }

  const scoreScale = declaration.data.scoreScale || "4";
  const scoreValue = declaration.data.scoreValue;

  const declaredAt = declaration.declaredAt
    ? formatDate(declaration.declaredAt)
    : "Chưa cập nhật";

  return `
    <div class="self-declare-info">
      <p><strong>Dữ liệu điểm ngoại ngữ lấy từ cấp Trường:</strong></p>

      <ul>
        <li>Hệ điểm đã khai: <strong>${scoreScale === "10" ? "Hệ 10" : "Hệ 4.0"}</strong></li>
        <li>Điểm học phần ngoại ngữ: <strong>${scoreValue ?? "Chưa khai"}/${scoreScale === "10" ? "10" : "4.0"}</strong></li>
        <li>Ngày khai ở cấp Trường: <strong>${declaredAt}</strong></li>
      </ul>

      <p class="${result?.isCompleted ? "status-text-success" : "status-text-warning"}">
        ${result?.reason || "Chưa có kết quả đánh giá theo cấp hiện tại."}
      </p>
    </div>
  `;
}

function renderCriterionTabs(data) {
  categories.forEach((category) => {
    const container = document.getElementById(`${category}Content`);

    if (!container) return;

    const progressItem = data.progress?.[category];

    if (!progressItem) {
      container.innerHTML = "<p>Chưa có dữ liệu tiêu chí này.</p>";
      return;
    }

    let subProgressHtml = "";

    if (category === "hocTapTot") {
      subProgressHtml = `
        <hr>
        <h3>Tiến độ Học tập tốt</h3>

        <div class="activity-item">
          ${progressItem.mandatoryPassed ? "Đạt" : "Chưa đạt"}
          <strong>Tiêu chuẩn bắt buộc:</strong>
          GPA, không nợ môn, không gian lận và thái độ học tập đúng đắn
        </div>

        <div class="activity-item">
          ${progressItem.extraPassed ? "Đạt" : "Chưa đạt"}
          <strong>Tiêu chuẩn khác:</strong>
          ${
            progressItem.academicDirectPassed
              ? "Đã ghi nhận ít nhất 01 minh chứng học thuật đạt trực tiếp."
              : "Cần đạt ít nhất 01 minh chứng học thuật hợp lệ theo quy chế cấp xét hiện tại."
          }
        </div>
      `;
    }

if (category === "tinhNguyenTot") {
  const isThanhLevel = currentAwardLevel === "thanh";

  const volunteerMainPassed = isThanhLevel
    ? progressItem.hasVolunteerAward && progressItem.volunteerDays >= 5
    : progressItem.hasVolunteerAward || progressItem.volunteerDays >= 5;

  subProgressHtml = `
    <hr>
    <h3>Tiến độ Tình nguyện tốt</h3>

    <div class="activity-item">
      ${volunteerMainPassed ? "Đạt" : "Chưa đạt"}
      <strong>Tiêu chuẩn đạt:</strong>
      ${
        isThanhLevel
          ? "Cần đủ 05 ngày tình nguyện và có khen thưởng về hoạt động tình nguyện từ cấp Trường trở lên."
          : "Cần đủ 05 ngày tình nguyện hoặc có khen thưởng về hoạt động tình nguyện từ cấp Trường trở lên."
      }
    </div>

    <div class="activity-item">
      ${progressItem.volunteerDays >= 5 ? "Đạt" : "Chưa đạt"}
      <strong>Số ngày tình nguyện đã ghi nhận:</strong>
      ${progressItem.volunteerDays || 0}/5 ngày
    </div>

    <div class="activity-item">
      ${progressItem.hasVolunteerAward ? "Đạt" : "Chưa đạt"}
      <strong>Khen thưởng tình nguyện:</strong>
      ${
        progressItem.hasVolunteerAward
          ? "Đã ghi nhận khen thưởng về hoạt động tình nguyện từ cấp Trường trở lên."
          : "Chưa ghi nhận khen thưởng về hoạt động tình nguyện từ cấp Trường trở lên."
      }
    </div>
  `;
}

if (category === "hoiNhapTot") {
  const sub = progressItem.subProgress || {
    ngoaiNgu: false,
    kyNang: false,
    hoiNhap: false
  };

  const foreignLanguageProgress = progressItem.foreignLanguageProgress || {
    basePassed: false,
    extraPassed: false
  };

  const isThanhLevel = currentAwardLevel === "thanh";

  const kyNangDescription =
  currentAwardLevel === "thanh"
    ? "Cấp Thành phố chỉ chấp nhận khóa kỹ năng thực hành xã hội hoặc khen thưởng Đoàn/Hội từ cấp Trường trở lên."
    : currentAwardLevel === "dhqg"
    ? "Cấp ĐHQG-HCM chấp nhận khóa kỹ năng, giải cuộc thi kỹ năng từ cấp Trường trở lên, báo cáo viên lớp kỹ năng từ cấp Trường trở lên hoặc khen thưởng Đoàn/Hội từ cấp Trường trở lên."
    : "Cấp Trường chấp nhận khóa kỹ năng, giải cuộc thi kỹ năng từ cấp Khoa trở lên, báo cáo viên lớp kỹ năng từ cấp Khoa trở lên, khen thưởng Đoàn/Hội từ cấp Trường trở lên hoặc chung kết thủ lĩnh sinh viên cấp Trường trở lên.";

const hoiNhapDescription =
  currentAwardLevel === "thanh"
    ? "Cấp Thành phố yêu cầu tham gia tích cực ít nhất 01 hoạt động hội nhập do cấp Trường tổ chức trở lên."
    : currentAwardLevel === "dhqg"
    ? "Cấp ĐHQG-HCM chấp nhận hoạt động giao lưu quốc tế, chương trình giao lưu/hợp tác quốc tế hoặc giải Ba trở lên cuộc thi kiến thức hội nhập/cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên."
    : "Cấp Trường chấp nhận hoạt động giao lưu quốc tế, cuộc thi tìm hiểu văn hóa/hội nhập từ cấp Khoa trở lên, thành viên chính thức hoặc tình nguyện viên chương trình giao lưu quốc tế.";

  const ngoaiNguCourseScoreResult =
  progressItem.ngoaiNguCourseScoreResult || null;

  const ngoaiNguCourseScoreDeclaration =
  progressItem.ngoaiNguCourseScoreDeclaration || null;

  const ngoaiNguCourseScoreInfoHtml =
  renderDerivedNgoaiNguCourseScoreInfo(data);

  subProgressHtml = `
    <hr>
    <h3>Tiến độ Hội nhập tốt</h3>

    <div class="activity-item">
      ${sub.ngoaiNgu ? "Đạt" : "Chưa đạt"}
      <strong>Ngoại ngữ:</strong>
      ${
        isThanhLevel
          ? "Cần đạt điều kiện ngoại ngữ cơ bản và thêm 01 minh chứng giao lưu quốc tế hoặc giải Ba trở lên cuộc thi kiến thức hội nhập/cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên."
          : "Đạt ít nhất 01 tiêu chuẩn ngoại ngữ theo quy chế cấp xét hiện tại."
      }
    </div>

    ${
  ngoaiNguCourseScoreResult
    ? `
      <div class="activity-item">
        ${ngoaiNguCourseScoreResult.isCompleted ? "Đạt" : "Chưa đạt"}
        <strong>Điểm học phần ngoại ngữ đã khai ở cấp Trường:</strong>
        ${ngoaiNguCourseScoreResult.reason}
      </div>
    `
    : `
      <div class="activity-item">
        Chưa đạt
        <strong>Điểm học phần ngoại ngữ đã khai ở cấp Trường:</strong>
        Chưa có dữ liệu điểm học phần ngoại ngữ đã khai ở cấp Trường.
      </div>
    `
}

    ${
      isThanhLevel
        ? `
          <div class="activity-item">
            ${foreignLanguageProgress.basePassed ? "Đạt" : "Chưa đạt"}
            <strong>Ngoại ngữ cơ bản:</strong>
            Chứng chỉ ngoại ngữ tương đương B1 trở lên hoặc điểm học phần ngoại ngữ đạt chuẩn.
          </div>

          <div class="activity-item">
            ${foreignLanguageProgress.extraPassed ? "Đạt" : "Chưa đạt"}
            <strong>Điều kiện bổ sung:</strong>
            Tham gia hoạt động giao lưu quốc tế hoặc đạt giải Ba trở lên cuộc thi kiến thức hội nhập/cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên.
          </div>
        `
        : ""
    }

    <div class="activity-item">
  ${sub.kyNang ? "Đạt" : "Chưa đạt"}
  <strong>Kỹ năng:</strong>
  ${kyNangDescription}
</div>

    <div class="activity-item">
  ${sub.hoiNhap ? "Đạt" : "Chưa đạt"}
  <strong>Hoạt động hội nhập:</strong>
  ${hoiNhapDescription}
</div>
    ${ngoaiNguCourseScoreInfoHtml}
  `;
}

    const activities = progressItem.activities || [];
    const evidences = progressItem.evidences || [];
    const criteria = progressItem.criteria || null;
    const shouldShowUpload = uploadCategories.includes(category);

    const derivedInfoHtml =
      category === "daoDucTot" || category === "hocTapTot"
        ? renderDerivedSelfDeclarationInfo(data, category)
        : "";

    container.innerHTML = `
      <div class="criterion-card">
        <div class="criterion-header">
          <h2>${categoryLabels[category]}</h2>
          <span class="${progressItem.isCompleted ? "status-done" : "status-missing"}">
            ${progressItem.isCompleted ? "Đã đạt" : "Chưa đạt"}
          </span>
        </div>

        <p>
          Nguồn hoàn thành:
          <strong>${formatCompletedBy(progressItem.completedBy)}</strong>
        </p>

        ${derivedInfoHtml}

        ${subProgressHtml}

        ${
          criteria
            ? `
              <hr>

              <h3>Tiêu chuẩn cần đạt</h3>
              <ul>
                ${(criteria.batBuoc || criteria.mandatory || []).map((item) => `<li>${item}</li>`).join("")}
              </ul>

              <h3>Minh chứng gợi ý</h3>
              <div class="evidence-suggestion-groups">
                ${renderGroupedEvidenceSuggestions(criteria.minhChung || [])}
              </div>
            `
            : ""
        }

        <hr>

        <h3>Hoạt động được ghi nhận</h3>
        <div>
          ${
            activities.length > 0
              ? activities
                  .map(
                    (activity) => `
                      <div class="activity-item">
                        ${activity.title}
                        ${activity.date ? `<small> - ${formatDate(activity.date)}</small>` : ""}
                      </div>
                    `
                  )
                  .join("")
              : "<p>Chưa có hoạt động nào được ghi nhận từ danh sách admin upload.</p>"
          }
        </div>

        ${
          evidences.length > 0
            ? `
              <hr>

              <h3>Minh chứng đã ghi nhận</h3>
              <div>
                ${evidences
                  .map(
                    (evidence) => `
                      <div class="evidence-item">
                        ${evidence.fileName}
                        <br>
                        <small>Trạng thái: ${formatStatus(evidence.status)}</small>
                        ${
                          evidence.aiResult && evidence.aiResult.reason
                            ? `<br><small>Ghi chú AI: ${evidence.aiResult.reason}</small>`
                            : ""
                        }
                        ${
                          evidence.adminReview && evidence.adminReview.note
                            ? `<br><small style="color:#92400e;background:#fef3c7;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px">Ghi chú admin: ${evidence.adminReview.note}</small>`
                            : ""
                        }
                      </div>
                    `
                  )
                  .join("")}
              </div>
            `
            : ""
        }

        ${
          shouldShowUpload
            ? `
              <hr>

              <h3>Upload minh chứng bổ sung cho ${awardLevelLabels[currentAwardLevel]}</h3>

              <input
                type="file"
                id="file-${category}"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              />

              <button onclick="uploadEvidence('${category}')">
                Gửi minh chứng
              </button>

              <p id="upload-message-${category}" class="upload-message"></p>
            `
            : ""
        }
      </div>
    `;
  });
}

function renderStorage(evidences) {
  const table = document.getElementById("storageTable");

  if (!table) return;

  table.innerHTML = "";

  if (!evidences || evidences.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="5">Chưa có file minh chứng nào cho cấp xét hiện tại.</td>
      </tr>
    `;
    return;
  }

  evidences.forEach((evidence) => {
    const row = document.createElement("tr");

    const fileUrl = evidence.fileUrl
      ? evidence.fileUrl
      : evidence.filePath
      ? `/${evidence.filePath.replace(/\\/g, "/")}`
      : "";

    row.innerHTML = `
      <td>${evidence.fileName}</td>
      <td>${categoryLabels[evidence.category] || evidence.category}</td>
      <td>
        ${formatStatus(evidence.status)}
        ${evidence.adminReview && evidence.adminReview.note ? `<br><small style="color:#92400e;background:#fef3c7;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px">Ghi chú: ${evidence.adminReview.note}</small>` : ""}
      </td>
      <td>${formatDate(evidence.createdAt)}</td>
      <td>
        ${
          fileUrl
            ? `<a href="${fileUrl}" target="_blank" class="download-btn">Xem file</a>`
            : `<span class="no-file-text">Không có file</span>`
        }
      </td>
    `;

    table.appendChild(row);
  });
}

async function uploadEvidence(category) {
  const fileInput = document.getElementById(`file-${category}`);
  const message = document.getElementById(`upload-message-${category}`);

  if (!message) return;

  message.textContent = "";

  if (!fileInput || !fileInput.files[0]) {
    message.textContent = "Vui lòng chọn file minh chứng.";
    return;
  }

  const formData = new FormData();
  formData.append("studentId", studentId);
  formData.append("category", category);
  formData.append("awardLevel", currentAwardLevel);
  formData.append("evidence", fileInput.files[0]);

  try {
    const res = await fetch("/api/evidence/upload", {
      method: "POST",
      body: formData,
      credentials: "include"
    });

    const data = await res.json();

    if (!data.success) {
      message.textContent = data.message || "Upload thất bại.";
      return;
    }

    fileInput.value = "";
    message.textContent = "Upload thành công. Minh chứng đang được xử lý...";

    if (data.evidence && data.evidence._id && data.aiProcessed) {
      pollEvidenceStatus(data.evidence._id, category);
    } else {
      loadHigherLevelDashboard();
    }
  } catch (error) {
    console.error("Upload evidence error:", error);
    message.textContent = "Không thể upload minh chứng.";
  }
}

function pollEvidenceStatus(evidenceId, category) {
  const message = document.getElementById(`upload-message-${category}`);

  let attempts = 0;
  const maxAttempts = 30;

  const intervalId = setInterval(async () => {
    attempts += 1;

    if (attempts >= maxAttempts) {
      clearInterval(intervalId);
      if (message) {
        message.textContent =
          "AI xử lý lâu hơn dự kiến. Bạn có thể xem lại trong Kho minh chứng.";
      }
      loadHigherLevelDashboard();
      return;
    }

    try {
      const res = await fetch(`/api/evidence/${evidenceId}/status`, {
        credentials: "include"
      });

      const data = await res.json();

      if (!data.success) {
        if (message) {
          message.textContent = data.message || "Không thể kiểm tra trạng thái AI.";
        }
        clearInterval(intervalId);
        return;
      }

      const evidence = data.evidence;

      if (evidence.status === "pending") {
        if (message) {
          message.textContent = `AI đang kiểm tra minh chứng... (${attempts}/${maxAttempts})`;
        }
        return;
      }

      clearInterval(intervalId);

      if (message) {
        message.textContent =
          evidence.aiResult?.reason ||
          `Trạng thái minh chứng: ${formatStatus(evidence.status)}`;
      }

      loadHigherLevelDashboard();
    } catch (error) {
      console.error("Poll evidence status error:", error);
      clearInterval(intervalId);

      if (message) {
        message.textContent = "Không thể kiểm tra kết quả AI.";
      }
    }
  }, 2000);
}

function formatCompletedBy(value) {
  if (value === "activity") return "Hoạt động admin upload";
  if (value === "evidence") return "Minh chứng sinh viên upload";
  if (value === "admin") return "Admin xác nhận";
  if (value === "system") return "Hệ thống tự đánh giá";
  if (value === "student_declare") return "Sinh viên tự khai báo";
  if (value === "student_declare_and_evidence") {
    return "Tự khai bắt buộc + minh chứng học thuật";
  }
  if (value === "activity_and_evidence") {
    return "Hoạt động admin upload + minh chứng sinh viên";
  }
  return "Chưa hoàn thành";
}

function formatStatus(status) {
  if (status === "pending") return "Đang chờ xử lý";
  if (status === "ai_valid") return "AI đề xuất hợp lệ";
  if (status === "ai_invalid") return "AI đề xuất không hợp lệ";
  if (status === "manual_review") return "Cần admin kiểm tra";
  if (status === "approved_by_admin") return "Admin đã duyệt";
  if (status === "rejected_by_admin") return "Admin từ chối";
  if (status === "need_more_info") return "Cần bổ sung minh chứng";
  return status || "Chưa cập nhật";
}

function goBackToSchoolLevel() {
  window.location.href = "/student-dashboard.html";
}

async function logoutStudent() {
  try {
    await fetch("/api/student/logout", {
      method: "POST",
      credentials: "include"
    });
  } catch (error) {
    console.error("Logout student error:", error);
  }

  window.location.href = "/student.html";
}

function formatDate(dateString) {
  if (!dateString) return "Chưa cập nhật";

  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    return "Không hợp lệ";
  }

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function renderGroupedEvidenceSuggestions(minhChung = []) {
  const groups = {
    "Nhóm Ngoại ngữ": [],
    "Nhóm Kỹ năng": [],
    "Nhóm Hoạt động hội nhập": []
  };

  const ungroupedItems = [];

  minhChung.forEach((item) => {
    const text = String(item || "").trim();

    if (text.startsWith("Nhóm Ngoại ngữ:")) {
      groups["Nhóm Ngoại ngữ"].push(
        text.replace("Nhóm Ngoại ngữ:", "").trim()
      );
      return;
    }

    if (text.startsWith("Nhóm Kỹ năng:")) {
      groups["Nhóm Kỹ năng"].push(
        text.replace("Nhóm Kỹ năng:", "").trim()
      );
      return;
    }

    if (text.startsWith("Nhóm Hoạt động hội nhập:")) {
      groups["Nhóm Hoạt động hội nhập"].push(
        text.replace("Nhóm Hoạt động hội nhập:", "").trim()
      );
      return;
    }

    ungroupedItems.push(text);
  });

  const groupedHtml = Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([groupName, items]) => {
      return `
        <div class="evidence-group-card">
          <h4>${groupName}</h4>
          <ul>
            ${items.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </div>
      `;
    })
    .join("");

  const ungroupedHtml =
    ungroupedItems.length > 0
      ? `
        <div class="evidence-group-card evidence-group-card-no-title">
          <ul>
            ${ungroupedItems.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </div>
      `
      : "";

  return groupedHtml + ungroupedHtml;
}

function goToCentralLevelPage() {
  window.location.href = "/student-central-level.html";
}