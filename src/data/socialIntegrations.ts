export type SocialIntegrationOption = {
  id: string;
  label: string;
  shortLabel: string;
  guidance: string;
};

export const SOCIAL_INTEGRATION_OPTIONS: SocialIntegrationOption[] = [
  {
    id: "SeaAndIslands",
    label: "Giáo dục chủ quyền biển, đảo và an ninh biên giới hải đảo",
    shortLabel: "Biển đảo",
    guidance: "Khẳng định chủ quyền biển đảo Việt Nam (Hoàng Sa, Trường Sa, vùng đặc quyền kinh tế theo UNCLOS 1982 và Luật Biển Việt Nam); khai thác tài nguyên biển bền vững và bảo vệ an ninh dữ liệu số hải đảo."
  },
  {
    id: "Environment",
    label: "Giáo dục bảo vệ môi trường, tài nguyên thiên nhiên và phát triển kinh tế xanh",
    shortLabel: "Bảo vệ môi trường",
    guidance: "Nhận diện suy giảm tài nguyên (rừng, đất, nước, khoáng sản, sinh vật); đề xuất giải pháp bảo vệ môi trường, phân loại rác thải, kinh tế tuần hoàn và phát triển kinh tế xanh."
  },
  {
    id: "DisasterPrevention",
    label: "Giáo dục phòng, chống thiên tai và giảm nhẹ rủi ro thảm họa",
    shortLabel: "Phòng chống thiên tai",
    guidance: "Nhận diện quy luật bão, lũ lụt, lũ quét, sạt lở đất, hạn mặn, triều cường; rèn luyện kĩ năng cảnh báo sớm, sơ tán an toàn và ứng phó khẩn cấp để giảm thiểu thiệt hại."
  },
  {
    id: "ClimateChange",
    label: "Giáo dục ứng phó biến đổi khí hậu và chuyển đổi năng lượng xanh",
    shortLabel: "Biến đổi khí hậu",
    guidance: "Phân tích tác động của biến đổi khí hậu, nước biển dâng, thời tiết cực đoan (El Nino, La Nina); hình thành ý thức giảm phát thải khí nhà kính và thích ứng linh hoạt trong đời sống, sản xuất."
  },
  {
    id: "Heritage",
    label: "Giáo dục di sản văn hóa",
    shortLabel: "Di sản",
    guidance: "Khai thác tư liệu, địa danh, nhân vật, lễ hội, phong tục, nghệ thuật hoặc bảo tàng; hướng tới bảo tồn và phát huy giá trị di sản."
  },
  {
    id: "DrugPrevention",
    label: "Giáo dục phòng, chống ma túy và thuốc lá",
    shortLabel: "Ma túy, thuốc lá",
    guidance: "Phân tích tác hại, nhận diện tình huống nguy cơ, thực hành kĩ năng từ chối và truyền thông bảo vệ sức khỏe cộng đồng."
  },
  {
    id: "Population",
    label: "Giáo dục dân số và phát triển bền vững",
    shortLabel: "Dân số, PTBV",
    guidance: "Phân tích dữ liệu dân cư và mối quan hệ với chất lượng cuộc sống, bình đẳng giới, an sinh xã hội và phát triển bền vững."
  },
  {
    id: "AntiCorruption",
    label: "Giáo dục phòng, chống tham nhũng",
    shortLabel: "Phòng, chống tham nhũng",
    guidance: "Hình thành thái độ liêm chính, minh bạch, trách nhiệm; nhận diện xung đột lợi ích và hành vi thiếu trung thực trong tình huống phù hợp lứa tuổi."
  },
  {
    id: "Inclusive",
    label: "Giáo dục hòa nhập và hỗ trợ học sinh khuyết tật",
    shortLabel: "Hòa nhập, khuyết tật",
    guidance: "Thiết kế cách tiếp cận, nhiệm vụ, sản phẩm và phương tiện hỗ trợ linh hoạt để học sinh khuyết tật hoặc có hoàn cảnh đặc biệt tham gia thực chất."
  }
];

export const normalizeSocialIntegrationSelections = (values: string[] = []) =>
  Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));

export const describeSelectedSocialIntegrations = (values: string[] = []) =>
  normalizeSocialIntegrationSelections(values).map((value) => {
    if (value.startsWith("Custom:")) {
      return `Nội dung khác: ${value.slice("Custom:".length).trim()}`;
    }
    const option = SOCIAL_INTEGRATION_OPTIONS.find((item) => item.id === value);
    return option ? `${option.label}: ${option.guidance}` : value;
  });

export const buildSocialIntegrationSelectionPrompt = (values: string[] = []) => {
  const selected = describeSelectedSocialIntegrations(values);
  if (!selected.length) {
    return "Không có nội dung giáo dục xã hội nào được giáo viên chọn; để trống trường socialIntegration, không tự ý chèn thêm.";
  }

  return `NỘI DUNG GIÁO DỤC TÍCH HỢP DO GIÁO VIÊN CHỌN:\n${selected.map((item, index) => `${index + 1}. ${item}`).join("\n")}\nQUY TẮC: Chỉ tích hợp vào đúng bài/hoạt động có điểm chạm tự nhiên với YCCĐ. Trường socialIntegration phải ghi cô đọng theo cấu trúc: Chủ đề -> Căn cứ YCCĐ -> Hành vi học sinh -> Sản phẩm -> Tiêu chí/minh chứng. Nếu một dòng không phù hợp thì để chuỗi rỗng; không ghi chú chung chung, không đưa nội dung này vào cột thiết bị, NLS hoặc NL AI.`;
};
