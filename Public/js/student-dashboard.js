let currentStudent = null;
let studentId = "";

// Dashboard hiện tại đang xử lý cấp Trường.
// Sau này khi làm trang ĐHQG / Thành, chỉ cần đổi currentAwardLevel.
let currentAwardLevel = "truong";

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

    await loadDashboard();
  } catch (error) {
    console.error("Check student session error:", error);
    window.location.href = "/student.html";
  }
}

checkStudentSession();

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
}

async function loadDashboard() {
  try {
    const res = await fetch("/api/student-dashboard/me/dashboard", {
      credentials: "include"
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Không thể tải dashboard");
      window.location.href = "/student.html";
      return;
    }

    renderOverview(data);
    renderCriterionTabs(data);
    renderStorage(data.evidences || []);
    loadSupportContact();
  } catch (error) {
    console.error("Load dashboard error:", error);
    alert("Không thể kết nối server");
  }
}

function renderOverview(data) {
  const student = data.student;

  document.getElementById("studentName").textContent = student.fullName;
  document.getElementById("studentIdText").textContent = student.studentId;
  document.getElementById("classNameText").textContent =
    student.className || "Chưa cập nhật";

  document.getElementById("progressFill").style.width =
    `${data.progressPercent || 0}%`;

  document.getElementById("progressText").textContent =
    `${data.completedCount || 0}/5 tiêu chí đã đạt (${data.progressPercent || 0}%)`;

  const higherLevelCard = document.getElementById("higherLevelCard");

if (higherLevelCard) {
  const isCompletedSchoolLevel =
    Number(data.completedCount || 0) >= 5 ||
    Number(data.progressPercent || 0) >= 100;

  if (isCompletedSchoolLevel) {
    higherLevelCard.classList.remove("hidden");
  } else {
    higherLevelCard.classList.add("hidden");
  }
}

  const aiSuggestions = document.getElementById("aiSuggestions");

  if (!aiSuggestions) return;

  aiSuggestions.innerHTML = "";

  if (!data.aiSuggestions || data.aiSuggestions.length === 0) {
    aiSuggestions.innerHTML = "<li>Bạn chưa có gợi ý AI mới.</li>";
    return;
  }

  data.aiSuggestions.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item.message;
    aiSuggestions.appendChild(li);
  });
}

function getSelfDeclaration(data, category) {
  const declarations = data.selfDeclarations || [];

  return declarations.find((item) => {
    return (
      item.awardLevel === currentAwardLevel &&
      item.category === category
    );
  });
}

function renderSelfDeclarationInfo(data, category) {
  const declaration = getSelfDeclaration(data, category);

  if (!declaration || !declaration.data) {
    return "";
  }

  const declaredAt = declaration.declaredAt
    ? formatDate(declaration.declaredAt)
    : "Chưa cập nhật";

  if (category === "daoDucTot") {
    const trainingScore = declaration.data.trainingScore;

    return `
      <div class="self-declare-info">
        <p>
          <strong>Thông tin sinh viên đã khai:</strong>
        </p>

        <ul>
          <li>Điểm rèn luyện: <strong>${trainingScore ?? "Chưa khai"}/100</strong></li>
          <li>Không vi phạm pháp luật/quy chế: <strong>${declaration.data.noLawViolation && declaration.data.noRuleViolation ? "Có" : "Chưa xác nhận"}</strong></li>
          <li>Đoàn viên/Hội viên hoàn thành xuất sắc: <strong>${declaration.data.excellentUnionMember ? "Có" : "Chưa đạt"}</strong></li>
          <li>Ngày khai: <strong>${declaredAt}</strong></li>
        </ul>

        <p class="${declaration.isCompleted ? "status-text-success" : "status-text-warning"}">
          ${declaration.reason || ""}
        </p>
      </div>
    `;
  }

  if (category === "hocTapTot") {
    const gpaScale = declaration.data.gpaScale || "";
    const gpaValue = declaration.data.gpaValue;

    return `
      <div class="self-declare-info">
        <p>
          <strong>Thông tin sinh viên đã khai:</strong>
        </p>

        <ul>
          <li>GPA: <strong>${gpaValue ?? "Chưa khai"}/${gpaScale === "10" ? "10" : "4.0"}</strong></li>
          <li>Không nợ môn/học phần/tín chỉ: <strong>${declaration.data.noFailedSubjects ? "Có" : "Chưa xác nhận"}</strong></li>
          <li>Không gian lận trong thi cử: <strong>${declaration.data.noAcademicViolation ? "Có" : "Chưa xác nhận"}</strong></li>
          <li>Thái độ học tập đúng đắn: <strong>${declaration.data.properLearningAttitude ? "Có" : "Chưa xác nhận"}</strong></li>
          <li>Ngày khai: <strong>${declaredAt}</strong></li>
        </ul>

        <p class="${declaration.isCompleted ? "status-text-success" : "status-text-warning"}">
          ${declaration.reason || ""}
        </p>
      </div>
    `;
  }

  return "";
}

function renderNgoaiNguCourseScoreInfo(progressItem) {
  const declaration = progressItem.ngoaiNguCourseScoreDeclaration || null;
  const result = progressItem.ngoaiNguCourseScoreResult || null;

  if (!declaration || !declaration.data) {
    return "";
  }

  const scoreScale = declaration.data.scoreScale || "4";
  const scoreValue = declaration.data.scoreValue;
  const declaredAt = declaration.declaredAt
    ? formatDate(declaration.declaredAt)
    : "Chưa cập nhật";

  return `
    <div class="self-declare-info">
      <p>
        <strong>Thông tin sinh viên đã khai:</strong>
      </p>

      <ul>
        <li>Hệ điểm: <strong>${scoreScale === "10" ? "Hệ 10" : "Hệ 4.0"}</strong></li>
        <li>Điểm học phần ngoại ngữ: <strong>${scoreValue ?? "Chưa khai"}/${scoreScale === "10" ? "10" : "4.0"}</strong></li>
        <li>Ngày khai: <strong>${declaredAt}</strong></li>
      </ul>

      <p class="${result?.isCompleted ? "status-text-success" : "status-text-warning"}">
        ${result?.reason || ""}
      </p>
    </div>
  `;
}

function renderCriterionTabs(data) {
  categories.forEach((category) => {
    const container = document.getElementById(`${category}Content`);

    if (!container) return;

    const progressItem = data.progress[category];

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
          ${progressItem.mandatoryPassed ? "✅" : "❌"}
          <strong>Tiêu chuẩn bắt buộc:</strong>
          GPA, không nợ môn, không gian lận và thái độ học tập đúng đắn
        </div>

        <div class="activity-item">
          ${progressItem.extraPassed ? "✅" : "❌"}
          <strong>Tiêu chuẩn khác:</strong>
          ${
            progressItem.academicDirectPassed
              ? "Đã ghi nhận ít nhất 01 minh chứng học thuật đạt trực tiếp."
              : `Cần đạt ít nhất 01 minh chứng học thuật hợp lệ. Riêng nhóm hoạt động học thuật cần ghi nhận đủ 3 hoạt động. Hiện đã ghi nhận: ${progressItem.academicActivityCount || 0}/3 hoạt động.`
          }
        </div>
      `;
    }

    if (category === "tinhNguyenTot") {
      subProgressHtml = `
        <hr>
        <h3>Tiến độ Tình nguyện tốt</h3>

        <div class="activity-item">
          ${
            progressItem.hasVolunteerAward || progressItem.volunteerDays >= 5
              ? "✅"
              : "❌"
          }
          <strong>Tiêu chuẩn đạt:</strong>
          Sinh viên cần đạt ít nhất 01 trong 02 hướng: đủ 05 ngày tình nguyện trong năm học hoặc có khen thưởng tình nguyện từ cấp Trường trở lên.
        </div>

        <div class="activity-item">
          ${progressItem.volunteerDays >= 5 ? "✅" : "❌"}
          <strong>Số ngày tình nguyện đã ghi nhận:</strong>
          ${progressItem.volunteerDays || 0}/5 ngày
        </div>

        <div class="activity-item">
          ${progressItem.hasVolunteerAward ? "✅" : "❌"}
          <strong>Khen thưởng tình nguyện:</strong>
          ${
            progressItem.hasVolunteerAward
              ? "Đã ghi nhận khen thưởng từ cấp Trường trở lên."
              : "Chưa ghi nhận khen thưởng từ cấp Trường trở lên."
          }
        </div>
      `;
    }

    if (category === "hoiNhapTot") {
  const sub = progressItem.subProgress || {};
  const ngoaiNguCourseScoreResult =
    progressItem.ngoaiNguCourseScoreResult || null;

  const ngoaiNguCourseScoreDeclaration =
    progressItem.ngoaiNguCourseScoreDeclaration || null;

  const ngoaiNguCourseScoreInfoHtml =
    renderNgoaiNguCourseScoreInfo(progressItem);

  subProgressHtml = `
    <hr>
    <h3>Tiến độ Hội nhập tốt</h3>

    <div class="activity-item">
      ${sub.ngoaiNgu ? "✅" : "❌"}
      <strong>Ngoại ngữ:</strong> Đạt ít nhất 01 tiêu chuẩn
    </div>

    <div class="activity-item">
      ${sub.kyNang ? "✅" : "❌"}
      <strong>Kỹ năng:</strong> Đạt ít nhất 01 tiêu chuẩn
    </div>

    <div class="activity-item">
      ${sub.hoiNhap ? "✅" : "❌"}
      <strong>Hoạt động hội nhập:</strong> Đạt ít nhất 01 tiêu chuẩn
    </div>

    ${ngoaiNguCourseScoreInfoHtml}

    <div class="self-declare-card" id="ngoaiNguForm">
      <h3>Khai điểm học phần ngoại ngữ</h3>

      <div class="declare-note">
        Hệ thống sẽ lưu điểm học phần ngoại ngữ ở cấp Trường.
        Khi xét cấp ĐHQG-HCM hoặc cấp Thành phố, hệ thống sẽ tự lấy dữ liệu này
        và so sánh với điều kiện của từng cấp.
      </div>

      <div class="form-group">
        <label for="ngoaiNguScoreScale">
          Hệ điểm <span class="required">*</span>
        </label>

        <select id="ngoaiNguScoreScale" onchange="updateNgoaiNguScoreHint()">
          <option value="4" ${
            ngoaiNguCourseScoreDeclaration?.data?.scoreScale === "4"
              ? "selected"
              : ""
          }>Hệ 4.0</option>

          <option value="10" ${
            ngoaiNguCourseScoreDeclaration?.data?.scoreScale === "10"
              ? "selected"
              : ""
          }>Hệ 10</option>
        </select>

        <small id="ngoaiNguScoreHint">
          ${
            ngoaiNguCourseScoreDeclaration?.data?.scoreScale === "10"
              ? "Cấp Trường và cấp ĐHQG-HCM cần từ 8.5/10 trở lên. Cấp Thành phố cần từ 8.0/10 trở lên."
              : "Cấp Trường và cấp ĐHQG-HCM cần từ 3.4/4.0 trở lên. Cấp Thành phố cần từ 3.2/4.0 trở lên."
          }
        </small>
      </div>

      <div class="form-group">
        <label for="ngoaiNguScoreValue">
          Điểm học phần ngoại ngữ <span class="required">*</span>
        </label>

        <input
          type="number"
          id="ngoaiNguScoreValue"
          step="0.01"
          min="0"
          placeholder="${
            ngoaiNguCourseScoreDeclaration?.data?.scoreScale === "10"
              ? "Ví dụ: 8.7"
              : "Ví dụ: 3.5"
          }"
          value="${ngoaiNguCourseScoreDeclaration?.data?.scoreValue || ""}"
        />

        <small>
          Điểm này dùng cho phần Ngoại ngữ của tiêu chí Hội nhập tốt.
        </small>
      </div>

      <button onclick="submitNgoaiNguCourseScore()">
        Kiểm tra & Xác nhận
      </button>

      <div
        id="ngoaiNguScoreMessage"
        class="declare-result ${
          ngoaiNguCourseScoreResult ? "" : "hidden"
        } ${
          ngoaiNguCourseScoreResult?.isCompleted
            ? "result-success"
            : ngoaiNguCourseScoreResult
            ? "result-error"
            : ""
        }"
      >
        ${
          ngoaiNguCourseScoreResult
            ? `
              <p class="result-title">
                ${
                  ngoaiNguCourseScoreResult.isCompleted
                    ? "Đạt yêu cầu điểm ngoại ngữ"
                    : "Chưa đạt yêu cầu điểm ngoại ngữ"
                }
              </p>
              <p>${ngoaiNguCourseScoreResult.reason || ""}</p>
            `
            : ""
        }
      </div>
    </div>
  `;
}

    const activities = progressItem.activities || [];
    const evidences = progressItem.evidences || [];
    const criteria = progressItem.criteria || null;
    const shouldShowUpload = uploadCategories.includes(category);
    const selfDeclarationInfoHtml = renderSelfDeclarationInfo(data, category);

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

        ${selfDeclarationInfoHtml}

        ${subProgressHtml}

        ${
          criteria
            ? `
              <hr>

              <h3>Tiêu chuẩn cần đạt</h3>
              <ul>
                ${(criteria.batBuoc || []).map((item) => `<li>${item}</li>`).join("")}
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
                        ✅ ${activity.title}
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
                        📄 ${evidence.fileName}
                        <br>
                        <small>Trạng thái: ${formatStatus(evidence.status)}</small>
                        ${
                          evidence.aiResult && evidence.aiResult.reason
                            ? `<br><small>Ghi chú: ${evidence.aiResult.reason}</small>`
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

              <h3>Upload minh chứng ngoài danh sách</h3>

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
        <td colspan="5">Chưa có file minh chứng nào.</td>
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
      <td>${formatStatus(evidence.status)}</td>
      <td>${formatDate(evidence.createdAt)}</td>
      <td>
        ${
          fileUrl && !fileUrl.includes("self-declare")
            ? `
              <a href="${fileUrl}" target="_blank" class="download-btn">
                Xem file
              </a>
            `
            : `
              <span class="no-file-text">Không có file</span>
            `
        }
      </td>
    `;

    table.appendChild(row);
  });
}

// ===============================
// Form tự khai Đạo đức tốt
// ===============================
async function submitDaoDuc() {
  const diemRenLuyen = document.getElementById("diemRenLuyen").value;
  const danhGiaDoanVien = document.getElementById("danhGiaDoanVien").value;
  const khongViPham = document.getElementById("khongViPham").checked;
  const result = document.getElementById("daoDucResult");

  result.className = "declare-result";
  result.innerHTML = "Đang kiểm tra...";
  result.classList.remove("hidden");

  if (!diemRenLuyen || !danhGiaDoanVien) {
    result.className = "declare-result result-error";
    result.innerHTML = "Vui lòng điền đầy đủ thông tin bắt buộc.";
    return;
  }

  try {
    const res = await fetch("/api/student/declare/dao-duc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        awardLevel: currentAwardLevel,
        trainingScore: Number(diemRenLuyen),
        noLawViolation: khongViPham,
        noRuleViolation: khongViPham,
        excellentUnionMember: danhGiaDoanVien === "hoan_thanh_xuat_sac"
      })
    });

    const data = await res.json();

    renderDeclareResult(result, data);

    if (data.success && data.isCompleted) {
      setTimeout(() => {
        const form = document.getElementById("daoDucForm");
        if (form) form.style.display = "none";
        loadDashboard();
      }, 1200);
    }
  } catch (error) {
    console.error("Submit dao duc error:", error);
    result.className = "declare-result result-error";
    result.innerHTML = "Không thể kết nối server.";
  }
}

function updateGPAHint() {
  const thang = document.getElementById("thangDiem").value;
  const hint = document.getElementById("gpaHint");
  const input = document.getElementById("gpaInput");

  if (!hint || !input) return;

  if (thang === "4") {
    hint.textContent = "Cấp Trường cần đạt từ 2.8/4.0 trở lên";
    input.max = 4;
    input.placeholder = "Ví dụ: 3.2";
  } else {
    hint.textContent = "Cấp Trường cần đạt từ 7.0/10 trở lên";
    input.max = 10;
    input.placeholder = "Ví dụ: 8.5";
  }
}

function updateNgoaiNguScoreHint() {
  const scoreScale = document.getElementById("ngoaiNguScoreScale")?.value;
  const hint = document.getElementById("ngoaiNguScoreHint");
  const input = document.getElementById("ngoaiNguScoreValue");

  if (!hint || !input) return;

  if (scoreScale === "10") {
    hint.textContent =
      "Cấp Trường và cấp ĐHQG-HCM cần từ 8.5/10 trở lên. Cấp Thành phố cần từ 8.0/10 trở lên.";
    input.max = 10;
    input.placeholder = "Ví dụ: 8.7";
  } else {
    hint.textContent =
      "Cấp Trường và cấp ĐHQG-HCM cần từ 3.4/4.0 trở lên. Cấp Thành phố cần từ 3.2/4.0 trở lên.";
    input.max = 4;
    input.placeholder = "Ví dụ: 3.5";
  }
}

// ===============================
// Form tự khai Học tập tốt
// ===============================
async function submitHocTap() {
  const gpa = document.getElementById("gpaInput").value;
  const thangDiem = document.getElementById("thangDiem").value;
  const khongNoMon = document.getElementById("khongNoMon").checked;

  const noAcademicViolationEl = document.getElementById("noAcademicViolation");
  const properLearningAttitudeEl = document.getElementById("properLearningAttitude");

  const noAcademicViolation = noAcademicViolationEl
    ? noAcademicViolationEl.checked
    : true;

  const properLearningAttitude = properLearningAttitudeEl
    ? properLearningAttitudeEl.checked
    : true;

  const result = document.getElementById("hocTapResult");

  result.className = "declare-result";
  result.innerHTML = "Đang kiểm tra...";
  result.classList.remove("hidden");

  if (!gpa) {
    result.className = "declare-result result-error";
    result.innerHTML = "Vui lòng nhập GPA.";
    return;
  }

  try {
    const res = await fetch("/api/student/declare/hoc-tap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        awardLevel: currentAwardLevel,
        gpaScale: thangDiem,
        gpaValue: Number(gpa),
        studentType: "university",
        noFailedSubjects: khongNoMon,
        noAcademicViolation,
        properLearningAttitude
      })
    });

    const data = await res.json();

    renderDeclareResult(result, data);

    if (data.success && data.isCompleted) {
      setTimeout(() => {
        const form = document.getElementById("hocTapForm");
        if (form) form.style.display = "none";
        loadDashboard();
      }, 1200);
    }
  } catch (error) {
    console.error("Submit hoc tap error:", error);
    result.className = "declare-result result-error";
    result.innerHTML = "Không thể kết nối server.";
  }
}

function renderDeclareResult(el, data) {
  if (!data.success) {
    el.className = "declare-result result-error";
    el.innerHTML = data.message || "Không thể xử lý tự khai.";
    return;
  }

  const isCompleted = data.isCompleted === true;

  if (isCompleted) {
    el.className = "declare-result result-success";
    el.innerHTML = `
      <p class="result-title">${data.message || "Đạt yêu cầu"}</p>
      ${
        data.requiredText
          ? `<p>Yêu cầu tối thiểu: <strong>${data.requiredText}</strong></p>`
          : ""
      }
    `;
  } else {
    el.className = "declare-result result-error";
    el.innerHTML = `
      <p class="result-title">Chưa đạt yêu cầu</p>
      <p>${data.reason || data.message || "Bạn chưa đáp ứng đủ điều kiện."}</p>
      ${
        data.requiredText
          ? `<p>Yêu cầu tối thiểu: <strong>${data.requiredText}</strong></p>`
          : ""
      }
    `;
  }
}

async function uploadEvidence(category) {
  const fileInput = document.getElementById(`file-${category}`);
  const message = document.getElementById(`upload-message-${category}`);

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

    message.textContent = "Upload thành công. AI đang kiểm tra minh chứng...";

    if (data.evidence && data.evidence._id && data.aiProcessed) {
      pollEvidenceStatus(data.evidence._id, category);
    } else {
      loadDashboard();
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
    attempts++;

    if (attempts >= maxAttempts) {
      clearInterval(intervalId);
      message.textContent =
        "AI xử lý lâu hơn dự kiến. Bạn có thể xem lại trong Kho lưu trữ.";
      loadDashboard();
      return;
    }

    try {
      const res = await fetch(`/api/evidence/${evidenceId}/status`, {
        credentials: "include"
      });

      const data = await res.json();

      if (!data.success) {
        message.textContent = data.message || "Không thể kiểm tra trạng thái AI.";
        clearInterval(intervalId);
        return;
      }

      const evidence = data.evidence;

      if (evidence.status === "pending") {
        message.textContent = `AI đang kiểm tra minh chứng... (${attempts}/${maxAttempts})`;
        return;
      }

      clearInterval(intervalId);

      if (evidence.status === "ai_valid") {
        message.textContent =
          evidence.aiResult?.reason ||
          "AI đã xác nhận minh chứng hợp lệ.";
      } else if (evidence.status === "ai_invalid") {
        message.textContent =
          evidence.aiResult?.reason ||
          "AI đánh giá minh chứng chưa hợp lệ.";
      } else if (evidence.status === "manual_review") {
        message.textContent =
          evidence.aiResult?.reason ||
          "Minh chứng cần admin kiểm tra thủ công.";
      } else {
        message.textContent = `Trạng thái minh chứng: ${formatStatus(evidence.status)}`;
      }

      loadDashboard();
    } catch (error) {
      console.error("Poll evidence status error:", error);
      clearInterval(intervalId);
      message.textContent = "Không thể kiểm tra kết quả AI.";
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
  if (status === "ai_valid") return "AI đánh giá hợp lệ";
  if (status === "ai_invalid") return "AI đánh giá không hợp lệ";
  if (status === "manual_review") return "Cần admin kiểm tra";
  if (status === "approved_by_admin") return "Admin đã duyệt";
  if (status === "rejected_by_admin") return "Admin từ chối";
  if (status === "need_more_info") return "Cần bổ sung minh chứng";
  return status || "Chưa cập nhật";
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

function goToHigherLevel(level) {
  if (level === "dhqg") {
    window.location.href = "/student-higher-level.html?level=dhqg";
    return;
  }

  if (level === "thanh") {
    window.location.href = "/student-higher-level.html?level=thanh";
    return;
  }

  alert("Cấp xét không hợp lệ.");
}

async function submitNgoaiNguCourseScore() {
  const scoreScaleInput = document.getElementById("ngoaiNguScoreScale");
  const scoreValueInput = document.getElementById("ngoaiNguScoreValue");
  const result = document.getElementById("ngoaiNguScoreMessage");

  if (!scoreScaleInput || !scoreValueInput || !result) return;

  const scoreScale = scoreScaleInput.value;
  const scoreValue = scoreValueInput.value;

  result.className = "declare-result";
  result.innerHTML = "Đang kiểm tra...";
  result.classList.remove("hidden");

  if (!scoreValue) {
    result.className = "declare-result result-error";
    result.innerHTML = "Vui lòng nhập điểm học phần ngoại ngữ.";
    return;
  }

  try {
    const res = await fetch("/api/student-dashboard/declare/ngoai-ngu", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        scoreScale,
        scoreValue
      })
    });

    const data = await res.json();

    if (!data.success) {
      result.className = "declare-result result-error";
      result.innerHTML = data.message || "Không thể lưu điểm ngoại ngữ.";
      return;
    }

    const isCompleted = data.result?.isCompleted === true;

    result.className = isCompleted
      ? "declare-result result-success"
      : "declare-result result-error";

    result.innerHTML = `
      <p class="result-title">
        ${
          isCompleted
            ? "Đạt yêu cầu điểm ngoại ngữ cấp Trường"
            : "Chưa đạt yêu cầu điểm ngoại ngữ cấp Trường"
        }
      </p>
      <p>${data.result?.reason || data.message || ""}</p>
    `;

    setTimeout(() => {
      loadDashboard();
    }, 1000);
  } catch (error) {
    console.error("Submit ngoai ngu score error:", error);
    result.className = "declare-result result-error";
    result.innerHTML = "Không thể kết nối server.";
  }
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

async function loadSupportContact() {
  const classBox = document.getElementById("classSupportInfo");
  const globalBox = document.getElementById("globalSupportInfo");

  if (!classBox || !globalBox) return;

  try {
    const res = await fetch("/api/student/support-contact", {
      credentials: "include"
    });

    const data = await res.json();

    if (!data.success) {
      classBox.innerHTML = `<p>${data.message || "Không thể tải thông tin hỗ trợ."}</p>`;
      globalBox.innerHTML = "";
      return;
    }

    const classSupport = data.support?.classSupport;
    const global = data.support?.global;

    const supportClassNameText = document.getElementById("supportClassNameText");

if (supportClassNameText) {
  supportClassNameText.textContent =
    data.student?.className || currentStudent?.className || "Chưa cập nhật";
}

    if (classSupport) {
  const uyVienBCHList = Array.isArray(classSupport.uyVienBCHList)
    ? classSupport.uyVienBCHList
    : [];

  const renderPerson = (role, person) => {
    return `
      <div class="support-person">
        <p class="support-role">${role}</p>
        <p class="support-name">${person?.fullName || "Chưa cập nhật"}</p>
        <p>Zalo/SĐT:
          <strong>${person?.zalo || person?.phone || "Chưa cập nhật"}</strong>
        </p>
      </div>
    `;
  };

  classBox.innerHTML = `
    ${renderPerson("Chi Hội trưởng", classSupport.chiHoiTruong)}

    ${
  classSupport.chiHoiPho?.fullName ||
  classSupport.chiHoiPho?.phone ||
  classSupport.chiHoiPho?.zalo
    ? renderPerson("Chi Hội phó", classSupport.chiHoiPho)
    : ""
}

    ${
      uyVienBCHList.length > 0
        ? uyVienBCHList
            .map((person, index) => {
              return renderPerson(`Ủy viên BCH ${index + 1}`, person);
            })
            .join("")
        : ""
    }

   ${
  classSupport.ctvBCH?.fullName ||
  classSupport.ctvBCH?.phone ||
  classSupport.ctvBCH?.zalo
    ? renderPerson("CTV BCH", classSupport.ctvBCH)
    : ""
}
  `;
} else {
      classBox.innerHTML = `
        <p class="status-text-warning">
          Chưa có thông tin hỗ trợ cho lớp ${data.student?.className || ""}.
        </p>
      `;
    }

    globalBox.innerHTML = `
      <div class="support-link-list">
        <a href="${global?.fanpageUrl || "#"}" target="_blank" rel="noopener">
          Fanpage: ${global?.fanpageName || "Liên Chi hội"}
        </a>

        <a href="mailto:${global?.supportEmail || ""}">
          Email: ${global?.supportEmail || "Chưa cập nhật"}
        </a>

        <a href="${global?.zaloGroupUrl || "#"}" target="_blank" rel="noopener">
          Group Zalo: ${global?.zaloGroupName || "Group Zalo hỗ trợ"}
        </a>
      </div>
    `;
  } catch (error) {
    console.error("Load support contact error:", error);
    classBox.innerHTML = `<p>Không thể kết nối server.</p>`;
    globalBox.innerHTML = "";
  }
}