const globalSupport = {
  lienChiHoiName: "Liên Chi hội Khoa Hóa học",

  fanpageName: "Liên Chi hội Khoa Hóa học",
  fanpageUrl:
    process.env.LCH_FANPAGE_URL ||
    "https://facebook.com/your-fanpage-url",

  supportEmail:
    process.env.LCH_SUPPORT_EMAIL ||
    "lienchihoikhoahoahoc@example.com",

  zaloGroupName: "\"HÀNH TRÌNH CÙNG NHAU 5 TỐT\"",
  zaloGroupUrl:
    process.env.LCH_ZALO_GROUP_URL ||
    "https://zalo.me/g/your-zalo-group"
};

module.exports = globalSupport;