# Sanitize LaTeX In JSON Reference

## Bảng Xung Đột JSON ↔ LaTeX

| JSON Escape | Ý nghĩa JSON | LaTeX Command | Ý nghĩa LaTeX |
|---|---|---|---|
| `\b` | Backspace (U+0008) | `\beta`, `\bar`, `\binom`, `\begin`, `\bf` | Ký hiệu / lệnh |
| `\f` | Form feed (U+000C) | `\frac`, `\flat`, `\forall` | Phân số / ký hiệu |
| `\n` | Line feed (U+000A) | `\nu`, `\newline`, `\newcommand`, `\not` | Ký hiệu / lệnh |
| `\r` | Carriage return (U+000D) | `\right`, `\rangle`, `\rfloor`, `\rceil` | Ngoặc phải |
| `\t` | Tab (U+0009) | `\text`, `\theta`, `\tan`, `\times`, `\to` | Lệnh / ký hiệu |
| `\u` | Unicode escape | `\underline`, `\underset`, `\uparrow` | Lệnh |

## Implementation

```typescript
/**
 * Must be called BEFORE JSON.parse() on any AI response containing LaTeX.
 * 
 * Strategy: ALL \letter patterns in math context are LaTeX commands.
 * Double-escape them so JSON.parse preserves the backslash.
 * 
 * Edge case: \n (true newline in JSON) becomes \\n (literal text).
 * This is acceptable for exam content — we don't need exact newlines.
 */
function sanitizeLatexInJson(jsonText: string): string {
    return jsonText.replace(/(?<!\\)\\([a-zA-Z])/g, '\\\\$1');
}
```

## Hành Vi Theo Từng Trường Hợp

| Input (raw bytes) | Ý nghĩa | Sau sanitize | Sau JSON.parse |
|---|---|---|---|
| `\frac` | LaTeX frac | `\\frac` | `\frac` ✅ |
| `\\frac` | Already escaped | `\\\\frac` | `\\frac` → normalize → `\frac` ✅ |
| `\n` | JSON newline | `\\n` | Literal `\n` text ⚠️ |
| `\\n` | Already escaped | `\\\\n` | `\\n` text ⚠️ |
| `\"` | JSON quote | `\"` (unchanged - not a letter) | `"` ✅ |
| `\\` | JSON backslash | `\\` (unchanged - not followed by letter) | `\` ✅ |

## Nơi Áp Dụng

```typescript
// EVERY place that parses AI JSON response:

// 1. analyzeExamWithVision
const result = JSON.parse(sanitizeLatexInJson(jsonStr));

// 2. analyzeExamText
const result = JSON.parse(sanitizeLatexInJson(jsonStr));

// 3. analyzeExamMarkdown
const result = JSON.parse(sanitizeLatexInJson(jsonStr));

// 4. solveAnswersWithAI
const result = JSON.parse(sanitizeLatexInJson(jsonStr));
```

## Tại Sao Không Dùng Approach Phức Tạp Hơn?

**Approach bị reject**: Chỉ escape `\X` khi X KHÔNG phải JSON escape char.
```typescript
// ❌ Phức tạp, dễ sai
return jsonText.replace(/(?<!\\)\\(?!["\\\/bfnrtu])/g, '\\\\');
```
Vấn đề: `\frac` → `\f` khớp JSON escape exemption → KHÔNG được escape → `\f` thành form feed!

**Approach hiện tại**: Escape TẤT CẢ `\letter` patterns.
```typescript
// ✅ Đơn giản, bao quát
return jsonText.replace(/(?<!\\)\\([a-zA-Z])/g, '\\\\$1');
```
Nhược điểm duy nhất: `\n` (real newline) thành text — chấp nhận được.

## Test Script

```javascript
function sanitize(t) { return t.replace(/(?<!\\)\\([a-zA-Z])/g, '\\\\$1'); }
const tests = [
    '{"q":"$\\frac{a}{b}$"}',      // \frac
    '{"q":"$\\sqrt{2}$"}',          // \sqrt
    '{"q":"$\\beta+\\pi$"}',        // \beta, \pi
    '{"q":"$\\int_0^1 f(x)dx$"}',  // \int
    '{"q":"$\\text{hello}$"}',      // \text
    '{"q":"$\\right)$"}',           // \right
    '{"q":"$\\\\frac{a}{b}$"}',     // already escaped
];
tests.forEach((t, i) => {
    const p = JSON.parse(sanitize(t));
    console.log(`Test ${i+1}: ${p.q}`);
});
```
