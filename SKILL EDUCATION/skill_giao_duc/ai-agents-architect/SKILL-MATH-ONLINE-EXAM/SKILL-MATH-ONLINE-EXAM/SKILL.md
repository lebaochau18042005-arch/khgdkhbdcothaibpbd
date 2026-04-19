---
name: SKILL-MATH-ONLINE-EXAM
description: >
  Xử lý công thức toán học end-to-end cho hệ thống thi trực tuyến.
  Bao gồm: trích xuất đề thi DOCX (OMML→LaTeX), sanitize LaTeX qua JSON,
  render KaTeX trên giao diện học sinh, và sửa xung đột CSS.
  Gọi skill này khi: xây dựng app thi online có công thức toán,
  sửa lỗi công thức không hiển thị, trích xuất đề thi từ Word,
  render LaTeX trên web, xung đột KaTeX với CSS reset.
---

# Xử Lý Công Thức Toán Cho Hệ Thống Thi Online

## Tổng Quan Pipeline

```
DOCX file → [wordParser] → Markdown+LaTeX → [Gemini AI] → JSON
→ [sanitizeLatexInJson] → JSON.parse → Question[] → Firestore
→ [StudentExam] → <MathContent> → KaTeX render → Hiển thị
```

Mỗi bước có BẪY đặc thù. Skill này ghi lại tất cả.

## 1. Trích Xuất Đề Thi Từ DOCX

### Cách DOCX lưu công thức

DOCX = file ZIP chứa XML. Công thức toán được lưu dưới 3 dạng:

| Dạng | Namespace | Cách xử lý |
|------|-----------|-------------|
| **OMML** (Office MathML) | `m:oMath` | Parse XML → convert sang LaTeX ✅ |
| **MathType OLE** | Binary `.bin` trong `word/embeddings/` | KHÔNG parse được trên browser ⚠️ |
| **LaTeX text** | Inline trong `w:t` | Giữ nguyên ✅ |

### OMML → LaTeX Converter

Xem **references/omml-latex-converter.md** cho chi tiết converter. Các element chính:

| OMML Element | LaTeX Output | Ví dụ |
|---|---|---|
| `m:f` (fraction) | `\frac{num}{den}` | $\frac{a}{b}$ |
| `m:rad` (radical) | `\sqrt[deg]{e}` | $\sqrt{2}$ |
| `m:sSup` | `base^{sup}` | $x^2$ |
| `m:sSub` | `base_{sub}` | $a_n$ |
| `m:nary` | `\int_{sub}^{sup}` | $\int_0^1 f(x)dx$ |
| `m:d` (delimiter) | `\left( ... \right)` | $\left(\frac{1}{2}\right)$ |
| `m:m` (matrix) | `\begin{pmatrix}...\end{pmatrix}` | Ma trận |
| `m:acc` (accent) | `\hat{x}`, `\vec{v}` | $\hat{x}$ |
| `m:func` | `\sin`, `\cos`, `\lim` | $\sin x$ |

### Trích xuất hình ảnh từ DOCX

Hình nằm trong `word/media/` → extract base64. **Bỏ qua EMF/WMF** (Gemini không xử lý được).

```typescript
// Hình ảnh hợp lệ: png, jpg, gif, bmp, svg, webp
// Skip: emf, wmf (vector cũ của Windows)
```

### Detect đáp án qua formatting

Giáo viên đánh dấu đáp án đúng bằng **gạch chân** trong Word:
- Parser detect `<w:u>` trong `<w:rPr>` → wrap text bằng marker `⟨u⟩...⟨/u⟩`
- AI prompt nhìn marker → điền `correct_answer`

## 2. BẪY CHẾT NGƯỜI: JSON.parse Phá Hỏng LaTeX

### Vấn đề

Khi AI (Gemini) trả về JSON chứa LaTeX, JSON escape sequences **XE NHAU** với LaTeX commands:

```
JSON spec    | LaTeX command  | JSON.parse làm gì
\f = form feed  | \frac         | \f + "rac" = <U+000C>rac  ❌
\b = backspace  | \beta         | \b + "eta" = <U+0008>eta  ❌
\t = tab        | \text         | \t + "ext" = <TAB>ext     ❌
\r = carriage   | \right        | \r + "ight" = <CR>ight    ❌
\n = newline    | \newcommand   | \n + "ewcommand"          ❌
```

**Đây là nguyên nhân #1 khiến công thức biến mất** — không phải lỗi CSS, không phải lỗi KaTeX.

### Giải pháp: sanitizeLatexInJson()

```typescript
function sanitizeLatexInJson(jsonText: string): string {
    // \frac → JSON interprets \f as form feed → BROKEN!
    // Fix: escape ALL \letter patterns (LaTeX commands)
    // (?<!\\) = not already escaped, \\([a-zA-Z]) = backslash + letter
    return jsonText.replace(/(?<!\\)\\([a-zA-Z])/g, '\\\\$1');
}

// Áp dụng TRƯỚC MỌI JSON.parse():
const data = JSON.parse(sanitizeLatexInJson(responseText));
```

**Logic:**
- `\frac` → `\\frac` → JSON.parse → `\frac` ✅
- `\\frac` (đã escaped) → `\\\\frac` → JSON.parse → `\\frac` → MathContent normalize → `\frac` ✅
- `\n` (thật sự newline?) → `\\n` → JSON.parse → literal `\n` text (chấp nhận được cho nội dung câu hỏi)

### Checklist áp dụng

Phải sanitize ở **TẤT CẢ** nơi parse JSON từ AI:
- [ ] `analyzeExamWithVision()` — phân tích ảnh
- [ ] `analyzeExamText()` — phân tích text
- [ ] `analyzeExamMarkdown()` — phân tích markdown
- [ ] `solveAnswersWithAI()` — giải đáp án

## 3. AI Prompt Cho Trích Xuất LaTeX

### Quy tắc cho prompt gửi AI

```
⚠️ QUY TẮC CÔNG THỨC TOÁN HỌC:
- BẮT BUỘC bọc TẤT CẢ công thức trong $...$
- Ví dụ: "cho $A(1;2;3)$ và $B(4;5;6)$"
- Phân số: $\frac{a}{b}$, căn: $\sqrt{2}$, tích phân: $\int_0^1$
- CHỈ dùng $...$ cho inline, KHÔNG dùng $$...$$
```

### Cấu trúc JSON output mong muốn

Xem **references/data-schema.md** cho chi tiết schema đầy đủ.

## 4. Render KaTeX Trên Frontend

### Dependency

```bash
npm install katex
```

### Import CSS (2 lớp bảo vệ)

```typescript
// main.tsx — primary: bundle cùng app
import 'katex/dist/katex.min.css';
```

```html
<!-- index.html — fallback: CDN backup -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.27/dist/katex.min.css" crossorigin="anonymous">
```

### MathContent Component

Xem **references/math-content-component.md** cho code đầy đủ. Các điểm chính:

1. **Parse segments**: Tách text thành `{type:'text'|'math', value}[]`
2. **Normalize LaTeX**: Sửa double backslash `\\frac` → `\frac`
3. **Preprocess delimiters**: `\(...\)` → `$...$`, `\[...\]` → `$$...$$`
4. **Render synchronous**: KaTeX render đồng bộ, không cần useEffect
5. **CDN font fallback**: Kiểm tra font sau 2s, inject CDN nếu cần
6. **Error handling**: `throwOnError: false` → hiển thị text gốc nếu lỗi

### Macros cho toán Việt Nam

```typescript
macros: {
    '\\R': '\\mathbb{R}',  // Tập số thực
    '\\N': '\\mathbb{N}',  // Tập tự nhiên
    '\\Z': '\\mathbb{Z}',  // Tập nguyên
    '\\Q': '\\mathbb{Q}',  // Tập hữu tỉ
    '\\C': '\\mathbb{C}',  // Tập phức
    '\\dse': '\\displaystyle',
}
```

## 5. BẪY CSS: Global Reset Phá KaTeX

### Vấn đề

Hầu hết app React dùng CSS reset:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
```

KaTeX dùng `content-box` + margin/padding nội bộ để tính kích thước phân số, căn bậc hai, tích phân. CSS reset phá vỡ hoàn toàn layout → công thức **co lại thành 0px** hoặc **chồng chéo**.

### Giải pháp

Xem **references/katex-css-overrides.md** cho code CSS đầy đủ. Quy tắc critical:

```css
/* CRITICAL: Reset box-model cho KaTeX */
.katex, .katex * {
    box-sizing: content-box !important;
    margin: revert !important;
    padding: revert !important;
}
```

Thêm color overrides cho dark theme: `.frac-line`, `.sqrt-line`, `.overline-line`, SVG fill/stroke.

## 6. Database Schema

### Question (Firestore document)

```typescript
interface Question {
    id: number;
    type: 'multiple_choice' | 'true_false' | 'short_answer';
    question: string;          // Text + LaTeX inline $...$
    options?: string[];         // ["A. $\frac{1}{2}$", "B. $\sqrt{3}$", ...]
    correct_answer: string | string[];
    sub_questions?: { content: string; answer: string }[];
    has_image?: boolean;
    image_description?: string;
    image_url?: string;        // Firebase Storage URL
    image_index?: number;      // Vị trí trong DOCX media (0-based)
    image_page?: number;       // Trang PDF (1-based)
}
```

**QUAN TRỌNG**: Trường `question` và `options` chứa LaTeX INLINE dạng `$...$`. Khi đọc từ Firestore và hiển thị, PHẢI dùng `<MathContent>` component.

### Data Flow

```
DOCX → wordParser → markdown+images → Gemini AI → JSON
→ sanitizeLatexInJson → JSON.parse → Question[]
→ Firestore (lưu $...$ LaTeX as-is) → Student UI
→ MathContent → KaTeX → HTML rendered
```

## 7. Checklist Tích Hợp

Khi xây dựng hoặc debug hệ thống thi online có công thức toán:

- [ ] **DOCX Parser**: wordParser.ts có OMML→LaTeX converter
- [ ] **sanitizeLatexInJson**: Áp dụng TRƯỚC mọi `JSON.parse(aiResponse)`
- [ ] **AI Prompt**: Yêu cầu AI bọc công thức trong `$...$`
- [ ] **KaTeX CSS import**: Cả npm bundle + CDN fallback
- [ ] **CSS Override**: `.katex * { box-sizing: content-box !important }`
- [ ] **MathContent component**: Wrap mọi text có thể chứa LaTeX
- [ ] **Dark theme**: Override color cho `.frac-line`, `.sqrt-line`, SVG
- [ ] **Error handling**: `throwOnError: false` + fallback hiển thị text gốc
- [ ] **Mobile responsive**: Thu nhỏ font-size, overflow-x auto cho display math

## 8. Debug Khi Công Thức Không Hiện

Thứ tự kiểm tra:

1. **Console log dữ liệu**: `console.log(question.question)` → có `$\frac{...}$` không?
2. **Kiểm tra `\f` form feed**: Copy text, search byte `0x0C` → nếu có → thiếu sanitizer
3. **KaTeX font 404**: DevTools Network → filter `.woff2` → nếu 404 → CDN fallback
4. **CSS inspector**: Select `.katex` element → `box-sizing` phải là `content-box`
5. **KaTeX error**: Tìm element `.katex-error` → xem title attribute → LaTeX syntax sai
