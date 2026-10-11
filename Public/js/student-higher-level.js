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

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setupPageTitle() {
  const isThanh = currentAwardLevel === "thanh";
  const label = awardLevelLabels[currentAwardLevel];

  if (isThanh) {
    document.body.classList.add("theme-thanh-pho");
    document.body.classList.remove("theme-dhqg");
  } else {
    document.body.classList.add("theme-dhqg");
    document.body.classList.remove("theme-thanh-pho");
  }

  const title = document.getElementById("higherLevelTitle");
  if (title) {
    title.textContent = isThanh
      ? "Xét danh hiệu Sinh viên 5 tốt Cấp Thành phố Hồ Chí Minh"
      : "Xét danh hiệu Sinh viên 5 tốt Cấp ĐHQG-HCM";
  }

  const progressTitle = document.getElementById("higherProgressTitle");
  if (progressTitle) {
    progressTitle.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: ${isThanh ? "var(--tech-cyan)" : "var(--tech-cyan)"};"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Tiến độ xét ${label}`;
  }

  const topbarMainTitle = document.getElementById("topbarMainTitle");
  if (topbarMainTitle) {
    topbarMainTitle.textContent = isThanh
      ? "Cổng thông tin Sinh viên 5 tốt Cấp Thành phố Hồ Chí Minh"
      : "Cổng thông tin Sinh viên 5 tốt Cấp ĐHQG-HCM";
  }

  const topbarSubtitle = document.getElementById("topbarSubtitle");
  if (topbarSubtitle) {
    topbarSubtitle.textContent = isThanh
      ? "Hội Sinh viên Việt Nam TP. Hồ Chí Minh • Thành phố mang tên Bác kính yêu"
      : "Đại học Quốc gia TP. Hồ Chí Minh • Hệ thống thẩm định hồ sơ NCKH & Đổi mới sáng tạo";
  }

  const sidebarLevelPill = document.getElementById("sidebarLevelPill");
  if (sidebarLevelPill) {
    sidebarLevelPill.textContent = isThanh ? "★ CẤP THÀNH PHỐ" : "★ CẤP ĐHQG-HCM";
  }

  const candidateLevelBadge = document.getElementById("candidateLevelBadge");
  if (candidateLevelBadge) {
    candidateLevelBadge.textContent = isThanh ? "ỨNG VIÊN CẤP THÀNH PHỐ" : "ỨNG VIÊN ĐHQG-HCM";
  }

  const candidateOrgName = document.getElementById("candidateOrgName");
  if (candidateOrgName) {
    candidateOrgName.textContent = isThanh ? "Hội Sinh viên Việt Nam TP. Hồ Chí Minh" : "Đại học Quốc gia TP. Hồ Chí Minh";
  }

  const btnDhqg = document.getElementById("levelBtnDhqg");
  const btnThanh = document.getElementById("levelBtnThanh");
  if (btnDhqg && btnThanh) {
    if (isThanh) {
      btnThanh.classList.add("active");
      btnDhqg.classList.remove("active");
    } else {
      btnDhqg.classList.add("active");
    }
  }

  const saigonBanner = document.getElementById("saigonHeritageBanner");
  if (saigonBanner) {
    saigonBanner.style.display = isThanh ? "block" : "none";
  }

  document.title = isThanh 
    ? "Xét SV5T Cấp Thành phố | TP. Hồ Chí Minh" 
    : "Xét SV5T Cấp ĐHQG-HCM | Khoa học & Đổi mới";
}

function switchHigherLevel(level) {
  if (level !== "dhqg" && level !== "thanh") return;
  window.location.href = `/student-higher-level.html?level=${level}`;
}

function openSidebar() {
  document.getElementById("mainSidebar")?.classList.add("active");
  document.getElementById("mainSidebar")?.classList.add("open");
  document.getElementById("sidebarOverlay")?.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  document.getElementById("mainSidebar")?.classList.remove("active");
  document.getElementById("mainSidebar")?.classList.remove("open");
  document.getElementById("sidebarOverlay")?.classList.remove("active");
  document.body.style.overflow = "";
}

function openBarcodeModal() {
  document.getElementById("barcodeModal")?.classList.remove("hidden");
}

function closeBarcodeModal() {
  document.getElementById("barcodeModal")?.classList.add("hidden");
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
  } else {
    const matchingBtn = document.querySelector(`.tab-btn[onclick*="'${tabId}'"]`);
    if (matchingBtn) {
      matchingBtn.classList.add("active");
    }
  }

  window.scrollTo({ top: 0, behavior: "smooth" });

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

  // Dynamic Candidate Card Metric Pills
  const idCardDrlText = document.getElementById("idCardDrlText");
  const idCardGpaText = document.getElementById("idCardGpaText");
  const idCardNckhText = document.getElementById("idCardNckhText");
  const idCardVolText = document.getElementById("idCardVolText");

  if (idCardDrlText) {
    idCardDrlText.textContent = currentAwardLevel === "thanh" ? "≥ 90đ (Xuất sắc)" : "≥ 80đ (Tốt)";
  }
  if (idCardGpaText) {
    idCardGpaText.textContent = currentAwardLevel === "thanh" ? "GPA ≥ 3.4 (KHTN ≥ 3.2)" : "GPA ≥ 3.2";
  }
  if (idCardNckhText) {
    idCardNckhText.textContent = currentAwardLevel === "thanh" ? "Giải Euréka / Cấp Thành" : "Đề tài NCKH / ĐMST";
  }
  if (idCardVolText) {
    idCardVolText.textContent = currentAwardLevel === "thanh" ? "≥ 5 Ngày Tình nguyện" : "Chiến dịch Cấp Trường+";
  }

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

  // 1. Avatar Box Monogram
  const avatarBox = document.getElementById("avatarBox");
  if (avatarBox) {
    const names = (student.fullName || "").trim().split(" ");
    let monogram = "SV";
    if (names.length >= 2) {
      monogram = (names[0][0] + names[names.length - 1][0]).toUpperCase();
    } else if (names.length === 1 && names[0]) {
      monogram = names[0].substring(0, 2).toUpperCase();
    }
    avatarBox.textContent = monogram;
  }

  // 2. Barcode Rendering
  if (typeof JsBarcode === "function" && student.studentId) {
    try {
      JsBarcode("#studentBarcode", student.studentId, {
        format: "CODE128",
        width: 1.5,
        height: 38,
        displayValue: true,
        fontSize: 10,
        margin: 0,
        textMargin: 2
      });
      JsBarcode("#studentBarcodeZoom", student.studentId, {
        format: "CODE128",
        width: 2.2,
        height: 65,
        displayValue: true,
        fontSize: 14,
        margin: 4
      });
    } catch (err) {
      console.warn("JsBarcode render error:", err);
    }
  }

  // 3. Status chip & KPI counters
  const completed = Number(data.completedCount || 0);
  const percent = Number(data.progressPercent || 0);
  const statCompletedCount = document.getElementById("statCompletedCount");
  const statMissingCount = document.getElementById("statMissingCount");
  const progressStatusChip = document.getElementById("progressStatusChip");

  if (statCompletedCount) statCompletedCount.textContent = `${completed}/5`;
  if (statMissingCount) statMissingCount.textContent = `${Math.max(0, 5 - completed)}`;
  if (progressStatusChip) {
    progressStatusChip.textContent = `${completed}/5 Đạt (${percent}%)`;
    progressStatusChip.style.background = completed === 5 ? "var(--success-bg)" : "var(--tech-cyan-light)";
    progressStatusChip.style.color = completed === 5 ? "var(--success)" : "var(--tech-cyan)";
  }

  // 4. Update 5 Criteria Pills in Overview Grid
  const progressMap = data.progress || {};
  categories.forEach((cat) => {
    const pill = document.getElementById(`pill-${cat}`);
    if (pill) {
      const isDone = progressMap[cat]?.isCompleted === true;
      pill.textContent = isDone ? "Đạt" : "Chưa đạt";
      pill.className = `preview-status-pill ${isDone ? "completed" : "missing"}`;
    }
  });

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
    ${hasProvincialAward ? "✅" : "❌"}
    <strong>${hasProvincialAward ? "Đã đạt" : "Chưa đạt"} danh hiệu Sinh viên 5 tốt cấp tỉnh/cấp Thành phố:</strong>
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
    ? "Cấp ĐHQG-HCM chấp nhận khóa kỹ năng, giải cuộc thi kỹ năng từ cấp Trường trở lên, báo cáo viên chi Hội kỹ năng từ cấp Trường trở lên hoặc khen thưởng Đoàn/Hội từ cấp Trường trở lên."
    : "Cấp Trường chấp nhận khóa kỹ năng, giải cuộc thi kỹ năng từ cấp Khoa trở lên, báo cáo viên chi Hội kỹ năng từ cấp Khoa trở lên, khen thưởng Đoàn/Hội từ cấp Trường trở lên hoặc chung kết thủ lĩnh sinh viên cấp Trường trở lên.";

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

              <h3 style="margin-bottom: 6px;">Upload minh chứng bổ sung cho ${awardLevelLabels[currentAwardLevel]}</h3>
              <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">
                Tải lên tài liệu chứng minh cho tiêu chuẩn này để AI thẩm định và Ban Chấp hành đối chiếu.
              </p>

              <div
                class="dropzone-box"
                id="dropzone-${category}"
                onclick="document.getElementById('file-${category}').click()"
                ondragover="handleDragOver(event, '${category}')"
                ondragleave="handleDragLeave(event, '${category}')"
                ondrop="handleDrop(event, '${category}')"
              >
                <div class="dropzone-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </div>
                <div class="dropzone-text">
                  <h4>Kéo thả file minh chứng vào đây hoặc click để chọn</h4>
                  <p>Hỗ trợ định dạng PDF, JPG, PNG, DOCX (Dung lượng tối đa 2MB)</p>
                </div>
                <div id="dropzone-file-info-${category}" class="dropzone-file-info"></div>
                <input
                  type="file"
                  id="file-${category}"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  style="display: none;"
                  onchange="handleFileSelected('${category}')"
                />
              </div>

              <button class="btn-primary" onclick="uploadEvidence('${category}')">
                🚀 Tải lên & Phân tích bằng AI
              </button>

              <p id="upload-message-${category}" class="upload-message"></p>
            `
            : ""
        }
      </div>
    `;
  });
}

// ─────────────────────────────────────────
// DRAG & DROP AND FILE SELECTION HELPERS
// ─────────────────────────────────────────
function handleDragOver(e, category) {
  e.preventDefault();
  e.stopPropagation();
  const dropzone = document.getElementById(`dropzone-${category}`);
  if (dropzone) dropzone.classList.add("dragover");
}

function handleDragLeave(e, category) {
  e.preventDefault();
  e.stopPropagation();
  const dropzone = document.getElementById(`dropzone-${category}`);
  if (dropzone) dropzone.classList.remove("dragover");
}

function handleDrop(e, category) {
  e.preventDefault();
  e.stopPropagation();
  const dropzone = document.getElementById(`dropzone-${category}`);
  if (dropzone) dropzone.classList.remove("dragover");

  const files = e.dataTransfer.files;
  if (!files || files.length === 0) return;

  const fileInput = document.getElementById(`file-${category}`);
  if (fileInput) {
    fileInput.files = files;
    handleFileSelected(category);
  }
}

function handleFileSelected(category) {
  const fileInput = document.getElementById(`file-${category}`);
  const info = document.getElementById(`dropzone-file-info-${category}`);
  if (!fileInput || !info) return;

  const file = fileInput.files[0];
  if (file) {
    info.innerHTML = `📄 <strong>${escapeHtml(file.name)}</strong> (${formatFileSize(file.size)})`;
    info.classList.add("active");
  } else {
    info.innerHTML = "";
    info.classList.remove("active");
  }
}

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ─────────────────────────────────────────
// FILTERABLE HIGHER EVIDENCE STORAGE
// ─────────────────────────────────────────
let allHigherStorageEvidences = [];

function renderStorage(evidences) {
  allHigherStorageEvidences = evidences || [];
  handleHigherStorageFilter();
}

function handleHigherStorageFilter() {
  const table = document.getElementById("storageTable");
  if (!table) return;

  const searchInput = document.getElementById("storageSearchInput");
  const catFilter = document.getElementById("storageCategoryFilter");
  const statusFilter = document.getElementById("storageStatusFilter");

  const query = (searchInput?.value || "").toLowerCase().trim();
  const category = catFilter?.value || "all";
  const status = statusFilter?.value || "all";

  const filtered = allHigherStorageEvidences.filter((item) => {
    const matchName = !query || (item.fileName || "").toLowerCase().includes(query);
    const matchCat = category === "all" || item.category === category;
    let matchStatus = true;
    if (status === "approved") {
      matchStatus = item.status === "approved_by_admin" || item.status === "ai_valid";
    } else if (status === "pending") {
      matchStatus = item.status === "pending" || item.status === "manual_review";
    } else if (status === "rejected") {
      matchStatus = item.status === "rejected_by_admin" || item.status === "ai_invalid" || item.status === "need_more_info";
    }
    return matchName && matchCat && matchStatus;
  });

  table.innerHTML = "";

  if (filtered.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">
          ${allHigherStorageEvidences.length === 0 ? "Chưa có file minh chứng nào cho cấp xét hiện tại." : "Không tìm thấy minh chứng phù hợp với bộ lọc."}
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach((evidence) => {
    const row = document.createElement("tr");

    const fileUrl = evidence.fileUrl
      ? evidence.fileUrl
      : evidence.filePath
      ? `/${evidence.filePath.replace(/\\/g, "/")}`
      : "";

    row.innerHTML = `
      <td>
        <strong>${escapeHtml(evidence.fileName)}</strong>
        ${evidence.aiResult?.reason ? `<br><small style="color: var(--text-muted);">AI: ${escapeHtml(evidence.aiResult.reason)}</small>` : ""}
        ${evidence.adminReview?.note ? `<br><small style="color:#92400e;background:#fef3c7;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px">Admin: ${escapeHtml(evidence.adminReview.note)}</small>` : ""}
      </td>
      <td><span class="benchmark-tag dhqg">${categoryLabels[evidence.category] || evidence.category}</span></td>
      <td>${formatStatus(evidence.status)}</td>
      <td>${formatDate(evidence.createdAt)}</td>
      <td style="text-align: right;">
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
    const dropzoneInfo = document.getElementById(`dropzone-file-info-${category}`);
    if (dropzoneInfo) {
      dropzoneInfo.innerHTML = "";
      dropzoneInfo.classList.remove("active");
    }

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