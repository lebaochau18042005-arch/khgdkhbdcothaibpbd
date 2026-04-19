# KaTeX CSS Overrides Reference

## Vấn đề

Hầu hết app React/Vue/Angular dùng CSS reset:
```css
*, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}
```

KaTeX sử dụng `content-box` + margin/padding nội bộ để tính kích thước:
- Phân số: numerator + frac-line + denominator stacked bằng padding/margin
- Căn bậc hai: sqrt-sign + overline dùng specific padding
- Tích phân: integral bounds dùng margin để positioning

CSS reset → tất cả khoảng cách = 0 → công thức **co lại thành 0px** hoặc **chồng chéo**.

## CSS Override Template

```css
/* ============ MATH CONTENT (KaTeX) — CRITICAL FIXES ============ */

/* 1. Reset box-model — KHÔNG dùng border-box cho KaTeX */
.katex,
.katex * {
    box-sizing: content-box !important;
    margin: revert !important;
    padding: revert !important;
}

/* 2. KaTeX container */
.katex {
    color: var(--text-primary) !important;
    font-size: inherit;
    text-indent: 0;
    text-rendering: auto;
    border: none !important;
    background: none !important;
}

/* 3. Text elements trong KaTeX — dark theme support */
.katex .mord,
.katex .mbin,
.katex .mrel,
.katex .mopen,
.katex .mclose,
.katex .mpunct,
.katex .mop,
.katex .minner,
.katex .mathnormal,
.katex .mathit,
.katex .mathbf,
.katex .amsrm,
.katex .textrm {
    color: var(--text-primary) !important;
}

/* 4. Phân số — đường kẻ ngang */
.katex .frac-line {
    border-bottom-color: var(--text-primary) !important;
    background: var(--text-primary) !important;
}

/* 5. Căn bậc hai — đường kẻ trên */
.katex .sqrt > .sqrt-line {
    border-bottom-color: var(--text-primary) !important;
    background: var(--text-primary) !important;
}

/* 6. Overline / Underline */
.katex .overline .overline-line,
.katex .underline .underline-line {
    border-bottom-color: var(--text-primary) !important;
    background: var(--text-primary) !important;
}

/* 7. Ký hiệu căn √ */
.katex .sqrt-sign {
    color: var(--text-primary) !important;
}

/* 8. Dấu ngoặc lớn (delimiters) */
.katex .delimsizing,
.katex .delimsizing svg,
.katex .delimsizing .delim-size1,
.katex .delimsizing .delim-size4 {
    color: var(--text-primary) !important;
    fill: var(--text-primary) !important;
}

/* 9. SVG elements */
.katex svg { fill: var(--text-primary) !important; stroke: var(--text-primary) !important; }
.katex svg path { fill: var(--text-primary) !important; }
.katex path { stroke: var(--text-primary) !important; }
.katex line { stroke: var(--text-primary) !important; }
.katex rect { fill: var(--text-primary) !important; }

/* 10. Container wrapper */
.math-content {
    line-height: 1.8;
    word-wrap: break-word;
    overflow-wrap: break-word;
}

/* 11. Inline math */
.inline-math-wrapper {
    display: inline;
    vertical-align: baseline;
}
.inline-math-wrapper .katex {
    display: inline !important;
    vertical-align: baseline;
}

/* 12. Block math (display equations) */
.block-math-wrapper {
    display: block;
    text-align: center;
    margin: 0.5rem 0;
    overflow-x: auto;
}

/* 13. Responsive */
@media (max-width: 768px) {
    .katex { font-size: 0.95em; }
    .block-math-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
}
```

## Tích hợp với CSS Variables

Nếu app dùng dark mode với CSS variables:

```css
:root {
    --text-primary: #1a1a2e;
    --bg-primary: #ffffff;
}

[data-theme="dark"] {
    --text-primary: #e0e0e0;
    --bg-primary: #1a1a2e;
}
```

KaTeX overrides trên dùng `var(--text-primary)` → tự động chuyển màu theo theme.

## Thứ Tự Import CSS Quan Trọng

```
1. KaTeX CSS (katex.min.css) — base styles
2. App global CSS (index.css) — chứa CSS reset + KaTeX overrides
3. Component CSS (nếu có)
```

KaTeX CSS PHẢI load TRƯỚC app CSS, vì app CSS cần override nó.
