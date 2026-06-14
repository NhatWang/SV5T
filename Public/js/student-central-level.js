let centralDashboardData = null;
let centralAutoRefreshTimer = null;
const CENTRAL_AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 phút

const categoryLabelMap = {
  daoDucTot: "Đạo đức tốt",
  hocTapTot: "Học tập tốt",
  theLucTot: "Thể lực tốt",
  tinhNguyenTot: "Tình nguyện tốt",
  hoiNhapTot: "Hội nhập tốt",
  additional: "Tiêu chí đạt thêm"
};

const formIdMap = {
  daoDucTot: {
    mandatory: {
      title: "daoDucMandatoryTitle",
      file: "daoDucMandatoryFile",
      message: "daoDucMandatoryMessage"
    },
    additional: {
      key: "daoDucAdditionalKey",
      title: "daoDucAdditionalTitle",
      file: "daoDucAdditionalFile",
      message: "daoDucAdditionalMessage"
    }
  },

  hocTapTot: {
    mandatory: {
      title: "hocTapMandatoryTitle",
      file: "hocTapMandatoryFile",
      message: "hocTapMandatoryMessage"
    },
    additional: {
      key: "hocTapAdditionalKey",
      title: "hocTapAdditionalTitle",
      file: "hocTapAdditionalFile",
      message: "hocTapAdditionalMessage"
    }
  },

  theLucTot: {
    mandatory: {
      title: "theLucMandatoryTitle",
      file: "theLucMandatoryFile",
      message: "theLucMandatoryMessage"
    },
    additional: {
      key: "theLucAdditionalKey",
      title: "theLucAdditionalTitle",
      file: "theLucAdditionalFile",
      message: "theLucAdditionalMessage"
    }
  },

  tinhNguyenTot: {
    mandatory: {
      title: "tinhNguyenMandatoryTitle",
      file: "tinhNguyenMandatoryFile",
      message: "tinhNguyenMandatoryMessage"
    },
    additional: {
      key: "tinhNguyenAdditionalKey",
      title: "tinhNguyenAdditionalTitle",
      file: "tinhNguyenAdditionalFile",
      message: "tinhNguyenAdditionalMessage"
    }
  },

  hoiNhapTot: {
    mandatory: {
      title: "hoiNhapMandatoryTitle",
      file: "hoiNhapMandatoryFile",
      message: "hoiNhapMandatoryMessage"
    },
    additional: {
      key: "hoiNhapAdditionalKey",
      title: "hoiNhapAdditionalTitle",
      file: "hoiNhapAdditionalFile",
      message: "hoiNhapAdditionalMessage"
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  loadCentralLevelDashboard();
  startCentralAutoRefresh();
});

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
  document.querySelectorAll(".tab-content").forEach((section) => {
    section.classList.remove("active");
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

window.showTab = showTab;
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;

async function loadCentralLevelDashboard(options = {}) {
  const silent = options.silent === true;

  try {
    const res = await fetch("/api/student-dashboard/me/central-level", {
      credentials: "include"
    });

    const data = await res.json();

    if (!data.success) {
      if (!silent) {
        alert(data.message || "Không thể tải dữ liệu cấp Trung ương.");
        window.location.href = "/student-dashboard.html";
      }

      return;
    }

    centralDashboardData = data;

    renderCentralStudentInfo(data);
    renderCentralAccessStatus(data);
    renderCentralSummary(data);
    renderCentralProgressByCategory(data);
    renderCentralStorage(data.evidences || data.centralEvidences || []);
    renderCentralAISuggestions(data.aiSuggestions || []);
  } catch (error) {
    console.error("Load central level dashboard error:", error);

    if (!silent) {
      alert("Không thể kết nối server.");
    }
  }
}

function renderCentralStudentInfo(data) {
  const student = data.student || {};

  setText("centralStudentName", student.fullName || "Chưa cập nhật");
  setText("centralStudentId", student.studentId || "");
  setText("centralClassName", student.className || "Chưa cập nhật");
}

function renderCentralAccessStatus(data) {
  const box = document.getElementById("centralAccessStatus");
  const summary = data.summary || {};

  if (!box) return;

  box.innerHTML = `
    <p class="${
      summary.canAccessCentral ? "status-text-success" : "status-text-warning"
    }">
      ${
        summary.canAccessCentral
          ? "Bạn đã hoàn thành điều kiện đầu vào từ cấp Thành phố và có thể tiếp tục chuẩn bị hồ sơ cấp Trung ương."
          : "Bạn cần hoàn thành 5/5 tiêu chí cấp Thành phố trước khi tiếp tục chuẩn bị hồ sơ cấp Trung ương."
      }
    </p>
  `;
}

function renderCentralSummary(data) {
  const summaryBox = document.getElementById("centralSummary");

  const mandatoryFill = document.getElementById("centralMandatoryProgressFill");
  const mandatoryText = document.getElementById("centralMandatoryProgressText");

  const additionalFill = document.getElementById("centralAdditionalProgressFill");
  const additionalText = document.getElementById("centralAdditionalProgressText");

  const summary = data.summary || {};

  const mandatoryCompleted = Number(
    data.completedCount ||
    summary.mandatoryCompletedCount ||
    0
  );

  const mandatoryTotal = 5;
  const mandatoryPercent = Math.round(
    (mandatoryCompleted / mandatoryTotal) * 100
  );

  const additionalCompletedRaw = Number(
  data.additionalCriteriaCount ??
  summary.additionalCriteriaCount ??
  0
);

  const additionalRequired = 2;
  const additionalCompleted = Math.min(
    additionalCompletedRaw,
    additionalRequired
  );

  const additionalPercent = Math.round(
    (additionalCompleted / additionalRequired) * 100
  );

  if (mandatoryFill) {
    mandatoryFill.style.width = `${mandatoryPercent}%`;
  }

  if (mandatoryText) {
    mandatoryText.textContent =
      `${mandatoryCompleted}/${mandatoryTotal} tiêu chuẩn bắt buộc đã đạt (${mandatoryPercent}%)`;
  }

  if (additionalFill) {
    additionalFill.style.width = `${additionalPercent}%`;
  }

  if (additionalText) {
    additionalText.textContent =
      `${additionalCompleted}/${additionalRequired} tiêu chí đạt thêm đã đạt (${additionalPercent}%)`;
  }

  const isQualified =
    mandatoryCompleted >= mandatoryTotal &&
    additionalCompletedRaw >= additionalRequired;

  if (!summaryBox) return;

  summaryBox.innerHTML = `
    <p class="${isQualified ? "status-text-success" : "status-text-warning"}">
      ${
        isQualified
          ? "Bạn đã đủ điều kiện xét danh hiệu Sinh viên 5 tốt cấp Trung ương."
          : "Bạn chưa đủ điều kiện xét danh hiệu Sinh viên 5 tốt cấp Trung ương."
      }
    </p>
  `;
}

function renderCentralProgressByCategory(data) {
  const progress = data.progress || {};
  const officialCriteria = data.officialCriteria || {};

  const targetMap = {
    daoDucTot: "centralDaoDucTotContent",
    hocTapTot: "centralHocTapTotContent",
    theLucTot: "centralTheLucTotContent",
    tinhNguyenTot: "centralTinhNguyenTotContent",
    hoiNhapTot: "centralHoiNhapTotContent"
  };

  Object.entries(targetMap).forEach(([category, elementId]) => {
    const box = document.getElementById(elementId);
    if (!box) return;

    const item = progress[category];
    const criteria = officialCriteria[category] || {};

    if (!item) {
      box.innerHTML = `
        <div class="activity-item">
          <strong>Chưa có dữ liệu tiêu chuẩn này.</strong>
          <p>Hệ thống chưa nhận được dữ liệu đánh giá cho tiêu chuẩn này.</p>
        </div>
      `;
      return;
    }

    box.innerHTML = `
      ${renderCentralProgressItem(item)}
      ${renderCentralCriteriaBox(criteria)}
      ${renderPreviousDataForCategory(data, category)}
      ${renderCentralEvidenceList(item.centralEvidences || [])}
    `;
  });
}

function renderCentralProgressItem(item) {
  const statusClass = item.isCompleted
    ? "status-text-success"
    : "status-text-warning";

  return `
    <div class="activity-item">
      <strong>
        ${item.isCompleted ? "Đạt" : "Chưa đạt"} - ${escapeHtml(item.label || "Tiêu chuẩn")}
      </strong>

      <p>
        ${escapeHtml(item.description || "Chưa có mô tả tiêu chuẩn.")}
      </p>

      <p class="${statusClass}">
        ${escapeHtml(formatCentralProgressStatus(item.status, item.completedBy))}
      </p>
    </div>
  `;
}

function renderCentralCriteriaBox(criteria) {
  const mandatory = criteria.mandatory || null;
  const additional = criteria.additional || [];

  const mandatoryConditions = mandatory?.conditions || [];

  const mandatoryHtml =
    mandatoryConditions.length > 0
      ? mandatoryConditions
          .map((condition) => {
            return `
              <li>
                ${escapeHtml(condition.text)}
              </li>
            `;
          })
          .join("")
      : "<li>Chưa có tiêu chí bắt buộc.</li>";

  const additionalHtml =
    additional.length > 0
      ? additional
          .map((item) => {
            return `
              <li>
                <strong>${escapeHtml(item.label)}:</strong>
                ${escapeHtml(item.text)}
              </li>
            `;
          })
          .join("")
      : "<li>Không có tiêu chí đạt thêm cho nhóm này.</li>";

  return `
    <div class="higher-summary-card">
      <h3>Tiêu chí cần đạt</h3>

      <div class="criteria-block">
        <h4>Tiêu chí bắt buộc</h4>
        <ul>
          ${mandatoryHtml}
        </ul>
      </div>

      <div class="criteria-block">
        <h4>Tiêu chí đạt thêm</h4>
        <p class="school-data-note">
          Cấp Trung ương yêu cầu đạt từ 02 tiêu chí đạt thêm trở lên trên toàn bộ hồ sơ.
        </p>
        <ul>
          ${additionalHtml}
        </ul>
      </div>
    </div>
  `;
}

function renderPreviousDataForCategory(data, category) {
  const sourceData = data.sourceData || {};
  const schoolSelfDeclarations = sourceData.schoolSelfDeclarations || {};
  const previousActivities = sourceData.previousActivities || [];
  const previousEvidences = sourceData.previousEvidences || [];

  const relatedActivities = previousActivities.filter((activity) => {
    return activity.category === category;
  });

  const relatedEvidences = previousEvidences.filter((evidence) => {
    return evidence.category === category;
  });

  let selfDeclareHtml = "";

  if (category === "daoDucTot") {
    const declaration = schoolSelfDeclarations.daoDucTot;

    if (declaration && declaration.data) {
      selfDeclareHtml = `
        <div class="activity-item">
          <strong>Dữ liệu Đạo đức tốt từ cấp Trường</strong>
          <p>Điểm rèn luyện: ${declaration.data.trainingScore ?? "Chưa cập nhật"}/100</p>
          <p>Không vi phạm pháp luật/quy chế: ${
            declaration.data.noLawViolation && declaration.data.noRuleViolation
              ? "Có"
              : "Chưa xác nhận"
          }</p>
        </div>
      `;
    }
  }

  if (category === "hocTapTot") {
    const declaration = schoolSelfDeclarations.hocTapTot;

    if (declaration && declaration.data) {
      const scale = declaration.data.gpaScale === "10" ? "10" : "4.0";

      selfDeclareHtml = `
        <div class="activity-item">
          <strong>Dữ liệu Học tập tốt từ cấp Trường</strong>
          <p>GPA đã khai: ${declaration.data.gpaValue ?? "Chưa cập nhật"}/${scale}</p>
          <p>Không nợ môn: ${declaration.data.noFailedSubjects ? "Có" : "Chưa xác nhận"}</p>
          <p>Không gian lận học vụ: ${declaration.data.noAcademicViolation ? "Có" : "Chưa xác nhận"}</p>
        </div>
      `;
    }
  }

  if (category === "hoiNhapTot") {
    const declaration = schoolSelfDeclarations.ngoaiNguCourseScore;

    if (declaration && declaration.data) {
      const scale = declaration.data.scoreScale === "10" ? "10" : "4.0";

      selfDeclareHtml = `
        <div class="activity-item">
          <strong>Dữ liệu ngoại ngữ từ cấp Trường</strong>
          <p>Điểm học phần ngoại ngữ: ${declaration.data.scoreValue ?? "Chưa cập nhật"}/${scale}</p>
        </div>
      `;
    }
  }

  const activitiesHtml =
    relatedActivities.length > 0
      ? relatedActivities
          .map((activity) => {
            return `
              <div class="activity-item">
                <strong>${escapeHtml(activity.name || activity.title || "Hoạt động đã ghi nhận")}</strong>
                <p>Cấp tổ chức: ${escapeHtml(formatAwardLevel(activity.organizerLevel || activity.organizeLevel || activity.awardLevel))}</p>
                <p>Ngày: ${formatDate(activity.date)}</p>
              </div>
            `;
          })
          .join("")
      : "";

  const evidencesHtml =
    relatedEvidences.length > 0
      ? relatedEvidences
          .map((evidence) => {
            return `
              <div class="activity-item">
                <strong>${escapeHtml(evidence.fileName || evidence.title || "Minh chứng đã duyệt")}</strong>
                <p>Cấp xét minh chứng: ${escapeHtml(formatAwardLevel(evidence.awardLevel))}</p>
                <p>Trạng thái: ${formatEvidenceStatus(evidence.status)}</p>
              </div>
            `;
          })
          .join("")
      : "";

  if (!selfDeclareHtml && !activitiesHtml && !evidencesHtml) {
    return `
      <div class="higher-summary-card">
        <h3>Dữ liệu tham khảo từ cấp trước</h3>
        <p class="school-data-note">
          Chưa có dữ liệu đã duyệt từ cấp Trường, cấp ĐHQG-HCM hoặc cấp Thành phố cho tiêu chí này.
        </p>
      </div>
    `;
  }

  return `
    <div class="higher-summary-card">
      <h3>Dữ liệu tham khảo từ cấp trước</h3>
      ${selfDeclareHtml}
      ${activitiesHtml}
      ${evidencesHtml}
    </div>
  `;
}

function renderCentralEvidenceList(evidences) {
  if (!Array.isArray(evidences) || evidences.length === 0) {
    return `
      <div class="higher-summary-card">
        <h3>Minh chứng cấp Trung ương</h3>
        <p class="school-data-note">
          Chưa có minh chứng bổ sung cấp Trung ương cho tiêu chuẩn này.
        </p>
      </div>
    `;
  }

  const html = evidences
    .map((evidence) => {
      const fileUrl = evidence.fileUrl || evidence.url || "#";

      return `
        <div class="activity-item">
          <strong>
            ${escapeHtml(evidence.title || evidence.fileName || evidence.originalName || "Minh chứng")}
          </strong>

          <p>Loại minh chứng: ${escapeHtml(formatEvidenceType(evidence.evidenceType || evidence.type))}</p>
          <p>Trạng thái: ${formatEvidenceStatus(evidence.status)}</p>
          ${evidence.adminReview && evidence.adminReview.note ? `<p><span style="color:#92400e;background:#fef3c7;padding:2px 8px;border-radius:4px;display:inline-block">Ghi chú admin: ${escapeHtml(evidence.adminReview.note)}</span></p>` : ""}
          <p>Ngày nộp: ${formatDate(evidence.createdAt || evidence.uploadedAt)}</p>

          ${
            fileUrl && fileUrl !== "#"
              ? `<p><a href="${fileUrl}" target="_blank" rel="noopener noreferrer">Xem minh chứng</a></p>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  return `
    <div class="higher-summary-card">
      <h3>Minh chứng cấp Trung ương</h3>
      ${html}
    </div>
  `;
}

function formatCentralProgressStatus(status, completedBy) {
  const statusMap = {
    missing_reference:
      "Chưa đủ dữ liệu tham chiếu. Bạn có thể nộp minh chứng bổ sung để admin duyệt thủ công.",

    completed_by_reference:
      "Đạt từ dữ liệu tham chiếu ở cấp Trường, cấp ĐHQG-HCM hoặc cấp Thành phố.",

    completed_by_admin:
      "Đạt từ minh chứng bổ sung cấp Trung ương đã được admin duyệt thủ công.",

    completed:
      "Đạt từ dữ liệu tham chiếu và minh chứng đã được admin xác nhận."
  };

  if (statusMap[status]) {
    return statusMap[status];
  }

  const completedByMap = {
    reference: "Đạt từ dữ liệu tham chiếu.",
    admin_approved_evidence: "Đạt từ minh chứng được admin duyệt.",
    reference_and_admin: "Đạt từ dữ liệu tham chiếu và minh chứng được admin duyệt.",
    none: "Chưa đạt."
  };

  return completedByMap[completedBy] || "Chưa đạt.";
}

function renderCentralStorage(evidences) {
  const table = document.getElementById("centralStorageTable");

  if (!table) return;

  if (!Array.isArray(evidences) || evidences.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="6">Chưa có minh chứng bổ sung cấp Trung ương.</td>
      </tr>
    `;
    return;
  }

  table.innerHTML = evidences.map((evidence) => {
    const fileUrl = evidence.fileUrl || evidence.url || "#";

    const category =
      categoryLabelMap[evidence.category] ||
      categoryLabelMap[evidence.centralCategory] ||
      evidence.category ||
      "Khác";

    return `
      <tr>
        <td>
          ${escapeHtml(
            evidence.title ||
            evidence.fileName ||
            evidence.originalName ||
            "Minh chứng"
          )}
        </td>

        <td>${escapeHtml(category)}</td>

        <td>
          ${escapeHtml(formatEvidenceType(evidence.evidenceType || evidence.type))}
        </td>

        <td>
          ${formatEvidenceStatus(evidence.status)}
          ${evidence.adminReview && evidence.adminReview.note ? `<br><small style="color:#92400e;background:#fef3c7;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px">Ghi chú: ${escapeHtml(evidence.adminReview.note)}</small>` : ""}
        </td>

        <td>${formatDate(evidence.createdAt || evidence.uploadedAt)}</td>

        <td>
          ${
            fileUrl && fileUrl !== "#"
              ? `<a href="${fileUrl}" target="_blank" rel="noopener noreferrer">Xem</a>`
              : "Không có file"
          }
        </td>
      </tr>
    `;
  }).join("");
}

function renderCentralAISuggestions(suggestions) {
  const box = document.getElementById("centralAiSuggestions");

  if (!box) return;

  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    box.innerHTML = "<li>Chưa có gợi ý mới.</li>";
    return;
  }

  box.innerHTML = suggestions.map((item) => {
    const msg = (item.message || item || "").toString();
    const safe = msg
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br>");
    return `<li>${safe}</li>`;
  }).join("");
}

async function submitCentralEvidence(event, category, evidenceGroup = "mandatory") {
  event.preventDefault();

  const config = formIdMap[category]?.[evidenceGroup];

  if (!config) {
    console.error("Invalid central evidence form config:", {
      category,
      evidenceGroup
    });
    return;
  }

  const titleInput = document.getElementById(config.title);
  const fileInput = document.getElementById(config.file);
  const messageBox = document.getElementById(config.message);

  if (!titleInput || !fileInput || !messageBox) {
    console.error("Missing form elements:", config);
    return;
  }

  const title = titleInput.value.trim();
  const file = fileInput.files?.[0];

  messageBox.textContent = "";
  messageBox.className = "";

  if (!title) {
    messageBox.textContent = "Vui lòng nhập tên minh chứng.";
    messageBox.className = "status-text-warning";
    return;
  }

  if (!file) {
    messageBox.textContent = "Vui lòng chọn file minh chứng.";
    messageBox.className = "status-text-warning";
    return;
  }

  let evidenceType = "central_mandatory";
  let additionalCriteriaKey = "";

  if (evidenceGroup === "additional") {
    evidenceType = "central_additional";

    const additionalSelect = document.getElementById(config.key);
    additionalCriteriaKey = additionalSelect?.value || "";

    if (!additionalCriteriaKey) {
      messageBox.textContent = "Vui lòng chọn tiêu chí đạt thêm.";
      messageBox.className = "status-text-warning";
      return;
    }
  }

  const formData = new FormData();

  formData.append("file", file);
  formData.append("title", title);
  formData.append("category", category);
  formData.append("awardLevel", "trung_uong");
  formData.append("evidenceType", evidenceType);

  if (evidenceGroup === "additional") {
    formData.append("additionalCriteriaKey", additionalCriteriaKey);
  }

  try {
    const res = await fetch("/api/student-dashboard/central-evidence", {
      method: "POST",
      credentials: "include",
      body: formData
    });

    const data = await res.json();

    if (!data.success) {
      messageBox.textContent = data.message || "Không thể nộp minh chứng.";
      messageBox.className = "status-text-warning";
      return;
    }

    messageBox.textContent =
      data.message ||
      "Nộp minh chứng thành công. Minh chứng sẽ chờ admin duyệt thủ công.";
    messageBox.className = "status-text-success";

    titleInput.value = "";
    fileInput.value = "";

    if (evidenceGroup === "additional") {
      const additionalSelect = document.getElementById(config.key);
      if (additionalSelect) additionalSelect.value = "";
    }

    await loadCentralLevelDashboard();
  } catch (error) {
    console.error("Submit central evidence error:", error);

    messageBox.textContent = "Không thể kết nối server.";
    messageBox.className = "status-text-warning";
  }
}

window.submitCentralEvidence = submitCentralEvidence;

window.submitCentralEvidence = submitCentralEvidence;

async function logoutStudent() {
  try {
    await fetch("/api/student/logout", {
      method: "POST",
      credentials: "include"
    });
  } catch (error) {
    console.error("Logout error:", error);
  }

  window.location.href = "/student.html";
}

window.logoutStudent = logoutStudent;

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function formatAwardLevel(level) {
  const normalized = String(level || "").toLowerCase();

  const labelMap = {
    khac: "Khác",

    chi_hoi: "Cấp Chi Hội",
    chihoi: "Cấp Chi Hội",
    bo_mon: "Cấp Chi Hội",
    bomon: "Cấp Chi Hội",
    bo: "Cấp Chi Hội",

    khoa: "Cấp Khoa",
    faculty: "Cấp Khoa",
    cap_khoa: "Cấp Khoa",

    truong: "Cấp Trường",
    school: "Cấp Trường",
    cap_truong: "Cấp Trường",

    dhqg: "Cấp ĐHQG-HCM",
    dhqg_hcm: "Cấp ĐHQG-HCM",

    thanh: "Cấp Thành phố",
    thanh_pho: "Cấp Thành phố",
    city: "Cấp Thành phố",

    quoc_gia: "Cấp Quốc gia",
    national: "Cấp Quốc gia",

    trung_uong: "Cấp Trung ương",
    central: "Cấp Trung ương",

    quoc_te: "Cấp Quốc tế",
    international: "Cấp Quốc tế"
  };

  return labelMap[normalized] || level || "Chưa cập nhật";
}

function formatEvidenceType(type) {
  const normalized = String(type || "default").toLowerCase();

  const labelMap = {
    default: "Minh chứng",
    central_mandatory: "Tiêu chuẩn bắt buộc",
    central_additional: "Tiêu chí đạt thêm"
  };

  return labelMap[normalized] || type || "Minh chứng";
}

function formatEvidenceStatus(status) {
  const normalized = String(status || "pending").toLowerCase();

  const labelMap = {
    pending: "Chờ duyệt",
    manual_review: "Chờ admin duyệt thủ công",
    approved: "Đã duyệt",
    approved_by_admin: "Đã được admin duyệt",
    rejected: "Từ chối",
    need_more_info: "Cần bổ sung"
  };

  return labelMap[normalized] || status || "Chờ duyệt";
}

function formatDate(value) {
  if (!value) return "Chưa cập nhật";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa cập nhật";
  }

  return date.toLocaleDateString("vi-VN");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function startCentralAutoRefresh() {
  if (centralAutoRefreshTimer) {
    clearInterval(centralAutoRefreshTimer);
  }

  centralAutoRefreshTimer = setInterval(async () => {

    await loadCentralLevelDashboard({
      silent: true
    });
  }, CENTRAL_AUTO_REFRESH_INTERVAL);
}

window.addEventListener("beforeunload", () => {
  if (centralAutoRefreshTimer) {
    clearInterval(centralAutoRefreshTimer);
  }
});