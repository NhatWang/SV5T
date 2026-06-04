const sv5tFAQ = [
  {
    intent: "contact_support",
    examples: [
      "Cho em xin mail Liên Chi Hội",
      "Em liên hệ ai để hỏi SV5T?",
      "Fanpage Liên Chi Hội là gì?",
      "Có group Zalo hỗ trợ không?"
    ],
    answer: `
Sinh viên có thể liên hệ Liên Chi hội Khoa Hóa học qua:
- Email: {{supportEmail}}
- Fanpage: {{fanpageUrl}}
- Nhóm Zalo: {{zaloGroupUrl}}

Nếu thông tin liên hệ chưa được cập nhật chính thức, vui lòng kiểm tra fanpage hoặc hỏi Văn phòng Khoa/Đoàn - Hội Khoa.
`
  },
  {
    intent: "evidence_rejected",
    examples: [
      "Minh chứng của em bị từ chối",
      "AI từ chối giấy chứng nhận của em",
      "Admin không duyệt minh chứng thì sao?"
    ],
    answer: `
Nếu minh chứng bị từ chối, em nên kiểm tra lại:
- Minh chứng có đúng tiêu chí SV5T không.
- Ảnh/file có rõ tên, ngày tháng, đơn vị cấp không.
- Minh chứng có đúng cấp yêu cầu không.

Sau đó em có thể nộp lại minh chứng phù hợp hơn trên hệ thống.
`
  }
];

module.exports = sv5tFAQ;