/**
 * Utils/sv5tRegulations.js
 * Quy chế xét chọn danh hiệu Sinh viên 5 tốt — 4 cấp.
 * Áp dụng cho: sinh viên đại học/học viện thông thường tại ĐHKHTN ĐHQG-HCM.
 * Không bao gồm: sinh viên chuyên ngành Ngoại ngữ, Cao đẳng, khối năng khiếu, khuyết tật.
 *
 * Nguồn:
 * - Cấp Trường:    QĐ 49/QĐ-HSV ngày 25/12/2023 - ĐHKHTN ĐHQG-HCM
 * - Cấp ĐHQG-HCM:  QĐ 48-QĐ/BCSD ngày 21/4/2023 - Ban Cán sự Đoàn ĐHQG-HCM
 * - Cấp Thành phố: QĐ 08/QĐ-BTK ngày 18/5/2022 - BCH HSV TP.HCM
 * - Cấp Trung ương:QĐ 68-QĐ/TWHSV ngày 23/10/2025 - BCH TW HSV VN
 */

const sv5tRegulations = {

  // ───────────────────────────────────────────────────────────────────────
  // CẤP TRƯỜNG — ĐHKHTN ĐHQG-HCM
  // ───────────────────────────────────────────────────────────────────────
  truong: {
    label: "Cấp Trường (ĐHKHTN ĐHQG-HCM)",

    daoDucTot: {
      batBuoc: [
        "Không vi phạm pháp luật, quy chế, nội quy của trường, chi Hội, địa phương, nơi công cộng",
        "Điểm rèn luyện đạt từ 70 điểm trở lên (thang 100)",
        "Đánh giá chất lượng Đoàn viên/Hội viên cuối năm đạt Hoàn thành xuất sắc nhiệm vụ"
      ],
      uuTien: [
        "Là thành viên chính thức đội thi tìm hiểu chủ nghĩa Mác-Lênin, tư tưởng HCM từ cấp Trường trở lên",
        "Đạt danh hiệu Thanh niên tiên tiến làm theo lời Bác, Chiến sĩ tiêu biểu, thanh niên tiêu biểu từ cấp quận/huyện trở lên",
        "Đạt giấy khen của Hiệu trưởng, Ban chủ nhiệm khoa"
      ],
      minhChung: [
        "Bảng điểm rèn luyện có xác nhận",
        "Xác nhận Đoàn viên/Hội viên hoàn thành xuất sắc nhiệm vụ"
      ]
    },

    hocTapTot: {
      batBuoc: [
        "Không gian lận trong thi cử, không nợ môn/học phần/tín chỉ trong năm học",
        "Điểm TBCHHT cả năm đạt từ 7,0/10 trở lên hoặc từ 2,8/4,0 trở lên"
      ],
      tieuChuanKhac: {
        moTa: "Đạt ít nhất 01 trong những tiêu chuẩn sau",
        cacLua: [
          "Tham gia và vượt qua vòng đầu tiên hoặc là thành viên Ban Tổ chức cuộc thi học thuật cấp Khoa trở lên",
          "Có đề tài NCKH hoặc khóa luận tốt nghiệp được hội đồng cấp Trường nghiệm thu đánh giá từ 7,0 điểm (loại Khá) trở lên hoặc đạt giải cấp Trường trở lên; hoặc hội đồng cấp Khoa đánh giá từ 7,0 điểm (loại Khá) trở lên",
          "Tham gia cuộc thi ý tưởng sáng tạo, NCKH từ cấp Khoa/Bộ môn trở lên",
          "Tham gia ít nhất 03 hoạt động học thuật và có giấy xác nhận (seminar chuyên đề, CLB học thuật; hoạt động cổ vũ cuộc thi chỉ tính là 01 hoạt động)",
          "Là trợ giảng ít nhất 01 học kỳ (có giấy xác nhận của Chi ủy - BCN Khoa)",
          "Có bài viết đăng trên báo/tạp chí chuyên ngành của Trường hoặc bài tham luận hội thảo khoa học cấp Khoa trở lên",
          "Có sản phẩm sáng tạo, giải pháp hữu ích được cấp bằng sáng chế hoặc giấy phép xuất bản",
          "Là thành viên chính thức đội tuyển tham gia cuộc thi học thuật cấp quốc gia, quốc tế"
        ]
      },
      minhChung: [
        "Bảng điểm học tập có xác nhận",
        "Giấy xác nhận tham gia ít nhất 03 hoạt động học thuật",
        "Giấy xác nhận NCKH/khóa luận đạt loại Khá trở lên",
        "Giấy xác nhận trợ giảng (có xác nhận Chi ủy - BCN Khoa)"
      ]
    },

    theLucTot: {
      moTa: "Đạt ít nhất 01 trong những tiêu chuẩn sau",
      cacLua: [
        "Đạt danh hiệu 'Thanh niên khỏe' từ cấp Trường trở lên hoặc tham gia hoạt động thể thao cấp ĐHQG-HCM, Thành phố, Trung ương",
        "Tham gia và đạt giải Khuyến khích trở lên trong hoạt động thể thao từ cấp Khoa trở lên (trừ giải thể thao điện tử)",
        "Là thành viên chính thức, tham gia đều đặn ít nhất 03 hoạt động CLB Thể dục-Thể thao cấp Khoa trở lên (có xác nhận BCN CLB và BCH Liên chi Hội)",
        "Là thành viên chính thức đội tuyển cấp Trường trở lên",
        "Tham gia luyện tập thường xuyên một môn thể thao tại trung tâm thể dục-thể thao ít nhất 03 tháng (có giấy chứng nhận từ nơi tập luyện)",
        "Tập Gym/Yoga tại trung tâm ít nhất 03 tháng kèm hóa đơn và minh chứng hình ảnh"
      ],
      minhChung: [
        "Giấy chứng nhận 'Thanh niên khỏe' từ cấp Trường",
        "Giấy chứng nhận/Huy chương thi đấu thể thao từ cấp Khoa trở lên",
        "Xác nhận tham gia ít nhất 03 hoạt động CLB Thể dục-Thể thao (BCN CLB + BCH Liên chi Hội ký xác nhận)",
        "Giấy chứng nhận tập luyện từ 03 tháng kèm hóa đơn"
      ]
    },

    tinhNguyenTot: {
      moTa: "Đạt ít nhất 01 trong những tiêu chuẩn sau",
      cacLua: [
        "Tham gia ít nhất 05 ngày tình nguyện trong năm học — được cộng dồn từ nhiều hoạt động khác nhau",
        "Đạt khen thưởng từ cấp Trường trở lên về hoạt động tình nguyện"
      ],
      minhChung: [
        "Giấy xác nhận tham gia tình nguyện có ghi rõ số ngày (được cộng dồn nhiều hoạt động)",
        "Giấy khen tình nguyện từ cấp Trường trở lên"
      ]
    },

    hoiNhapTot: {
      ngoaiNgu: {
        moTa: "Đạt ít nhất 01 trong những tiêu chuẩn sau",
        cacLua: [
          "Đạt chứng chỉ tiếng Anh trình độ B1 trở lên hoặc tương đương (còn thời hạn): IELTS 4.5+, TOEIC 401+, TOEFL iBT 35+, VNU-EPT 7 (201-225 điểm) trở lên",
          "Tổng điểm học phần ngoại ngữ (trừ ngoại ngữ chuyên ngành) từ năm nhất tới thời điểm xét đạt từ 3,4/4,0 trở lên hoặc từ 8,5/10 trở lên",
          "Giấy chứng nhận trình độ B1 trở lên từ cuộc thi thử tiếng Anh do trung tâm ngoại ngữ tổ chức",
          "Tham gia và vượt qua vòng đầu tiên hoặc là Ban Tổ chức cuộc thi kiến thức ngoại ngữ từ cấp Khoa trở lên"
        ],
        minhChung: [
          "Chứng chỉ B1/IELTS 4.5+/TOEIC 401+/TOEFL iBT 35+/VNU-EPT 7+ còn hiệu lực",
          "Bảng điểm học phần ngoại ngữ tích lũy đạt từ 3,4/4,0 hoặc 8,5/10"
        ]
      },
      kyNang: {
        moTa: "Đạt ít nhất 01 trong những tiêu chuẩn sau",
        cacLua: [
          "Hoàn thành ít nhất 01 khóa kỹ năng thực hành xã hội",
          "Đạt giải cuộc thi kỹ năng từ cấp Khoa trở lên",
          "Là báo cáo viên chi Hội kỹ năng từ cấp Khoa/tương đương trở lên (có xác nhận Chi ủy - BCN Khoa)",
          "Được Đoàn Thanh niên - Hội Sinh viên từ cấp Trường trở lên khen thưởng về thành tích xuất sắc công tác Đoàn/Hội",
          "Tham gia và vào vòng Chung kết cuộc thi thủ lĩnh sinh viên cấp Trường trở lên"
        ],
        minhChung: [
          "Giấy chứng nhận hoàn thành khóa kỹ năng thực hành xã hội",
          "Giấy chứng nhận đạt giải cuộc thi kỹ năng từ cấp Khoa trở lên",
          "Giấy khen Đoàn-Hội từ cấp Trường trở lên"
        ]
      },
      hoiNhap: {
        moTa: "Đạt ít nhất 01 trong những tiêu chuẩn sau",
        cacLua: [
          "Giấy chứng nhận tham gia ít nhất 01 hoạt động giao lưu quốc tế (hội nghị, hội thảo quốc tế, chương trình gặp gỡ/giao lưu/hợp tác với sinh viên quốc tế)",
          "Tham gia và vượt qua vòng đầu tiên hoặc là Ban Tổ chức cuộc thi tìm hiểu văn hóa/hội nhập từ cấp Khoa trở lên",
          "Là thành viên chính thức chương trình giao lưu/hợp tác với sinh viên quốc tế (có xác nhận đơn vị)",
          "Là tình nguyện viên theo đoàn/chương trình giao lưu quốc tế"
        ],
        minhChung: [
          "Giấy chứng nhận tham gia giao lưu quốc tế/hội thảo quốc tế",
          "Giấy chứng nhận vượt qua vòng đầu hoặc Ban Tổ chức cuộc thi hội nhập từ cấp Khoa trở lên"
        ]
      }
    }
  },

  // ───────────────────────────────────────────────────────────────────────
  // CẤP ĐHQG-HCM
  // ───────────────────────────────────────────────────────────────────────
  dhqg: {
    label: "Cấp ĐHQG-HCM",
    tieuChuanChung: "Đạt Danh hiệu Sinh viên 5 tốt cấp Trường",

    daoDucTot: {
      batBuoc: [
        "Không vi phạm pháp luật và quy chế, nội quy của trường, chi Hội, địa phương, nơi công cộng",
        "Điểm rèn luyện đạt từ 80 điểm trở lên (thang 100) hoặc xếp loại Xuất sắc",
        "Đánh giá chất lượng Đoàn viên/Hội viên cuối năm đạt Hoàn thành xuất sắc nhiệm vụ"
      ]
    },

    hocTapTot: {
      batBuoc: [
        "Không gian lận trong thi cử, không nợ môn/học phần/tín chỉ trong năm học",
        "Điểm TBCHHT cả năm đạt từ 8,0/10 trở lên (niên chế) hoặc từ 3,2/4,0 trở lên (tín chỉ)"
      ],
      tieuChuanKhac: {
        moTa: "Đạt ít nhất 01 trong những tiêu chuẩn sau",
        cacLua: [
          "Có NCKH hoặc khóa luận tốt nghiệp được hội đồng cấp Trường nghiệm thu từ 7,0 điểm (loại Khá) trở lên hoặc đạt giải cấp Trường trở lên; hoặc hội đồng cấp Khoa từ 7,0 điểm trở lên",
          "Đạt giải Ba trở lên trong cuộc thi học thuật, ý tưởng sáng tạo, giải thưởng NCKH từ cấp Khoa/Bộ môn trở lên",
          "Có bài viết đăng tạp chí chuyên ngành hoặc bài tham luận hội thảo khoa học (được bảo trợ bởi cơ quan chuyên môn) từ cấp trường trở lên",
          "Có sản phẩm sáng tạo được cấp bằng sáng chế hoặc giấy phép xuất bản",
          "Là thành viên đội tuyển tham gia cuộc thi học thuật cấp quốc gia, quốc tế"
        ]
      }
    },

    theLucTot: {
      moTa: "Đạt ít nhất 01 trong những tiêu chuẩn sau",
      cacLua: [
        "Đạt danh hiệu 'Thanh niên khỏe' từ cấp Trường trở lên hoặc tham gia hoạt động thể thao cấp ĐHQG-HCM, Thành phố, Trung ương",
        "Tham gia và đạt giải trong hoạt động thể thao từ cấp trường trở lên",
        "Là thành viên chính thức đội tuyển cấp trường trở lên",
        "Tham gia luyện tập thường xuyên một môn thể thao tại trung tâm thể dục-thể thao ít nhất 06 tháng (có giấy chứng nhận)"
      ]
    },

    tinhNguyenTot: {
      moTa: "Đạt ít nhất 01 trong những tiêu chuẩn sau",
      cacLua: [
        "Được khen thưởng về hoạt động tình nguyện từ cấp Trường trở lên",
        "Tham gia ít nhất 05 ngày tình nguyện/năm (cộng dồn)"
      ]
    },

    hoiNhapTot: {
      ngoaiNgu: {
        tieuChuanCoBan: "Đạt chứng chỉ tiếng Anh B1 trở lên: VNU-EPT 8 – B1(4) (226-250 điểm) trở lên, IELTS 5.0+, TOEIC 476+, TOEFL iBT 46+ hoặc tổng điểm học phần ngoại ngữ từ 3,4/4,0 hoặc 8,5/10 trở lên",
        luuY: "KHÔNG chấp nhận chứng nhận trong các đợt thi thử"
      },
      hoiNhap: {
        moTa: "Đạt 01 trong các tiêu chí sau",
        cacLua: [
          "Giấy chứng nhận tham gia ít nhất 01 hoạt động giao lưu quốc tế (hội nghị, hội thảo quốc tế, chương trình gặp gỡ/giao lưu/hợp tác với sinh viên quốc tế)",
          "Đạt giải Ba trở lên tại cuộc thi kiến thức hội nhập hoặc cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên",
          "Là tình nguyện viên/thành viên chính thức chương trình giao lưu/hợp tác quốc tế"
        ]
      },
      kyNang: {
        moTa: "Đạt 01 trong các tiêu chí sau",
        cacLua: [
          "Hoàn thành ít nhất 01 khóa kỹ năng thực hành xã hội",
          "Đạt giải cuộc thi kỹ năng từ cấp trường trở lên",
          "Là báo cáo viên chi Hội kỹ năng từ cấp trường trở lên",
          "Được Đoàn Thanh niên - Hội Sinh viên từ cấp Trường trở lên khen thưởng thành tích xuất sắc công tác Đoàn/Hội"
        ]
      }
    }
  },

  // ───────────────────────────────────────────────────────────────────────
  // CẤP THÀNH PHỐ HỒ CHÍ MINH
  // ───────────────────────────────────────────────────────────────────────
  thanh: {
    label: "Cấp Thành phố Hồ Chí Minh",
    tieuChuanChung: "Đạt Danh hiệu Sinh viên 5 tốt cấp Trường",

    daoDucTot: {
      batBuoc: [
        "Không vi phạm pháp luật và quy chế, nội quy của trường, chi Hội, địa phương, nơi công cộng",
        "Điểm rèn luyện đạt từ 90 điểm trở lên (thang 100) hoặc xếp loại Xuất sắc",
        "Đánh giá chất lượng Đoàn viên/Hội viên cuối năm đạt Hoàn thành xuất sắc nhiệm vụ"
      ],
      tieuChuanKhac: {
        moTa: "Đạt ít nhất 01 trong những tiêu chuẩn sau",
        cacLua: [
          "Là thành viên chính thức đội thi tìm hiểu chủ nghĩa Mác-Lênin, tư tưởng HCM từ cấp Trường trở lên",
          "Có tham luận/bài viết tại diễn đàn học thuật về môn khoa học Mác-Lênin, tư tưởng HCM từ cấp Trường trở lên",
          "Là Thanh niên tiên tiến làm theo lời Bác hoặc có hành động dũng cảm được ghi nhận từ cấp Thành, ĐHQG TP.HCM, UBND cấp huyện, Đảng ủy, BGH Nhà trường trở lên"
        ]
      }
    },

    hocTapTot: {
      batBuoc: [
        "Không gian lận trong thi cử, không nợ môn/học phần/tín chỉ trong năm học",
        "Điểm TBCHHT cả năm đạt từ 8,5/10 trở lên (niên chế) hoặc từ 3,4/4,0 trở lên (tín chỉ)"
      ],
      tieuChuanKhac: {
        moTa: "Đạt ít nhất 01 trong những tiêu chuẩn sau",
        cacLua: [
          "Có NCKH hoặc khóa luận tốt nghiệp được hội đồng cấp Trường nghiệm thu từ 8,0 điểm (loại Tốt) trở lên hoặc đạt giải cấp Trường trở lên",
          "Đạt giải thưởng sinh viên NCKH Euréka, giải thưởng NCKH, cuộc thi ý tưởng sáng tạo hoặc cuộc thi học thuật cấp Thành trở lên",
          "Có bài viết đăng tạp chí chuyên ngành hoặc bài tham luận hội thảo khoa học (bảo trợ bởi cơ quan chuyên môn) từ cấp trường trở lên",
          "Có sản phẩm sáng tạo được cấp bằng sáng chế hoặc giấy phép xuất bản",
          "Là thành viên đội tuyển tham gia cuộc thi học thuật cấp quốc gia hoặc quốc tế"
        ]
      }
    },

    theLucTot: {
      moTa: "Đạt ít nhất 01 trong những tiêu chuẩn sau",
      cacLua: [
        "Đạt danh hiệu 'Thanh niên khỏe' từ cấp Trường trở lên hoặc tham gia hoạt động thể thao cấp Thành phố, cấp Trung ương",
        "Tham gia và đạt giải trong hoạt động thể thao từ cấp trường trở lên (trừ giải thể thao điện tử)",
        "Là thành viên chính thức đội tuyển cấp Thành phố, cấp Quốc gia"
      ]
    },

    tinhNguyenTot: {
      moTa: "Đạt ít nhất 01 trong những tiêu chuẩn sau",
      cacLua: [
        "Được khen thưởng từ cấp Trường trở lên về hoạt động tình nguyện",
        "Tham gia ít nhất 05 ngày tình nguyện/năm (cộng dồn; khuyến khích tham gia ít nhất 01 chiến dịch tình nguyện)"
      ],
      minhChung: [
        "Giấy xác nhận tham gia tình nguyện thể hiện rõ số ngày",
        "Giấy khen tình nguyện từ cấp Trường trở lên"
      ]
    },

    hoiNhapTot: {
      ngoaiNgu: {
        tieuChuanCoBan: "Đạt chứng chỉ tiếng Anh B1 trở lên: VNU-EPT 8 – B1(4) (226-250 điểm) trở lên, IELTS 5.0+, TOEIC 476+, TOEFL iBT 46+ hoặc tổng điểm học phần ngoại ngữ từ 3,2/4,0 hoặc 8,0/10 trở lên (không xét thời hạn chứng chỉ)",
        tieuChuanBoSung: {
          moTa: "Đạt thêm 01 trong 02 tiêu chí sau",
          cacLua: [
            "Giấy chứng nhận tham gia ít nhất 01 hoạt động giao lưu quốc tế (hội nghị, hội thảo quốc tế, chương trình gặp gỡ/giao lưu/hợp tác với sinh viên quốc tế)",
            "Đạt giải Ba trở lên tại cuộc thi kiến thức hội nhập hoặc cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên"
          ]
        },
        luuY: "Cấp Thành phố yêu cầu đồng thời CẢ tiêu chuẩn cơ bản VÀ tiêu chuẩn bổ sung ngoại ngữ"
      },
      kyNang: {
        moTa: "Đạt 01 trong các tiêu chí sau",
        cacLua: [
          "Hoàn thành ít nhất 01 khóa kỹ năng thực hành xã hội (theo khung Phụ lục II)",
          "Được Đoàn Thanh niên - Hội Sinh viên từ cấp Trường trở lên khen thưởng thành tích xuất sắc công tác Đoàn/Hội"
        ]
      },
      hoiNhap: {
        moTa: "Tham gia tích cực ít nhất 01 hoạt động về hội nhập do cấp Trường tổ chức trở lên"
      }
    }
  },

  // ───────────────────────────────────────────────────────────────────────
  // CẤP TRUNG ƯƠNG
  // ───────────────────────────────────────────────────────────────────────
  trungUong: {
    label: "Cấp Trung ương",
    tieuChuanChung: [
      "Đạt Danh hiệu Sinh viên 5 tốt cấp Thành phố",
      "Được Ban Thư ký Hội Sinh viên cấp tỉnh/thành phố đề nghị xét ở cấp Trung ương"
    ],
    yeuCauTongThe: "Đạt đồng thời TẤT CẢ tiêu chí bắt buộc của 05 tiêu chuẩn VÀ đạt từ 02 tiêu chí đạt thêm trở lên",

    daoDucTot: {
      batBuoc: [
        "Điểm rèn luyện đạt từ 95 điểm trở lên (thang 100) hoặc xếp loại cao nhất",
        "Được Đảng ủy, Ban Giám hiệu Nhà trường xác nhận không vi phạm pháp luật và quy chế, nội quy của nhà trường, địa phương và cộng đồng tại thời điểm xét trao"
      ],
      datThem: [
        "Là thanh niên tiêu biểu/tiên tiến làm theo lời Bác; gương người tốt việc tốt; gương hành động dũng cảm được cấp tỉnh/thành phố trở lên biểu dương, ghi nhận",
        "Đạt xếp loại 'Đảng viên hoàn thành xuất sắc nhiệm vụ' trong năm gần nhất (chỉ áp dụng Đảng viên chính thức)"
      ]
    },

    hocTapTot: {
      batBuoc: [
        "Điểm TBCHHT cả năm đạt từ 3,4/4,0 trở lên (tín chỉ) hoặc từ 8,5/10 trở lên (niên chế)"
      ],
      datThem: [
        "Có NCKH (không áp dụng luận văn tốt nghiệp) đạt giải từ cấp tỉnh/thành phố trở lên",
        "Tác giả bài viết đăng tạp chí khoa học quốc tế uy tín WoS/Scopus (Q1, Q2)",
        "Tác giả chính bài viết đăng WoS/Scopus (Q3, Q4)",
        "Có sản phẩm sáng tạo được cấp bằng sáng chế, giấy phép xuất bản hoặc giải thưởng từ cấp tỉnh trở lên",
        "Đạt giải Ba trở lên trong cuộc thi học thuật, KHKT, ý tưởng sáng tạo khởi nghiệp cấp quốc gia, quốc tế"
      ]
    },

    theLucTot: {
      batBuoc: "Tham gia và đạt giải hoạt động thể thao cấp trường trở lên hoặc tham gia hoạt động thể thao cấp Trung ương",
      datThem: "Tham gia và đạt giải Ba trở lên trong hoạt động thể thao từ cấp tỉnh trở lên"
    },

    tinhNguyenTot: {
      batBuoc: "Tham gia ít nhất 05 ngày tình nguyện/năm (cộng dồn)",
      datThem: [
        "Là người sáng lập/đồng sáng lập dự án tình nguyện đem lại kết quả thiết thực, được đơn vị thụ hưởng nhận xét, đánh giá, giới thiệu",
        "Được khen thưởng từ cấp tỉnh trở lên về hoạt động tình nguyện"
      ]
    },

    hoiNhapTot: {
      batBuoc: [
        "Đạt chứng chỉ tiếng Anh B2 trở lên: IELTS 5.5+, TOEIC 551+, TOEFL iBT 60+, VNU-EPT 9 – B2(1) (251-275 điểm) trở lên hoặc tổng điểm học phần ngoại ngữ từ 3,4/4,0 hoặc 8,5/10 trở lên",
        "Tham gia ít nhất 01 hoạt động giao lưu quốc tế (hội nghị, hội thảo quốc tế, chương trình gặp gỡ/giao lưu/hợp tác với sinh viên quốc tế)"
      ],
      datThem: [
        "Là thành viên ban chủ nhiệm CLB/đội/nhóm ngoại ngữ tại cơ sở giáo dục, thường xuyên tổ chức hoạt động giao lưu/trao đổi nâng cao ngoại ngữ và hội nhập quốc tế",
        "Đạt giải Ba trở lên tại cuộc thi kiến thức hội nhập hoặc cuộc thi học thuật bằng ngoại ngữ từ cấp tỉnh trở lên",
        "Đạt chứng chỉ B1 trở lên đối với ít nhất 02 ngoại ngữ khác nhau (riêng tiếng Anh cần đạt B2 trở lên)"
      ]
    }
  },

  // ───────────────────────────────────────────────────────────────────────
  // BẢNG QUY ĐỔI CHỨNG CHỈ NGOẠI NGỮ
  // ───────────────────────────────────────────────────────────────────────
  quyDoiNgoaiNgu: {
    B1: {
      VNUEPT: "VNU-EPT 7 – B1(3): 201-225 điểm",
      IELTS: "4.5 – 5.0",
      TOEFLiBT: "35 – 45",
      TOEICngheDoc: "401 – 475",
      tiengNga: "TRKI 1",
      tiengPhap: "DELF B1 / TCF niveau 3",
      tiengDuc: "B1 / ZD",
      tiengTrung: "HSK cấp độ 3",
      tiengNhat: "JLPT N4",
      tiengHan: "Topik II level 3"
    },
    B2: {
      VNUEPT: "VNU-EPT 9 – B2(1): 251-275 điểm",
      IELTS: "5.5 – 6.0",
      TOEFLiBT: "60 – 78",
      TOEICngheDoc: "551 – 670",
      tiengNga: "TRKI 2",
      tiengPhap: "DELF B2 / TCF niveau 4",
      tiengDuc: "B2 / TestDaF level 4",
      tiengTrung: "HSK cấp độ 4",
      tiengNhat: "JLPT N3",
      tiengHan: "Topik II level 4"
    },
    nguongTheoCapXet: {
      truong: "B1: IELTS 4.5+, TOEIC 401+, TOEFL iBT 35+, VNU-EPT 7+ (201 điểm trở lên)",
      dhqg:   "B1: IELTS 5.0+, TOEIC 476+, TOEFL iBT 46+, VNU-EPT 8+ (226 điểm trở lên). KHÔNG chấp nhận chứng nhận thi thử",
      thanh:  "B1: IELTS 5.0+, TOEIC 476+, TOEFL iBT 46+, VNU-EPT 8+ (226 điểm trở lên). CẦN thêm 01 điều kiện bổ sung",
      trungUong: "B2: IELTS 5.5+, TOEIC 551+, TOEFL iBT 60+, VNU-EPT 9+ (251 điểm trở lên)"
    }
  }
};

/**
 * Lấy quy chế theo cấp xét.
 */
function getRegulationByLevel(level) {
  return sv5tRegulations[level] || null;
}

/**
 * Tạo đoạn text tóm tắt quy chế để nhúng vào system prompt.
 */
function getRegulationSummaryForPrompt(level = "truong") {
  const reg = sv5tRegulations[level];
  if (!reg) return "";

  const lines = [`\n=== QUY CHẾ ${reg.label.toUpperCase()} ===`];

  if (reg.tieuChuanChung) {
    const tc = Array.isArray(reg.tieuChuanChung)
      ? reg.tieuChuanChung.join("; ")
      : reg.tieuChuanChung;
    lines.push(`Tiêu chuẩn chung: ${tc}`);
  }

  if (reg.yeuCauTongThe) {
    lines.push(`Lưu ý quan trọng: ${reg.yeuCauTongThe}`);
  }

  const tcKeys = ["daoDucTot", "hocTapTot", "theLucTot", "tinhNguyenTot", "hoiNhapTot"];
  const tcLabels = {
    daoDucTot: "ĐẠO ĐỨC TỐT",
    hocTapTot: "HỌC TẬP TỐT",
    theLucTot: "THỂ LỰC TỐT",
    tinhNguyenTot: "TÌNH NGUYỆN TỐT",
    hoiNhapTot: "HỘI NHẬP TỐT"
  };

  tcKeys.forEach(key => {
    const data = reg[key];
    if (!data) return;
    lines.push(`\n[${tcLabels[key]}]`);

    const bb = data.batBuoc;
    if (bb) {
      const arr = Array.isArray(bb) ? bb : [bb];
      lines.push(`Bắt buộc: ${arr.join(" | ")}`);
    }

    const dt = data.datThem;
    if (dt) {
      const arr = Array.isArray(dt) ? dt : [dt];
      lines.push(`Tiêu chí đạt thêm: ${arr.join(" | ")}`);
    }

    const mc = data.minhChung;
    if (mc) {
      lines.push(`Minh chứng gợi ý: ${mc.join(", ")}`);
    }

    // Hội nhập tốt có cấu trúc phức tạp hơn
    if (key === "hoiNhapTot") {
      if (data.ngoaiNgu) {
        const nn = data.ngoaiNgu;
        lines.push(`  Ngoại ngữ: ${nn.tieuChuanCoBan || nn.moTa || ""}`);
        if (nn.luuY) lines.push(`  Lưu ý: ${nn.luuY}`);
        if (nn.tieuChuanBoSung) {
          lines.push(`  Bổ sung ngoại ngữ (cấp Thành phố): ${nn.tieuChuanBoSung.cacLua.join(" HOẶC ")}`);
        }
      }
      if (data.kyNang?.cacLua) {
        lines.push(`  Kỹ năng (chọn 1): ${data.kyNang.cacLua.join(" | ")}`);
      }
      if (data.hoiNhap?.cacLua) {
        lines.push(`  Hoạt động hội nhập (chọn 1): ${data.hoiNhap.cacLua.join(" | ")}`);
      } else if (data.hoiNhap?.moTa) {
        lines.push(`  Hoạt động hội nhập: ${data.hoiNhap.moTa}`);
      }
    }
  });

  // Thêm bảng quy đổi ngoại ngữ theo cấp
  const nguong = sv5tRegulations.quyDoiNgoaiNgu?.nguongTheoCapXet?.[level];
  if (nguong) {
    lines.push(`\nNgưỡng ngoại ngữ ${reg.label}: ${nguong}`);
  }

  return lines.join("\n");
}

module.exports = {
  sv5tRegulations,
  getRegulationByLevel,
  getRegulationSummaryForPrompt
};