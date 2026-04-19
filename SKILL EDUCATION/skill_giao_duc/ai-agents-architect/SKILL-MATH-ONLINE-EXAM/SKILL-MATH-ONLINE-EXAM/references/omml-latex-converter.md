# OMML → LaTeX Converter Reference

## Tổng quan

OMML (Office MathML) là format XML Microsoft dùng trong DOCX để lưu công thức toán.
Converter đọc XML tree và chuyển đổi recursive thành LaTeX string.

## Kiến trúc

```
ommlToLatex(node) → switch(tag) → parseXxx(node) → childrenToLatex(children)
```

Mỗi OMML element có hàm parse riêng. Kết quả là LaTeX string bọc trong `$...$`.

## Mapping Unicode → LaTeX

Ký tự Unicode toán học từ `m:t` (text run) cần được map sang LaTeX commands:

```typescript
const charMap: Record<string, string> = {
    // Greek letters
    'π': '\\pi', 'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma',
    'δ': '\\delta', 'ε': '\\varepsilon', 'θ': '\\theta', 'λ': '\\lambda',
    'μ': '\\mu', 'σ': '\\sigma', 'φ': '\\varphi', 'ω': '\\omega',
    'Δ': '\\Delta', 'Σ': '\\Sigma', 'Π': '\\Pi', 'Ω': '\\Omega',
    
    // Operators
    '±': '\\pm', '×': '\\times', '÷': '\\div',
    '≤': '\\leq', '≥': '\\geq', '≠': '\\neq', '≈': '\\approx',
    
    // Sets
    '∈': '\\in', '∉': '\\notin', '⊂': '\\subset', '⊃': '\\supset',
    '∪': '\\cup', '∩': '\\cap', '∅': '\\emptyset',
    
    // Calculus/Logic
    '∞': '\\infty', '∂': '\\partial', '∇': '\\nabla',
    '∀': '\\forall', '∃': '\\exists',
    
    // Arrows
    '→': '\\to', '⇒': '\\Rightarrow', '⇔': '\\Leftrightarrow',
    
    // N-ary operators
    '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint',
    '∑': '\\sum', '∏': '\\prod',
    
    // Dots
    '…': '\\ldots', '⋯': '\\cdots', '⋮': '\\vdots',
};
```

## Parse Rules Chi Tiết

### Fraction (`m:f`)
```xml
<m:f>
  <m:num><m:r><m:t>a</m:t></m:r></m:num>
  <m:den><m:r><m:t>b</m:t></m:r></m:den>
</m:f>
```
→ `\frac{a}{b}`

### Radical (`m:rad`)
```xml
<m:rad>
  <m:radPr><m:degHide m:val="1"/></m:radPr>  <!-- ẩn bậc = √ -->
  <m:deg/>
  <m:e><m:r><m:t>2</m:t></m:r></m:e>
</m:rad>
```
→ `\sqrt{2}` (nếu `degHide=1` hoặc bậc = 2)
→ `\sqrt[3]{x}` (nếu có bậc khác 2)

### N-ary (`m:nary`) — Tích phân, Tổng, Tích
```xml
<m:nary>
  <m:naryPr><m:chr m:val="∫"/></m:naryPr>
  <m:sub><m:r><m:t>0</m:t></m:r></m:sub>
  <m:sup><m:r><m:t>1</m:t></m:r></m:sup>
  <m:e><m:r><m:t>f(x)dx</m:t></m:r></m:e>
</m:nary>
```
→ `\int_{0}^{1} f(x)dx`

### Delimiter (`m:d`) — Ngoặc
```xml
<m:d>
  <m:dPr>
    <m:begChr m:val="["/>
    <m:endChr m:val="]"/>
  </m:dPr>
  <m:e>...</m:e>
</m:d>
```
→ `\left[...\right]`

Delimiter map:
- `()` → `\left( \right)`
- `[]` → `\left[ \right]`
- `{}` → `\left\{ \right\}`
- `||` → `\left| \right|`
- `⌊⌋` → `\left\lfloor \right\rfloor`

### Accent (`m:acc`)

Accent character (combining Unicode):
- `U+0302` → `\hat{}`
- `U+0303` → `\tilde{}`
- `U+0304` → `\bar{}`
- `U+20D7` → `\vec{}`
- `U+0307` → `\dot{}`
- `U+0308` → `\ddot{}`

### Function (`m:func`)

Recognized functions → LaTeX commands:
```
sin cos tan cot sec csc → \sin \cos \tan \cot \sec \csc
arcsin arccos arctan → \arcsin \arccos \arctan
log ln lg → \log \ln \lg
lim max min → \lim \max \min
exp det gcd → \exp \det \gcd
```
Unknown → `\operatorname{name}`

### Matrix (`m:m`)
```xml
<m:m>
  <m:mr>
    <m:e><m:r><m:t>a</m:t></m:r></m:e>
    <m:e><m:r><m:t>b</m:t></m:r></m:e>
  </m:mr>
  <m:mr>
    <m:e><m:r><m:t>c</m:t></m:r></m:e>
    <m:e><m:r><m:t>d</m:t></m:r></m:e>
  </m:mr>
</m:m>
```
→ `\begin{pmatrix} a & b \\ c & d \end{pmatrix}`

## MathType OLE Limitation

Khi DOCX dùng MathType (plugin cũ), công thức lưu dạng OLE binary trong `word/embeddings/*.bin`.
Browser KHÔNG thể parse binary này. Cách xử lý:
1. Detect: scan `word/embeddings/` cho `.bin` files, check header string "MathType"/"DSMT"/"Equation"
2. Cảnh báo user: thông báo một số công thức có thể thiếu
3. Fallback: gửi toàn bộ content cho AI, yêu cầu suy luận từ ngữ cảnh
