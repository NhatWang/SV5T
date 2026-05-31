function normalizeBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "1";
}

function normalizeNumber(value) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return 0;
  }

  return number;
}

function evaluateDaoDucSelfDeclare(awardLevel, data = {}) {
  const trainingScore = normalizeNumber(data.trainingScore);

  const noLawViolation = normalizeBoolean(data.noLawViolation);
  const noRuleViolation = normalizeBoolean(data.noRuleViolation);
  const excellentUnionMember = normalizeBoolean(data.excellentUnionMember);

  if (awardLevel === "truong") {
    const isCompleted =
      trainingScore >= 70 &&
      noLawViolation &&
      noRuleViolation &&
      excellentUnionMember;

    return {
      isCompleted,
      trainingScore,
      trainingScorePassed: trainingScore >= 70,
      requiredTrainingScore: 70,
      noLawViolation,
      noRuleViolation,
      excellentUnionMember,
      reason: isCompleted
        ? `Đạt điều kiện Đạo đức tốt cấp Trường. Điểm rèn luyện ${trainingScore}/100 đạt yêu cầu tối thiểu 70/100.`
        : `Chưa đạt Đạo đức tốt cấp Trường: cần điểm rèn luyện từ 70 trở lên, không vi phạm pháp luật/quy chế và Đoàn viên hoặc Hội viên hoàn thành xuất sắc nhiệm vụ.`
    };
  }

  if (awardLevel === "dhqg") {
    const isCompleted =
      trainingScore >= 80 &&
      noLawViolation &&
      noRuleViolation &&
      excellentUnionMember;

    return {
      isCompleted,
      trainingScore,
      trainingScorePassed: trainingScore >= 80,
      requiredTrainingScore: 80,
      noLawViolation,
      noRuleViolation,
      excellentUnionMember,
      reason: isCompleted
        ? `Đạt điều kiện Đạo đức tốt cấp ĐHQG-HCM. Điểm rèn luyện ${trainingScore}/100 đạt yêu cầu tối thiểu 80/100.`
        : `Chưa đạt Đạo đức tốt cấp ĐHQG-HCM: cần điểm rèn luyện từ 80 trở lên, không vi phạm pháp luật/quy chế và Đoàn viên hoặc Hội viên hoàn thành xuất sắc nhiệm vụ.`
    };
  }

  if (awardLevel === "thanh") {
    const isCompleted =
      trainingScore >= 90 &&
      noLawViolation &&
      noRuleViolation &&
      excellentUnionMember;

    return {
      isCompleted,
      trainingScore,
      trainingScorePassed: trainingScore >= 90,
      requiredTrainingScore: 90,
      noLawViolation,
      noRuleViolation,
      excellentUnionMember,
      reason: isCompleted
        ? `Đạt điều kiện Đạo đức tốt cấp Thành phố. Điểm rèn luyện ${trainingScore}/100 đạt yêu cầu tối thiểu 90/100.`
        : `Chưa đạt Đạo đức tốt cấp Thành phố: cần điểm rèn luyện từ 90 trở lên, không vi phạm pháp luật/quy chế và Đoàn viên hoặc Hội viên hoàn thành xuất sắc nhiệm vụ.`
    };
  }

  if (awardLevel === "trung_uong") {
  const isCompleted =
    trainingScore >= 95 &&
    noLawViolation &&
    noRuleViolation;

  return {
    isCompleted,
    trainingScore,
    trainingScorePassed: trainingScore >= 95,
    requiredTrainingScore: 95,
    noLawViolation,
    noRuleViolation,
    excellentUnionMember,
    reason: isCompleted
      ? `Đạt điều kiện Đạo đức tốt cấp Trung ương. Điểm rèn luyện ${trainingScore}/100 đạt yêu cầu tối thiểu 95/100 và không vi phạm pháp luật/quy chế.`
      : `Chưa đạt Đạo đức tốt cấp Trung ương: cần điểm rèn luyện từ 95 trở lên và xác nhận không vi phạm pháp luật, quy chế, nội quy của nhà trường, địa phương và cộng đồng.`
  };
}


  return {
    isCompleted: false,
    trainingScore,
    trainingScorePassed: false,
    requiredTrainingScore: null,
    noLawViolation,
    noRuleViolation,
    excellentUnionMember,
    reason: "Cấp xét không hợp lệ."
  };
}

function getRequiredGpaForHocTap(awardLevel, data = {}) {
  const gpaScale = String(data.gpaScale || "4");

  if (awardLevel === "truong") {
    return gpaScale === "10"
      ? {
          requiredValue: 7.0,
          requiredText: "7.0/10",
          note: "Cấp Trường"
        }
      : {
          requiredValue: 2.8,
          requiredText: "2.8/4.0",
          note: "Cấp Trường"
        };
  }

  if (awardLevel === "dhqg") {
    return gpaScale === "10"
      ? {
          requiredValue: 8.0,
          requiredText: "8.0/10",
          note: "Cấp ĐHQG-HCM"
        }
      : {
          requiredValue: 3.2,
          requiredText: "3.2/4.0",
          note: "Cấp ĐHQG-HCM"
        };
  }

  if (awardLevel === "thanh") {
    return gpaScale === "10"
      ? {
          requiredValue: 8.5,
          requiredText: "8.5/10",
          note: "Cấp Thành phố - hệ Đại học/Học viện"
        }
      : {
          requiredValue: 3.4,
          requiredText: "3.4/4.0",
          note: "Cấp Thành phố - hệ Đại học/Học viện"
        };
  }

  if (awardLevel === "trung_uong") {
  return gpaScale === "10"
    ? {
        requiredValue: 8.5,
        requiredText: "8.5/10",
        note: "Cấp Trung ương - hệ Đại học/Trường Đại học/Học viện"
      }
    : {
        requiredValue: 3.4,
        requiredText: "3.4/4.0",
        note: "Cấp Trung ương - hệ Đại học/Trường Đại học/Học viện"
      };
}

  return {
    requiredValue: null,
    requiredText: "",
    note: "Cấp xét không hợp lệ"
  };
}

function evaluateHocTapMandatorySelfDeclare(awardLevel, data = {}) {
  const gpaScale = String(data.gpaScale || "4");
  const gpaValue = normalizeNumber(data.gpaValue);

  const properLearningAttitude = normalizeBoolean(data.properLearningAttitude);
  const noAcademicViolation = normalizeBoolean(data.noAcademicViolation);
  const noFailedSubjects = normalizeBoolean(data.noFailedSubjects);

  const {
    requiredValue,
    requiredText,
    note
  } = getRequiredGpaForHocTap(awardLevel, data);

  if (requiredValue === null) {
    return {
      isCompleted: false,
      gpaPassed: false,
      gpaScale,
      gpaValue,
      requiredValue: null,
      requiredText: "",
      note,
      properLearningAttitude,
      noAcademicViolation,
      noFailedSubjects,
      reason: "Cấp xét không hợp lệ."
    };
  }

  const gpaPassed = gpaValue >= requiredValue;

  const isCompleted =
    gpaPassed &&
    properLearningAttitude &&
    noAcademicViolation &&
    noFailedSubjects;

  const missingItems = [];

  if (!gpaPassed) {
    missingItems.push(`GPA chưa đạt yêu cầu tối thiểu ${requiredText}`);
  }

  if (!noFailedSubjects) {
    missingItems.push("chưa xác nhận không nợ môn/học phần/tín chỉ");
  }

  if (!noAcademicViolation) {
    missingItems.push("chưa xác nhận không gian lận trong học tập, thi cử");
  }

  if (!properLearningAttitude) {
    missingItems.push("chưa xác nhận có động cơ, thái độ học tập đúng đắn");
  }

  return {
    isCompleted,
    gpaPassed,
    gpaScale,
    gpaValue,
    requiredValue,
    requiredText,
    note,
    properLearningAttitude,
    noAcademicViolation,
    noFailedSubjects,
    reason: isCompleted
      ? `Đạt điều kiện học tập bắt buộc. GPA ${gpaValue}/${
          gpaScale === "10" ? "10" : "4.0"
        } đạt yêu cầu tối thiểu ${requiredText} của ${note}.`
      : `Chưa đạt điều kiện học tập bắt buộc của ${note}: ${missingItems.join(", ")}.`
  };
}

function evaluateNgoaiNguCourseScore(awardLevel, data = {}) {
  const scoreScale = String(data.scoreScale || "4");
  const scoreValue = normalizeNumber(data.scoreValue);

  let requiredValue = null;
  let requiredText = "";

  if (
  awardLevel === "truong" ||
  awardLevel === "dhqg" ||
  awardLevel === "trung_uong"
) {
  if (scoreScale === "10") {
    requiredValue = 8.5;
    requiredText = "8.5/10";
  } else {
    requiredValue = 3.4;
    requiredText = "3.4/4.0";
  }
}

  if (awardLevel === "thanh") {
    if (scoreScale === "10") {
      requiredValue = 8.0;
      requiredText = "8.0/10";
    } else {
      requiredValue = 3.2;
      requiredText = "3.2/4.0";
    }
  }

  if (requiredValue === null) {
    return {
      isCompleted: false,
      scorePassed: false,
      scoreScale,
      scoreValue,
      requiredValue: null,
      requiredText: "",
      reason: "Cấp xét không hợp lệ."
    };
  }

  const scorePassed = scoreValue >= requiredValue;

  return {
    isCompleted: scorePassed,
    scorePassed,
    scoreScale,
    scoreValue,
    requiredValue,
    requiredText,
    reason: scorePassed
      ? `Đạt điều kiện điểm học phần ngoại ngữ. Điểm đã khai ${scoreValue}/${scoreScale === "10" ? "10" : "4.0"} đạt yêu cầu tối thiểu ${requiredText}.`
      : `Chưa đạt điều kiện điểm học phần ngoại ngữ. Cần tối thiểu ${requiredText}, điểm đã khai là ${scoreValue}/${scoreScale === "10" ? "10" : "4.0"}.`
  };
}

module.exports = {
  normalizeBoolean,
  normalizeNumber,
  evaluateDaoDucSelfDeclare,
  getRequiredGpaForHocTap,
  evaluateNgoaiNguCourseScore,
  evaluateHocTapMandatorySelfDeclare
};