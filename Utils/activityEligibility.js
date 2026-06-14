const ORGANIZER_LEVEL_RANK = {
  khac: 0,
  chi_hoi: 1,
  khoa: 2,
  truong: 3,
  dhqg: 4,
  thanh: 5,
  quoc_gia: 6,
  quoc_te: 7
};

const KY_NANG_TYPES_BY_LEVEL = {
  truong: [
    "skill_course",
    "skill_competition_award_khoa_or_above",
    "skill_competition_award_truong_or_above",
    "skill_reporter_khoa_or_above",
    "skill_reporter_truong_or_above",
    "union_association_award_truong_or_above",
    "student_leader_competition_finalist_truong_or_above"
  ],

  dhqg: [
    "skill_course",
    "skill_competition_award_truong_or_above",
    "skill_reporter_truong_or_above",
    "union_association_award_truong_or_above"
  ],

  thanh: [
    "skill_course",
    "union_association_award_truong_or_above"
  ]
};

const HOI_NHAP_TYPES_BY_LEVEL = {
  truong: [
    "international_exchange",
    "integration_competition_khoa_or_above",
    "integration_competition_award_truong_or_above",
    "foreign_language_academic_competition_award_truong_or_above",
    "official_international_program_member",
    "international_program_volunteer",
    "integration_activity_truong_or_above"
  ],

  dhqg: [
    "international_exchange",
    "integration_competition_award_truong_or_above",
    "foreign_language_academic_competition_award_truong_or_above",
    "official_international_program_member",
    "international_program_volunteer"
  ],

  thanh: [
    "international_exchange",
    "official_international_program_member",
    "international_program_volunteer",
    "integration_activity_truong_or_above"
  ]
};

function isValidHoiNhapEvidenceForLevel(awardLevel, hoiNhapEvidenceType) {
  const allowedTypes = HOI_NHAP_TYPES_BY_LEVEL[awardLevel] || [];
  return allowedTypes.includes(hoiNhapEvidenceType);
}

function normalizeOrganizerLevel(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "_")
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .replace(/_+/g, "_");

  if (!raw) return "khac";

  const aliases = {
    chi_hoi: "chi_hoi",
    chihoi: "chi_hoi",
    chi: "chi_hoi",
    bo_mon: "chi_hoi",
    bomon: "chi_hoi",
    bo: "chi_hoi",
    mon: "chi_hoi",

    khoa: "khoa",
    cap_khoa: "khoa",

    truong: "truong",
    cap_truong: "truong",
    nha_truong: "truong",

    dhqg: "dhqg",
    dhqg_hcm: "dhqg",
    dai_hoc_quoc_gia: "dhqg",
    dai_hoc_quoc_gia_hcm: "dhqg",
    vnu: "dhqg",
    vnu_hcm: "dhqg",

    thanh: "thanh",
    thanh_pho: "thanh",
    cap_thanh: "thanh",
    tp: "thanh",
    tphcm: "thanh",
    tp_hcm: "thanh",
    thanh_pho_ho_chi_minh: "thanh",

    quoc_gia: "quoc_gia",
    cap_quoc_gia: "quoc_gia",
    trung_uong: "quoc_gia",
    cap_trung_uong: "quoc_gia",

    quoc_te: "quoc_te",
    cap_quoc_te: "quoc_te",
    international: "quoc_te"
  };

  return aliases[raw] || "khac";
}

function getLevelRank(level) {
  return ORGANIZER_LEVEL_RANK[level] || 0;
}

function isAtLeast(level, minimumLevel) {
  return getLevelRank(level) >= getLevelRank(minimumLevel);
}

function uniqueLevels(levels) {
  return [...new Set(levels)].filter((level) => {
    return ["truong", "dhqg", "thanh"].includes(level);
  });
}

function isValidKyNangEvidenceForLevel(awardLevel, kyNangEvidenceType) {
  const allowedTypes = KY_NANG_TYPES_BY_LEVEL[awardLevel] || [];
  return allowedTypes.includes(kyNangEvidenceType);
}

/*
  Hàm này suy ra hoạt động được tính cho cấp nào.
  Input:
  - category
  - organizerLevel
  - subCriteria
  - academicEvidenceType
  - kyNangEvidenceType
  - volunteerDays

  Output:
  - ["truong"]
  - ["truong", "dhqg"]
  - ["truong", "dhqg", "thanh"]
*/
function inferEligibleAwardLevels(activity) {
  const category = activity.category || "";
  const organizerLevel = normalizeOrganizerLevel(activity.organizerLevel);
  const subCriteria = activity.subCriteria || "";
  const academicEvidenceType = activity.academicEvidenceType || "";
  const kyNangEvidenceType = activity.kyNangEvidenceType || "";
  const volunteerDays = Number(activity.volunteerDays || 0);
  const hoiNhapEvidenceType = activity.hoiNhapEvidenceType || "";

  const eligible = [];

  /*
    ĐẠO ĐỨC TỐT:
    Hiện hệ thống xử lý Đạo đức tốt bằng sinh viên tự khai.
    Activity đạo đức chỉ dùng tham khảo.
  */
  if (category === "daoDucTot") {
    if (isAtLeast(organizerLevel, "truong")) {
      eligible.push("truong");
    }

    if (isAtLeast(organizerLevel, "dhqg")) {
      eligible.push("dhqg");
    }

    if (isAtLeast(organizerLevel, "thanh")) {
      eligible.push("thanh");
    }

    return uniqueLevels(eligible);
  }

  /*
    HỌC TẬP TỐT:
    - Cấp Trường: nhiều minh chứng học thuật từ cấp Khoa/Bộ môn trở lên.
    - Cấp cao hơn: ưu tiên minh chứng học thuật có cấp tổ chức/công nhận cao hơn.
    - Loại hocThuat_3_activities chủ yếu phù hợp cấp Trường.
  */
  if (category === "hocTapTot") {
    if (isAtLeast(organizerLevel, "khoa")) {
      eligible.push("truong");
    }

    if (academicEvidenceType === "hocThuat_3_activities") {
      return uniqueLevels(eligible);
    }

    if (isAtLeast(organizerLevel, "truong")) {
      eligible.push("dhqg");
    }

    if (isAtLeast(organizerLevel, "thanh")) {
      eligible.push("thanh");
    }

    if (
      ["nghienCuu", "baiBao", "doiTuyen", "khac_direct"].includes(
        academicEvidenceType
      ) &&
      isAtLeast(organizerLevel, "truong")
    ) {
      eligible.push("thanh");
    }

    return uniqueLevels(eligible);
  }

  /*
    THỂ LỰC TỐT:
    - Cấp Trường: từ cấp Khoa trở lên có thể được tính.
    - ĐHQG/Thành: ưu tiên từ cấp Trường trở lên.
  */
  if (category === "theLucTot") {
    if (isAtLeast(organizerLevel, "khoa")) {
      eligible.push("truong");
    }

    if (isAtLeast(organizerLevel, "truong")) {
      eligible.push("dhqg");
      eligible.push("thanh");
    }

    return uniqueLevels(eligible);
  }

  /*
    TÌNH NGUYỆN TỐT:
    - Cấp Trường/ĐHQG: có thể đạt bằng đủ ngày hoặc khen thưởng.
    - Cấp Thành: dashboard sẽ kiểm tra thêm điều kiện kép:
      05 ngày tình nguyện AND khen thưởng từ cấp Trường trở lên.
  */
  if (category === "tinhNguyenTot") {
    if (isAtLeast(organizerLevel, "khoa") || volunteerDays > 0) {
      eligible.push("truong");
    }

    if (isAtLeast(organizerLevel, "truong") || volunteerDays >= 5) {
      eligible.push("dhqg");
      eligible.push("thanh");
    }

    return uniqueLevels(eligible);
  }

  /*
    HỘI NHẬP TỐT:
    Tách riêng từng nhóm:
    - Ngoại ngữ
    - Kỹ năng
    - Hoạt động hội nhập
  */
  if (category === "hoiNhapTot") {
    /*
      1. NGOẠI NGỮ:
      - Cấp Trường: từ cấp Khoa trở lên có thể tính.
      - Cấp ĐHQG/Thành: từ cấp Trường trở lên.
      - Riêng yêu cầu bổ sung cấp Thành sẽ được kiểm tra tiếp ở dashboard.
    */
    if (subCriteria === "ngoaiNgu") {
      if (isAtLeast(organizerLevel, "khoa")) {
        eligible.push("truong");
      }

      if (isAtLeast(organizerLevel, "truong")) {
        eligible.push("dhqg");
        eligible.push("thanh");
      }

      return uniqueLevels(eligible);
    }

    /*
      2. KỸ NĂNG:
      Xét bằng kyNangEvidenceType, không xét chung chung theo organizerLevel nữa.

      Cấp Trường:
      - skill_course
      - skill_competition_award_khoa_or_above
      - skill_competition_award_truong_or_above
      - skill_reporter_khoa_or_above
      - skill_reporter_truong_or_above
      - union_association_award_truong_or_above
      - student_leader_competition_finalist_truong_or_above

      Cấp ĐHQG-HCM:
      - skill_course
      - skill_competition_award_truong_or_above
      - skill_reporter_truong_or_above
      - union_association_award_truong_or_above

      Cấp Thành phố:
      - skill_course
      - union_association_award_truong_or_above
    */
    if (subCriteria === "kyNang") {
      if (!kyNangEvidenceType) {
        return [];
      }

      if (isValidKyNangEvidenceForLevel("truong", kyNangEvidenceType)) {
        /*
          Một số loại cấp Trường yêu cầu cấp tổ chức từ Khoa trở lên.
          Riêng skill_course có thể không phụ thuộc mạnh vào organizerLevel,
          nhưng vẫn nên yêu cầu ít nhất cấp Khoa nếu upload dưới dạng hoạt động.
        */
        if (isAtLeast(organizerLevel, "khoa")) {
          eligible.push("truong");
        }
      }

      if (isValidKyNangEvidenceForLevel("dhqg", kyNangEvidenceType)) {
        /*
          Với ĐHQG-HCM, các loại giải/báo cáo viên/khen thưởng yêu cầu từ cấp Trường trở lên.
          skill_course được chấp nhận nếu dữ liệu đã khai rõ là khóa kỹ năng hợp lệ.
        */
        if (
          kyNangEvidenceType === "skill_course" ||
          isAtLeast(organizerLevel, "truong")
        ) {
          eligible.push("dhqg");
        }
      }

      if (isValidKyNangEvidenceForLevel("thanh", kyNangEvidenceType)) {
        /*
          Cấp Thành chỉ chấp nhận:
          - skill_course
          - union_association_award_truong_or_above
        */
        if (
          kyNangEvidenceType === "skill_course" ||
          isAtLeast(organizerLevel, "truong")
        ) {
          eligible.push("thanh");
        }
      }

      return uniqueLevels(eligible);
    }

    /*
      3. HOẠT ĐỘNG HỘI NHẬP:
      - Cấp Trường: từ cấp Khoa trở lên.
      - Cấp ĐHQG/Thành: từ cấp Trường trở lên.
    */
    if (subCriteria === "hoiNhap") {
  if (!hoiNhapEvidenceType) {
    return [];
  }

  if (isValidHoiNhapEvidenceForLevel("truong", hoiNhapEvidenceType)) {
    if (isAtLeast(organizerLevel, "khoa")) {
      eligible.push("truong");
    }
  }

  if (isValidHoiNhapEvidenceForLevel("dhqg", hoiNhapEvidenceType)) {
    if (isAtLeast(organizerLevel, "truong")) {
      eligible.push("dhqg");
    }
  }

  if (isValidHoiNhapEvidenceForLevel("thanh", hoiNhapEvidenceType)) {
    if (isAtLeast(organizerLevel, "truong")) {
      eligible.push("thanh");
    }
  }

  return uniqueLevels(eligible);

    return [];
    }  
  }}

module.exports = {
  ORGANIZER_LEVEL_RANK,
  KY_NANG_TYPES_BY_LEVEL,
  HOI_NHAP_TYPES_BY_LEVEL,
isValidHoiNhapEvidenceForLevel,
  normalizeOrganizerLevel,
  getLevelRank,
  isAtLeast,
  isValidKyNangEvidenceForLevel,
  inferEligibleAwardLevels
};