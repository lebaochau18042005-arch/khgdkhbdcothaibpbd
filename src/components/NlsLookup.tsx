import React, { useMemo, useState } from "react";
import { ADVANCED_NLS_COMPONENTS, type AdvancedNlsLevel } from "../data/nlsAdvancedIndicators";

type Level = "CB1" | "CB2" | AdvancedNlsLevel;

export type Indicator = {
  code: string;
  field: string;
  fieldName: string;
  component: string;
  componentName: string;
  level: Level;
  levelName: string;
  letter: string;
  description: string;
};

type ComponentDefinition = {
  field: string;
  fieldName: string;
  component: string;
  componentName: string;
  cb1: Record<string, string>;
  cb2: Record<string, string>;
};

const LEVEL_NAMES: Record<Level, string> = {
  CB1: "L1–L2–L3",
  CB2: "L4–L5",
  TC1: "L6–L7",
  TC2: "L8–L9",
  NC1: "L10–L11–L12",
};

const COMPONENTS: ComponentDefinition[] = [
  {
    field: "1",
    fieldName: "Khai thác dữ liệu và thông tin",
    component: "1.1",
    componentName: "Duyệt, tìm kiếm và lọc dữ liệu, thông tin và nội dung số",
    cb1: {
      a: "Xác định được nhu cầu thông tin, tìm kiếm dữ liệu, thông tin và nội dung thông qua tìm kiếm đơn giản trong môi trường số.",
      b: "Tìm được cách truy cập dữ liệu, thông tin và nội dung, cũng như điều hướng giữa chúng.",
      c: "Xác định được các chiến lược tìm kiếm đơn giản.",
    },
    cb2: {
      a: "Xác định được nhu cầu thông tin.",
      b: "Tìm được dữ liệu, thông tin và nội dung thông qua tìm kiếm đơn giản trong môi trường số.",
      c: "Tìm được cách truy cập dữ liệu, thông tin và nội dung, cũng như điều hướng giữa chúng.",
      d: "Xác định được các chiến lược tìm kiếm đơn giản.",
    },
  },
  {
    field: "1",
    fieldName: "Khai thác dữ liệu và thông tin",
    component: "1.2",
    componentName: "Đánh giá dữ liệu, thông tin và nội dung số",
    cb1: {
      a: "Phát hiện được độ tin cậy và độ chính xác của các nguồn dữ liệu, thông tin và nội dung số.",
    },
    cb2: {
      a: "Phát hiện được độ tin cậy và độ chính xác của các nguồn dữ liệu, thông tin và nội dung số.",
    },
  },
  {
    field: "1",
    fieldName: "Khai thác dữ liệu và thông tin",
    component: "1.3",
    componentName: "Quản lý dữ liệu, thông tin và nội dung số",
    cb1: {
      a: "Xác định được cách tổ chức, lưu trữ và truy xuất dữ liệu, thông tin và nội dung một cách đơn giản trong môi trường số.",
      b: "Nhận biết được nơi để sắp xếp dữ liệu, thông tin và nội dung một cách đơn giản trong môi trường có cấu trúc.",
    },
    cb2: {
      a: "Xác định được cách tổ chức, lưu trữ và truy xuất dữ liệu, thông tin và nội dung một cách đơn giản trong môi trường số.",
      b: "Nhận biết được nơi để sắp xếp dữ liệu, thông tin và nội dung một cách đơn giản trong môi trường có cấu trúc.",
    },
  },
  {
    field: "2",
    fieldName: "Giao tiếp và hợp tác",
    component: "2.1",
    componentName: "Tương tác thông qua công nghệ số",
    cb1: {
      a: "Lựa chọn được các công nghệ số đơn giản để tương tác.",
      b: "Xác định được các phương tiện giao tiếp đơn giản thích hợp cho một bối cảnh cụ thể.",
    },
    cb2: {
      a: "Lựa chọn được các công nghệ số đơn giản để tương tác.",
      b: "Xác định được các phương tiện giao tiếp đơn giản thích hợp cho một bối cảnh cụ thể.",
    },
  },
  {
    field: "2",
    fieldName: "Giao tiếp và hợp tác",
    component: "2.2",
    componentName: "Chia sẻ thông tin và nội dung thông qua công nghệ số",
    cb1: {
      a: "Nhận biết được các công nghệ số đơn giản, phù hợp để chia sẻ dữ liệu, thông tin và nội dung kỹ thuật số.",
      b: "Nhận biết được phương pháp trích dẫn và ghi nguồn cơ bản.",
    },
    cb2: {
      a: "Nhận biết được các công nghệ số đơn giản, phù hợp để chia sẻ dữ liệu, thông tin và nội dung kỹ thuật số.",
      b: "Xác định được phương pháp trích dẫn và ghi nguồn cơ bản.",
    },
  },
  {
    field: "2",
    fieldName: "Giao tiếp và hợp tác",
    component: "2.3",
    componentName: "Sử dụng công nghệ số để thực hiện trách nhiệm công dân",
    cb1: {
      a: "Xác định được các dịch vụ số đơn giản để có thể tham gia vào xã hội.",
      b: "Nhận biết được các công nghệ số đơn giản, phù hợp để nâng cao năng lực cho bản thân và tham gia vào xã hội với tư cách là một công dân.",
    },
    cb2: {
      a: "Xác định được các dịch vụ số đơn giản để có thể tham gia vào xã hội.",
      b: "Nhận biết được các công nghệ số đơn giản, phù hợp để nâng cao năng lực cho bản thân và tham gia vào xã hội với tư cách là một công dân.",
    },
  },
  {
    field: "2",
    fieldName: "Giao tiếp và hợp tác",
    component: "2.4",
    componentName: "Hợp tác thông qua công nghệ số",
    cb1: {
      a: "Chọn được những công cụ và công nghệ số đơn giản cho các quá trình cộng tác.",
    },
    cb2: {
      a: "Chọn được những công cụ và công nghệ số đơn giản cho các quá trình cộng tác.",
    },
  },
  {
    field: "2",
    fieldName: "Giao tiếp và hợp tác",
    component: "2.5",
    componentName: "Quy tắc ứng xử trên mạng",
    cb1: {
      a: "Phân biệt được các chuẩn mực hành vi đơn giản và biết cách sử dụng công nghệ số, tương tác trong môi trường số.",
      b: "Chọn được các phương thức và chiến lược giao tiếp đơn giản phù hợp trong môi trường số.",
      c: "Phân biệt được các khía cạnh đơn giản của sự đa dạng về văn hóa và thế hệ cần được tính đến trong môi trường số.",
    },
    cb2: {
      a: "Phân biệt được các chuẩn mực hành vi đơn giản và bí quyết sử dụng công nghệ số, tương tác trong môi trường số.",
      b: "Chọn được các phương thức và chiến lược giao tiếp đơn giản phù hợp trong môi trường số.",
      c: "Phân biệt được các khía cạnh đơn giản của sự đa dạng về văn hóa và thế hệ cần được tính đến trong môi trường số.",
    },
  },
  {
    field: "2",
    fieldName: "Giao tiếp và hợp tác",
    component: "2.6",
    componentName: "Quản lý danh tính số",
    cb1: {
      a: "Xác định được danh tính số.",
      b: "Mô tả được những cách đơn giản để bảo vệ danh tiếng trực tuyến của bản thân.",
      c: "Nhận biết được dữ liệu đơn giản do mình tạo ra thông qua các công cụ, môi trường hoặc dịch vụ số.",
    },
    cb2: {
      a: "Xác định được danh tính số.",
      b: "Mô tả được những cách đơn giản để bảo vệ danh tiếng trực tuyến của bản thân.",
      c: "Nhận biết được dữ liệu đơn giản do mình tạo ra thông qua các công cụ, môi trường hoặc dịch vụ số.",
    },
  },
  {
    field: "3",
    fieldName: "Sáng tạo nội dung số",
    component: "3.1",
    componentName: "Phát triển nội dung số",
    cb1: {
      a: "Xác định được các cách tạo và chỉnh sửa nội dung đơn giản ở các định dạng đơn giản.",
      b: "Chọn được cách thể hiện bản thân thông qua việc tạo ra các nội dung số đơn giản.",
    },
    cb2: {
      a: "Xác định được các cách tạo và chỉnh sửa nội dung đơn giản ở các định dạng đơn giản.",
      b: "Chọn được cách thể hiện bản thân thông qua việc tạo ra các nội dung số đơn giản.",
    },
  },
  {
    field: "3",
    fieldName: "Sáng tạo nội dung số",
    component: "3.2",
    componentName: "Tích hợp và tạo lập lại nội dung số",
    cb1: {
      a: "Chọn được các cách sửa đổi, tinh chỉnh, cải thiện và tích hợp các mục đơn giản có nội dung và thông tin mới để tạo ra những nội dung và thông tin mới và độc đáo.",
    },
    cb2: {
      a: "Chọn được các cách sửa đổi, tinh chỉnh, cải thiện và tích hợp các mục đơn giản có nội dung và thông tin mới để tạo ra những nội dung và thông tin mới và độc đáo.",
    },
  },
  {
    field: "3",
    fieldName: "Sáng tạo nội dung số",
    component: "3.3",
    componentName: "Thực thi bản quyền và giấy phép",
    cb1: {
      a: "Xác định được các quy tắc đơn giản về bản quyền và giấy phép áp dụng cho dữ liệu, thông tin và nội dung số.",
    },
    cb2: {
      a: "Xác định được các quy tắc đơn giản về bản quyền và giấy phép áp dụng cho dữ liệu, thông tin và nội dung số.",
    },
  },
  {
    field: "3",
    fieldName: "Sáng tạo nội dung số",
    component: "3.4",
    componentName: "Lập trình",
    cb1: {
      a: "Liệt kê được các hướng dẫn đơn giản để hệ thống máy tính giải quyết một vấn đề đơn giản hoặc thực hiện một nhiệm vụ đơn giản.",
    },
    cb2: {
      a: "Liệt kê được các hướng dẫn đơn giản để hệ thống máy tính giải quyết một vấn đề đơn giản hoặc thực hiện một nhiệm vụ đơn giản.",
    },
  },
  {
    field: "4",
    fieldName: "An toàn",
    component: "4.1",
    componentName: "Bảo vệ thiết bị",
    cb1: {
      a: "Nhận biết được cách bảo vệ thiết bị và nội dung số một cách đơn giản.",
      b: "Phân biệt được rủi ro và mối đe dọa đơn giản trong môi trường số.",
      c: "Chọn lựa được các biện pháp an toàn và bảo mật đơn giản.",
      d: "Nhận biết được những cách thức đơn giản để quan tâm đến mức độ tin cậy và quyền riêng tư.",
    },
    cb2: {
      a: "Nhận biết được cách bảo vệ thiết bị và nội dung số một cách đơn giản.",
      b: "Phân biệt được rủi ro và mối đe dọa đơn giản trong môi trường số.",
      c: "Tuân theo được các biện pháp an toàn và bảo mật đơn giản.",
      d: "Nhận biết được những cách thức đơn giản để quan tâm đến mức độ tin cậy và quyền riêng tư.",
    },
  },
  {
    field: "4",
    fieldName: "An toàn",
    component: "4.2",
    componentName: "Bảo vệ dữ liệu cá nhân và quyền riêng tư",
    cb1: {
      a: "Lựa chọn được những cách thức đơn giản để bảo vệ dữ liệu cá nhân và quyền riêng tư trong môi trường số.",
      b: "Nhận biết được các cách sử dụng và chia sẻ thông tin định danh cá nhân một cách an toàn, có khả năng bảo vệ bản thân và người khác.",
      c: "Nhận diện được các tuyên bố cơ bản trong chính sách quyền riêng tư về cách sử dụng dữ liệu cá nhân trong dịch vụ số.",
    },
    cb2: {
      a: "Lựa chọn được những cách thức đơn giản để bảo vệ dữ liệu cá nhân và quyền riêng tư trong môi trường số.",
      b: "Nhận biết được các cách sử dụng và chia sẻ thông tin định danh cá nhân một cách an toàn, có khả năng bảo vệ bản thân và người khác.",
      c: "Nhận diện được các tuyên bố cơ bản trong chính sách quyền riêng tư về cách sử dụng dữ liệu cá nhân trong dịch vụ số.",
    },
  },
  {
    field: "4",
    fieldName: "An toàn",
    component: "4.3",
    componentName: "Bảo vệ sức khỏe và an sinh số",
    cb1: {
      a: "Phân biệt được các cách thức đơn giản để tránh rủi ro và đe dọa đến sức khỏe thể chất, tinh thần khi sử dụng công nghệ số.",
      b: "Lựa chọn được những cách thức đơn giản để bảo vệ bản thân khỏi nguy cơ trong môi trường số.",
      c: "Nhận biết được những công nghệ số đơn giản cho tăng cường thịnh vượng xã hội và sự hòa hợp trong xã hội.",
    },
    cb2: {
      a: "Phân biệt được các cách thức đơn giản để tránh rủi ro và đe dọa đến sức khỏe thể chất, tinh thần khi sử dụng công nghệ số.",
      b: "Lựa chọn được những cách thức đơn giản để bảo vệ bản thân khỏi nguy cơ trong môi trường số.",
      c: "Nhận biết được những công nghệ số đơn giản cho tăng cường thịnh vượng xã hội và sự hòa hợp trong xã hội.",
    },
  },
  {
    field: "4",
    fieldName: "An toàn",
    component: "4.4",
    componentName: "Bảo vệ môi trường",
    cb1: {
      a: "Nhận biết được tác động cơ bản của công nghệ số và việc sử dụng công nghệ số đối với môi trường.",
    },
    cb2: {
      a: "Nhận biết được tác động cơ bản của công nghệ số và việc sử dụng công nghệ số đối với môi trường.",
    },
  },
  {
    field: "5",
    fieldName: "Giải quyết vấn đề",
    component: "5.1",
    componentName: "Giải quyết các vấn đề kỹ thuật",
    cb1: {
      a: "Xác định được các vấn đề kỹ thuật đơn giản khi vận hành thiết bị và sử dụng môi trường số.",
      b: "Xác định được các giải pháp đơn giản để giải quyết chúng.",
    },
    cb2: {
      a: "Xác định được các vấn đề kỹ thuật đơn giản khi vận hành thiết bị và sử dụng môi trường số.",
      b: "Xác định được các giải pháp đơn giản để giải quyết chúng.",
    },
  },
  {
    field: "5",
    fieldName: "Giải quyết vấn đề",
    component: "5.2",
    componentName: "Xác định nhu cầu và giải pháp công nghệ",
    cb1: {
      a: "Xác định được nhu cầu cá nhân.",
      b: "Nhận ra được các công cụ số đơn giản và các giải pháp công nghệ có thể có để giải quyết những nhu cầu đó.",
      c: "Chọn được những cách đơn giản để điều chỉnh và tùy chỉnh môi trường số theo nhu cầu cá nhân.",
    },
    cb2: {
      a: "Xác định được nhu cầu cá nhân.",
      b: "Nhận ra được các công cụ số đơn giản và các giải pháp công nghệ có thể có để giải quyết những nhu cầu đó.",
      c: "Chọn được những cách đơn giản để điều chỉnh và tùy chỉnh môi trường số theo nhu cầu cá nhân.",
    },
  },
  {
    field: "5",
    fieldName: "Giải quyết vấn đề",
    component: "5.3",
    componentName: "Sử dụng sáng tạo công nghệ số",
    cb1: {
      a: "Xác định được các công cụ và công nghệ số đơn giản có thể được sử dụng để tạo ra kiến thức và đổi mới quy trình cũng như sản phẩm.",
      b: "Thể hiện được sự quan tâm của cá nhân và tập thể đến quá trình xử lý nhận thức đơn giản để hiểu và giải quyết các vấn đề khái niệm đơn giản và các tình huống có vấn đề trong môi trường số.",
    },
    cb2: {
      a: "Xác định được các công cụ và công nghệ số đơn giản có thể được sử dụng để tạo ra kiến thức và đổi mới quy trình cũng như sản phẩm.",
      b: "Tuân theo quy trình nhận thức đơn giản của cá nhân và tập thể để hiểu và giải quyết các vấn đề khái niệm đơn giản và các tình huống có vấn đề trong môi trường số.",
    },
  },
  {
    field: "5",
    fieldName: "Giải quyết vấn đề",
    component: "5.4",
    componentName: "Xác định các vấn đề cần cải thiện về năng lực số",
    cb1: {
      a: "Nhận ra được NLS của tôi cần được cải thiện hoặc cập nhật ở đâu.",
      b: "Xác định được nơi để tìm kiếm cơ hội phát triển bản thân và cập nhật sự phát triển công nghệ số.",
    },
    cb2: {
      a: "Nhận ra được NLS của tôi cần được cải thiện hoặc cập nhật ở đâu.",
      b: "Xác định được nơi để tìm kiếm cơ hội phát triển bản thân và cập nhật sự phát triển công nghệ số.",
    },
  },
  {
    field: "6",
    fieldName: "Ứng dụng trí tuệ nhân tạo",
    component: "6.1",
    componentName: "Hiểu biết về trí tuệ nhân tạo",
    cb1: {},
    cb2: {
      a: "Xác định được các khái niệm cơ bản của AI.",
      b: "Nhớ lại được các ứng dụng đơn giản của AI trong cuộc sống hàng ngày.",
    },
  },
  {
    field: "6",
    fieldName: "Ứng dụng trí tuệ nhân tạo",
    component: "6.2",
    componentName: "Sử dụng trí tuệ nhân tạo",
    cb1: {
      a: "Nhận diện được các công cụ AI đơn giản.",
      b: "Thực hiện được các thao tác cơ bản với các công cụ AI.",
      c: "Nhận thức được cơ bản về các vấn đề đạo đức và pháp lý liên quan đến AI.",
    },
    cb2: {
      a: "Áp dụng được các công cụ AI để giải quyết vấn đề đơn giản.",
      b: "Tương tác được với các hệ thống AI cơ bản.",
      c: "Tuân thủ các quy định pháp luật cơ bản khi sử dụng AI.",
    },
  },
  {
    field: "6",
    fieldName: "Ứng dụng trí tuệ nhân tạo",
    component: "6.3",
    componentName: "Đánh giá trí tuệ nhân tạo",
    cb1: {
      a: "Nhận diện được một số vật dụng hoặc trò chơi thông minh có sử dụng AI.",
      b: "Nhớ được rằng không phải mọi thông tin từ máy móc đều đúng.",
    },
    cb2: {
      a: "Nhận diện được các yếu tố cơ bản của hệ thống AI cần được đánh giá.",
      b: "Mô tả được các chức năng chính của hệ thống AI.",
    },
  },
];

const BASE_INDICATORS: Indicator[] = COMPONENTS.flatMap((item) =>
  (["CB1", "CB2"] as Level[]).flatMap((level) =>
    Object.entries(level === "CB1" ? item.cb1 : item.cb2).map(([letter, description]) => ({
      code: `${item.component}.${level}${letter}`,
      field: item.field,
      fieldName: item.fieldName,
      component: item.component,
      componentName: item.componentName,
      level,
      levelName: LEVEL_NAMES[level],
      letter,
      description,
    })),
  ),
);

const ADVANCED_INDICATORS: Indicator[] = ADVANCED_NLS_COMPONENTS.flatMap((definition) => {
  const item = COMPONENTS.find((component) => component.component === definition.component);
  if (!item) return [];

  return (Object.entries(definition.levels) as [AdvancedNlsLevel, Record<string, string>][]).flatMap(([level, descriptions]) =>
    Object.entries(descriptions).map(([letter, description]) => ({
      code: `${definition.component}.${level}${letter}`,
      field: item.field,
      fieldName: item.fieldName,
      component: item.component,
      componentName: item.componentName,
      level,
      levelName: LEVEL_NAMES[level],
      letter,
      description,
    })),
  );
});

export const INDICATORS: Indicator[] = [...BASE_INDICATORS, ...ADVANCED_INDICATORS];

const FIELD_META: Record<string, { short: string; color: string; soft: string; icon: string }> = {
  "1": { short: "Dữ liệu", color: "#2563eb", soft: "#eff6ff", icon: "⌕" },
  "2": { short: "Giao tiếp", color: "#7c3aed", soft: "#f5f3ff", icon: "↗" },
  "3": { short: "Nội dung số", color: "#db2777", soft: "#fdf2f8", icon: "✦" },
  "4": { short: "An toàn", color: "#ea580c", soft: "#fff7ed", icon: "◈" },
  "5": { short: "Giải quyết vấn đề", color: "#059669", soft: "#ecfdf5", icon: "⚙" },
  "6": { short: "AI", color: "#0891b2", soft: "#ecfeff", icon: "✧" },
};

const QUICK_FILTERS = [
  { label: "Tất cả", value: "all" },
  { label: "Năng lực AI", value: "6" },
  { label: "An toàn số", value: "4" },
  { label: "Sáng tạo nội dung", value: "3" },
];

function normalize(text: string) {
  return text
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function copyText(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (e) {
      console.warn("Clipboard API failed, falling back to execCommand", e);
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function Badge({ children, color = "#0f766e", soft = "#f0fdfa" }: { children: React.ReactNode; color?: string; soft?: string }) {
  return (
    <span className="nls-badge" style={{ color, background: soft }}>
      {children}
    </span>
  );
}

const IndicatorCard: React.FC<{
  indicator: Indicator;
  selected: boolean;
  onToggle: () => void;
  onCopy: () => Promise<void> | void;
}> = ({
  indicator,
  selected,
  onToggle,
  onCopy,
}) => {
  const meta = FIELD_META[indicator.field];

  return (
    <article className={`nls-card${selected ? " is-selected" : ""}`}>
      <div className="nls-card-topline">
        <div className="nls-code-wrap">
          <span className="nls-field-icon" style={{ color: meta.color, background: meta.soft }}>
            {meta.icon}
          </span>
          <div>
            <div className="nls-code">{indicator.code}</div>
            <div className="nls-subtle">Chỉ báo {indicator.letter.toUpperCase()}</div>
          </div>
        </div>
        <button className="nls-icon-button" onClick={onCopy} title="Sao chép mã" aria-label={`Sao chép ${indicator.code}`}>
          ⧉
        </button>
      </div>

      <div className="nls-tags">
        <Badge color={meta.color} soft={meta.soft}>{indicator.field}. {meta.short}</Badge>
        <Badge color="#475569" soft="#f1f5f9">{indicator.level} · {indicator.levelName}</Badge>
      </div>

      <h3 className="font-bold text-[14px]">{indicator.componentName}</h3>
      <p>{indicator.description}</p>

      <button className={`nls-select-button${selected ? " selected" : ""}`} onClick={onToggle}>
        <span>{selected ? "✓" : "+"}</span>
        {selected ? "Đã chọn cho kế hoạch" : "Chọn chỉ báo"}
      </button>
    </article>
  );
}

export default function NlsLookup() {
  const [query, setQuery] = useState("");
  const [fieldFilter, setFieldFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState<"all" | Level>("all");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [evidence, setEvidence] = useState("");

  const filteredIndicators = useMemo(() => {
    const normalizedQuery = normalize(query.trim());

    return INDICATORS.filter((indicator) => {
      const matchesField = fieldFilter === "all" || indicator.field === fieldFilter;
      const matchesLevel = levelFilter === "all" || indicator.level === levelFilter;
      const matchesSelected = !showSelectedOnly || selectedCodes.includes(indicator.code);
      const searchable = normalize(`${indicator.code} ${indicator.fieldName} ${indicator.componentName} ${indicator.description}`);
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      return matchesField && matchesLevel && matchesSelected && matchesQuery;
    });
  }, [fieldFilter, levelFilter, query, selectedCodes, showSelectedOnly]);

  const selectedIndicators = useMemo(
    () => selectedCodes.map((code) => INDICATORS.find((indicator) => indicator.code === code)).filter(Boolean) as Indicator[],
    [selectedCodes],
  );

  const toggleSelected = (code: string) => {
    setSelectedCodes((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]));
  };

  const handleCopy = async (code: string) => {
    await copyText(code);
    setCopied(code);
    window.setTimeout(() => setCopied((current) => (current === code ? null : current)), 1400);
  };

  const copySelected = async () => {
    if (!selectedIndicators.length) return;
    const text = selectedIndicators.map((item) => `${item.code}: ${item.description}`).join("\n");
    await copyText(text);
    setCopied("selection");
    window.setTimeout(() => setCopied(null), 1400);
  };

  const chooseQuickFilter = (value: string) => {
    setFieldFilter(value);
    setShowSelectedOnly(false);
  };

  return (
    <div className="nls-app h-full rounded-2xl overflow-hidden shadow-sm">
      <style>{`
        .nls-app { background: transparent; color: #172033; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .nls-app button, .nls-app input, .nls-app select, .nls-app textarea { font: inherit; }
        .nls-shell { max-width: 1440px; margin: 0 auto; padding: 28px 34px 52px; }
        .nls-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 24px; }
        .nls-kicker { display: flex; align-items: center; gap: 8px; color: #0f766e; font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
        .nls-kicker-dot { width: 9px; height: 9px; border-radius: 50%; background: #14b8a6; box-shadow: 0 0 0 5px #ccfbf1; }
        .nls-header h1 { margin: 10px 0 8px; font-size: clamp(28px, 4vw, 42px); line-height: 1.08; letter-spacing: -.035em; color: #14213d; font-weight: bold; }
        .nls-header p { max-width: 740px; margin: 0; color: #64748b; font-size: 15px; line-height: 1.65; }
        .nls-source { align-self: flex-start; max-width: 280px; padding: 13px 15px; border: 1px solid #dbe5ef; border-radius: 14px; background: white; color: #64748b; font-size: 12px; line-height: 1.5; box-shadow: 0 6px 20px rgba(15, 23, 42, .04); }
        .nls-source strong { display: block; margin-bottom: 4px; color: #334155; font-size: 13px; font-weight: bold; }
        .nls-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 24px; }
        .nls-stat { display: flex; align-items: center; gap: 13px; min-height: 86px; padding: 17px; border: 1px solid #e2e8f0; border-radius: 16px; background: white; box-shadow: 0 8px 25px rgba(15, 23, 42, .035); }
        .nls-stat-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; font-size: 21px; }
        .nls-stat-value { display: block; color: #172033; font-size: 24px; font-weight: 800; line-height: 1; }
        .nls-stat-label { display: block; margin-top: 6px; color: #64748b; font-size: 12px; }
        .nls-layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 22px; align-items: start; }
        .nls-main, .nls-side-card { border: 1px solid #e2e8f0; border-radius: 20px; background: white; box-shadow: 0 10px 30px rgba(15, 23, 42, .04); }
        .nls-toolbar { padding: 20px; border-bottom: 1px solid #edf2f7; }
        .nls-search { position: relative; }
        .nls-search-icon { position: absolute; top: 50%; left: 15px; transform: translateY(-50%); color: #94a3b8; font-size: 19px; }
        .nls-search input { width: 100%; height: 48px; padding: 0 45px; border: 1px solid #dbe5ef; border-radius: 13px; outline: none; background: #f8fafc; color: #172033; font-size: 14px; transition: border .2s, box-shadow .2s, background .2s; }
        .nls-search input:focus { border-color: #14b8a6; background: white; box-shadow: 0 0 0 4px #ccfbf1; }
        .nls-search-clear { position: absolute; top: 50%; right: 12px; transform: translateY(-50%); border: 0; background: transparent; color: #94a3b8; cursor: pointer; font-size: 18px; }
        .nls-filters { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; margin-top: 14px; }
        .nls-filter-button, .nls-select { height: 36px; padding: 0 12px; border: 1px solid #dbe5ef; border-radius: 10px; background: white; color: #475569; cursor: pointer; font-size: 12px; }
        .nls-filter-button:hover, .nls-filter-button.active { border-color: #99f6e4; background: #f0fdfa; color: #0f766e; }
        .nls-select { cursor: pointer; }
        .nls-filter-spacer { flex: 1; }
        .nls-results-note { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 20px 0; color: #64748b; font-size: 12px; }
        .nls-results-note strong { color: #334155; }
        .nls-results-note button { border: 0; background: transparent; color: #0f766e; cursor: pointer; font-size: 12px; font-weight: 700; }
        .nls-card-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding: 16px 20px 20px; }
        .nls-card { display: flex; min-height: 278px; flex-direction: column; padding: 17px; border: 1px solid #e5eaf0; border-radius: 16px; background: #fff; transition: transform .2s, border .2s, box-shadow .2s; }
        .nls-card:hover { transform: translateY(-2px); border-color: #b6e8df; box-shadow: 0 12px 25px rgba(15, 118, 110, .08); }
        .nls-card.is-selected { border-color: #5eead4; box-shadow: 0 0 0 3px #f0fdfa; }
        .nls-card-topline { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .nls-code-wrap { display: flex; align-items: center; gap: 10px; }
        .nls-field-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 11px; font-size: 20px; font-weight: 800; }
        .nls-code { color: #14213d; font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 15px; font-weight: 800; letter-spacing: -.02em; }
        .nls-subtle { margin-top: 3px; color: #94a3b8; font-size: 11px; }
        .nls-icon-button { display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid #e2e8f0; border-radius: 9px; background: white; color: #64748b; cursor: pointer; }
        .nls-icon-button:hover { border-color: #99f6e4; background: #f0fdfa; color: #0f766e; }
        .nls-tags { display: flex; flex-wrap: wrap; gap: 7px; margin: 15px 0 13px; }
        .nls-badge { display: inline-flex; align-items: center; min-height: 24px; padding: 4px 8px; border-radius: 7px; font-size: 11px; font-weight: 700; }
        .nls-card p { flex: 1; margin: 0; color: #64748b; font-size: 13px; line-height: 1.58; }
        .nls-select-button { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; height: 37px; margin-top: 15px; border: 1px solid #b9e8df; border-radius: 10px; background: #f0fdfa; color: #0f766e; cursor: pointer; font-size: 12px; font-weight: 800; }
        .nls-select-button:hover, .nls-select-button.selected { border-color: #0f766e; background: #0f766e; color: white; }
        .nls-select-button span { font-size: 16px; line-height: 1; }
        .nls-empty { padding: 65px 24px; text-align: center; color: #64748b; }
        .nls-empty-icon { margin-bottom: 12px; color: #94a3b8; font-size: 36px; }
        .nls-empty strong { display: block; margin-bottom: 5px; color: #334155; font-weight: bold; }
        .nls-side { display: grid; gap: 14px; }
        .nls-side-card { padding: 19px; }
        .nls-side-card h2 { margin: 0; color: #14213d; font-size: 16px; font-weight: bold; }
        .nls-side-card > p { margin: 7px 0 16px; color: #64748b; font-size: 12px; line-height: 1.55; }
        .nls-selected-list { display: grid; gap: 8px; max-height: 270px; overflow: auto; margin: 0 -4px 14px; padding: 0 4px; }
        .nls-selected-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px; border: 1px solid #e5eaf0; border-radius: 10px; background: #f8fafc; }
        .nls-selected-item code { color: #0f766e; font-size: 12px; font-weight: 800; }
        .nls-selected-item small { display: block; overflow: hidden; max-width: 210px; margin-top: 3px; color: #64748b; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
        .nls-remove { border: 0; background: transparent; color: #94a3b8; cursor: pointer; font-size: 16px; }
        .nls-remove:hover { color: #dc2626; }
        .nls-side-actions { display: flex; gap: 8px; }
        .nls-primary, .nls-secondary { flex: 1; min-height: 38px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 800; }
        .nls-primary { border: 1px solid #0f766e; background: #0f766e; color: white; }
        .nls-primary:hover { background: #115e59; }
        .nls-secondary { border: 1px solid #dbe5ef; background: white; color: #475569; }
        .nls-secondary:hover { border-color: #94a3b8; }
        .nls-empty-selected { padding: 18px 12px; border: 1px dashed #cbd5e1; border-radius: 12px; background: #f8fafc; color: #94a3b8; font-size: 12px; line-height: 1.5; text-align: center; }
        .nls-evidence-label { display: block; margin: 16px 0 7px; color: #475569; font-size: 12px; font-weight: 800; }
        .nls-evidence textarea { width: 100%; min-height: 78px; resize: vertical; padding: 10px; border: 1px solid #dbe5ef; border-radius: 10px; outline: none; color: #334155; font-size: 12px; line-height: 1.5; }
        .nls-evidence textarea:focus { border-color: #14b8a6; box-shadow: 0 0 0 3px #ccfbf1; }
        .nls-domain-list { display: grid; gap: 8px; }
        .nls-domain-row { display: flex; align-items: center; gap: 9px; width: 100%; padding: 9px; border: 1px solid transparent; border-radius: 10px; background: #f8fafc; color: #475569; cursor: pointer; text-align: left; }
        .nls-domain-row:hover, .nls-domain-row.active { border-color: #dbe5ef; background: white; }
        .nls-domain-dot { width: 9px; height: 9px; border-radius: 50%; }
        .nls-domain-name { flex: 1; font-size: 12px; }
        .nls-domain-count { color: #94a3b8; font-size: 11px; }
        .nls-toast { position: fixed; right: 24px; bottom: 24px; z-index: 20; padding: 11px 15px; border-radius: 10px; background: #14213d; color: white; box-shadow: 0 12px 30px rgba(15, 23, 42, .2); font-size: 12px; font-weight: 700; }
        @media (max-width: 1050px) { .nls-layout { grid-template-columns: 1fr; } .nls-side { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 720px) { .nls-shell { padding: 20px 14px 40px; } .nls-header { display: block; } .nls-source { max-width: none; margin-top: 16px; } .nls-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .nls-card-grid { grid-template-columns: 1fr; padding: 14px; } .nls-toolbar { padding: 14px; } .nls-results-note { padding: 14px 14px 0; } .nls-side { grid-template-columns: 1fr; } .nls-filter-spacer { display: none; } }
      `}</style>

      <div className="nls-shell">
        <header className="nls-header">
          <div>
            <div className="nls-kicker"><span className="nls-kicker-dot" /> Công cụ chuyên môn giáo viên</div>
            <h1>Tra cứu mã năng lực số</h1>
            <p>Chọn đúng chỉ báo, đúng bậc năng lực và đưa trực tiếp vào kế hoạch bài dạy, hoạt động học tập hoặc minh chứng đánh giá. Danh mục đã có đủ năm mức từ CB1 đến NC1 để đối chiếu theo cấp lớp.</p>
          </div>
          <div className="nls-source"><strong>Nguồn dữ liệu</strong>Bảng tra cứu gồm đầy đủ CB1, CB2, TC1, TC2 và NC1 theo Bảng mã NLS đã cung cấp.</div>
        </header>

        <section className="nls-stat-grid" aria-label="Tổng quan dữ liệu">
          <div className="nls-stat"><span className="nls-stat-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>▦</span><div><span className="nls-stat-value">{INDICATORS.length}</span><span className="nls-stat-label">Chỉ báo đang tra cứu</span></div></div>
          <div className="nls-stat"><span className="nls-stat-icon" style={{ background: "#f0fdfa", color: "#0f766e" }}>◉</span><div><span className="nls-stat-value">6</span><span className="nls-stat-label">Lĩnh vực năng lực</span></div></div>
          <div className="nls-stat"><span className="nls-stat-icon" style={{ background: "#fff7ed", color: "#ea580c" }}>↕</span><div><span className="nls-stat-value">5</span><span className="nls-stat-label">Bậc năng lực CB1–NC1</span></div></div>
          <div className="nls-stat"><span className="nls-stat-icon" style={{ background: "#ecfeff", color: "#0891b2" }}>✓</span><div><span className="nls-stat-value">{selectedCodes.length}</span><span className="nls-stat-label">Mã đã chọn</span></div></div>
        </section>

        <div className="nls-layout">
          <main className="nls-main">
            <div className="nls-toolbar">
              <div className="nls-search">
                <span className="nls-search-icon">⌕</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo mã, lĩnh vực, thành phần hoặc nội dung chỉ báo..." aria-label="Tìm kiếm chỉ báo năng lực số" />
                {query && <button className="nls-search-clear" onClick={() => setQuery("")} aria-label="Xóa tìm kiếm">×</button>}
              </div>
              <div className="nls-filters">
                {QUICK_FILTERS.map((filter) => <button key={filter.value} className={`nls-filter-button${fieldFilter === filter.value && !showSelectedOnly ? " active" : ""}`} onClick={() => chooseQuickFilter(filter.value)}>{filter.label}</button>)}
                <span className="nls-filter-spacer" />
                <select className="nls-select" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as "all" | Level)} aria-label="Lọc theo bậc năng lực">
                  <option value="all">Tất cả bậc</option>
                  <option value="CB1">CB1 · L1–L2–L3</option>
                  <option value="CB2">CB2 · L4–L5</option>
                  <option value="TC1">TC1 · L6–L7</option>
                  <option value="TC2">TC2 · L8–L9</option>
                  <option value="NC1">NC1 · L10–L11–L12</option>
                </select>
                <button className={`nls-filter-button${showSelectedOnly ? " active" : ""}`} onClick={() => setShowSelectedOnly((value) => !value)}>{showSelectedOnly ? "Hiện tất cả" : "Mã đã chọn"}</button>
              </div>
            </div>

            <div className="nls-results-note"><span>Hiển thị <strong>{filteredIndicators.length}</strong> / {INDICATORS.length} chỉ báo</span><span>{copied && copied !== "selection" ? `Đã sao chép ${copied}` : ""}</span></div>

            {filteredIndicators.length ? (
              <div className="nls-card-grid">
                {filteredIndicators.map((indicator) => <IndicatorCard key={indicator.code} indicator={indicator} selected={selectedCodes.includes(indicator.code)} onToggle={() => toggleSelected(indicator.code)} onCopy={() => handleCopy(indicator.code)} />)}
              </div>
            ) : (
              <div className="nls-empty"><div className="nls-empty-icon">⌕</div><strong>Chưa tìm thấy chỉ báo phù hợp</strong><span>Thử từ khóa khác hoặc xóa bớt bộ lọc.</span></div>
            )}
          </main>

          <aside className="nls-side">
            <section className="nls-side-card">
              <h2>Bộ mã cho kế hoạch bài dạy</h2>
              <p>Chỉ chọn những mã có minh chứng rõ qua công cụ, thao tác, sản phẩm và tiêu chí đánh giá; cấp THPT ưu tiên mức NC1 phù hợp yêu cầu cần đạt.</p>
              {selectedIndicators.length ? (
                <div className="nls-selected-list">
                  {selectedIndicators.map((indicator) => <div className="nls-selected-item" key={indicator.code}><div><code>{indicator.code}</code><small>{indicator.componentName}</small></div><button className="nls-remove" onClick={() => toggleSelected(indicator.code)} aria-label={`Bỏ chọn ${indicator.code}`}>×</button></div>)}
                </div>
              ) : <div className="nls-empty-selected">Chưa có mã nào được chọn.<br />Nhấn “Chọn chỉ báo” ở thẻ mã phù hợp.</div>}
              <div className="nls-side-actions"><button className="nls-primary" onClick={copySelected} disabled={!selectedIndicators.length}>{copied === "selection" ? "Đã sao chép" : "Sao chép bộ mã"}</button><button className="nls-secondary" onClick={() => setSelectedCodes([])} disabled={!selectedIndicators.length}>Xóa hết</button></div>
              <div className="nls-evidence"><label className="nls-evidence-label" htmlFor="evidence">Minh chứng dự kiến</label><textarea id="evidence" value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Ví dụ: HS tìm kiếm 2 nguồn, kiểm chứng với SGK và nộp infographic có ghi nguồn..." /></div>
            </section>

            <section className="nls-side-card">
              <h2>Lĩnh vực năng lực</h2>
              <p>Chọn nhanh một lĩnh vực để thu hẹp danh sách.</p>
              <div className="nls-domain-list">
                <button className={`nls-domain-row${fieldFilter === "all" ? " active" : ""}`} onClick={() => chooseQuickFilter("all")}><span className="nls-domain-dot" style={{ background: "#64748b" }} /><span className="nls-domain-name">Tất cả lĩnh vực</span><span className="nls-domain-count">{INDICATORS.length}</span></button>
                {Object.entries(FIELD_META).map(([field, meta]) => { const count = INDICATORS.filter((item) => item.field === field).length; return <button key={field} className={`nls-domain-row${fieldFilter === field ? " active" : ""}`} onClick={() => chooseQuickFilter(field)}><span className="nls-domain-dot" style={{ background: meta.color }} /><span className="nls-domain-name">{field}. {meta.short}</span><span className="nls-domain-count">{count}</span></button>; })}
              </div>
            </section>

            <section className="nls-side-card">
              <h2>Quy trình sử dụng</h2>
              <p>Gợi ý tích hợp vào KHBD theo hướng tinh gọn.</p>
              <div className="nls-process"><div><Badge color="#0f766e" soft="#f0fdfa">01</Badge><span>Xác định nhiệm vụ học tập</span></div><div><Badge color="#7c3aed" soft="#f5f3ff">02</Badge><span>Chọn mã có minh chứng</span></div><div><Badge color="#ea580c" soft="#fff7ed">03</Badge><span>Gắn công cụ và sản phẩm</span></div><div><Badge color="#2563eb" soft="#eff6ff">04</Badge><span>Đánh giá theo tiêu chí</span></div></div>
            </section>
          </aside>
        </div>
      </div>

      {copied && <div className="nls-toast" role="status">✓ Đã sao chép vào bộ nhớ tạm</div>}
    </div>
  );
}
