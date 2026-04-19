# MathContent Component Reference

## Kiến trúc

```
MathContent (React component)
├── preprocessContent()     — \(...\) → $...$, \[...\] → $$...$$
├── parseSegments()         — Tách thành [{type:'text'|'math', value}]
├── normalizeLatexCmd()     — Sửa \\frac → \frac, \\\frac → \frac
├── renderLatex()           — KaTeX.renderToString (synchronous)
├── escapeHtml()            — <>&" → HTML entities
└── ensureKatexFonts()      — CDN fallback nếu local fonts fail
```

## Code Template Đầy Đủ

```tsx
import { useMemo, memo, useEffect } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathContentProps {
    content: string;
    className?: string;
    style?: React.CSSProperties;
    block?: boolean;
}

// CDN fallback — inject link element nếu local fonts không load
let fontCheckDone = false;
function ensureKatexFonts() {
    if (fontCheckDone) return;
    fontCheckDone = true;
    if (typeof document === 'undefined') return;
    setTimeout(() => {
        try {
            const testEl = document.createElement('span');
            testEl.innerHTML = katex.renderToString('x', { throwOnError: false, output: 'html' });
            testEl.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
            document.body.appendChild(testEl);
            const height = testEl.querySelector('.katex')?.getBoundingClientRect().height || 0;
            document.body.removeChild(testEl);
            if (height < 5) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.27/dist/katex.min.css';
                link.crossOrigin = 'anonymous';
                document.head.appendChild(link);
            }
        } catch {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.27/dist/katex.min.css';
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        }
    }, 2000);
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
               .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function normalizeLatexCmd(latex: string): string {
    let result = latex;
    result = result.replace(/\\\\([a-zA-Z])/g, '\\$1');   // \\frac → \frac
    result = result.replace(/\\\\([{}])/g, '\\$1');         // \\{ → \{
    result = result.replace(/\\{3,}([a-zA-Z])/g, '\\$1');  // \\\frac → \frac
    return result.trim();
}

function preprocessContent(content: string): string {
    let result = content;
    result = result.replace(/\\\((.+?)\\\)/g, '$$$1$$');     // \(...\) → $...$
    result = result.replace(/\\\[(.+?)\\\]/gs, '$$$$$1$$$$'); // \[...\] → $$...$$
    return result;
}

function parseSegments(content: string): Array<{type:'text'|'math'; value:string}> {
    if (!content) return [];
    const segments: Array<{type:'text'|'math'; value:string}> = [];
    let i = 0;
    while (i < content.length) {
        if (content[i] === '$') {
            const isDouble = content[i + 1] === '$';
            const delimLen = isDouble ? 2 : 1;
            const closeDelim = isDouble ? '$$' : '$';
            const closeIdx = content.indexOf(closeDelim, i + delimLen);
            if (closeIdx === -1) {
                segments.push({ type: 'text', value: content[i] });
                i++;
                continue;
            }
            const mathContent = content.substring(i + delimLen, closeIdx);
            if (mathContent.trim()) {
                segments.push({ type: 'math', value: normalizeLatexCmd(mathContent) });
            }
            i = closeIdx + (isDouble ? 2 : 1);
        } else {
            let textEnd = content.indexOf('$', i);
            if (textEnd === -1) textEnd = content.length;
            const textContent = content.substring(i, textEnd);
            if (textContent) {
                segments.push({ type: 'text', value: textContent });
            }
            i = textEnd;
        }
    }
    return segments;
}

function renderLatex(latex: string, displayMode: boolean = false): string {
    try {
        return katex.renderToString(latex, {
            throwOnError: false,
            displayMode,
            strict: false,
            trust: true,
            output: 'html',
            macros: {
                '\\R': '\\mathbb{R}',
                '\\N': '\\mathbb{N}',
                '\\Z': '\\mathbb{Z}',
                '\\Q': '\\mathbb{Q}',
                '\\C': '\\mathbb{C}',
                '\\dse': '\\displaystyle',
            }
        });
    } catch (err) {
        return `<span class="katex-error" title="${escapeHtml(latex)}">${escapeHtml(latex)}</span>`;
    }
}

export const MathContent = memo(function MathContent({
    content, className = '', style, block = false
}: MathContentProps) {
    useEffect(() => { ensureKatexFonts(); }, []);
    
    const renderedHtml = useMemo(() => {
        if (!content) return '';
        const processed = preprocessContent(content);
        if (!processed.includes('$')) return escapeHtml(processed);
        const segments = parseSegments(processed);
        return segments.map(seg =>
            seg.type === 'math' ? renderLatex(seg.value) : escapeHtml(seg.value)
        ).join('');
    }, [content]);

    const Component = block ? 'div' : 'span';
    return (
        <Component
            className={`math-content ${className}`}
            style={{ display: block ? 'block' : 'inline', ...style }}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
    );
});
```

## Cách Sử Dụng

```tsx
// Inline trong câu hỏi
<MathContent content={question.question} />

// Trong đáp án
{question.options?.map((opt, i) => (
    <label key={i}>
        <input type="radio" name={`q-${question.id}`} />
        <MathContent content={opt} />
    </label>
))}

// Block display
<MathContent content={longEquation} block={true} />
```

## Tại Sao KaTeX Chứ Không Phải MathJax?

| Tiêu chí | KaTeX | MathJax |
|----------|-------|---------|
| Render | **Đồng bộ** (instant) | Bất đồng bộ |
| Tốc độ | ~100x nhanh hơn | Chậm |
| Bundle | ~900KB (CSS+fonts) | ~3MB |
| React | useMemo perfect | Cần useEffect + ref |
| Race condition | Không | Có (async render) |

**KaTeX LÝ TƯỞNG cho thi trực tuyến** vì render đồng bộ → không flicker, không race condition khi chuyển câu hỏi.
