# Data Schema Reference

## Question Interface

```typescript
interface Question {
    id: number;
    type: 'multiple_choice' | 'true_false' | 'short_answer';
    
    // Text + LaTeX inline: "Cho $A(1;2;3)$ và $B(4;5;6)$"
    question: string;
    
    // Đáp án trắc nghiệm: ["A. $\frac{1}{2}$", "B. $\sqrt{3}$", ...]
    options?: string[];
    
    // Đáp án đúng: "A" | ["true","false","true","false"] | "42"
    correct_answer: string | string[];
    
    // Mệnh đề con (câu Đúng/Sai)
    sub_questions?: {
        label: string;      // "a", "b", "c", "d"
        content: string;    // Text + LaTeX
        correct_answer: string;  // "true" | "false"
    }[];
    
    // Hình ảnh
    has_image?: boolean;
    image_description?: string;  // Mô tả từ AI
    image_url?: string;          // Firebase Storage URL
    image_index?: number;        // Vị trí trong DOCX (0-based)
    image_page?: number;         // Trang PDF (1-based)
}
```

## Exam Interface

```typescript
interface Exam {
    id: string;
    teacher_id: string | null;
    title: string;
    room_code: string;        // Mã phòng thi (6 ký tự)
    pdf_url: string | null;   // URL file gốc trên Storage
    questions: Question[];     // Mảng câu hỏi
    time_limit: number;        // Giới hạn thời gian (phút)
    is_active: boolean;
    created_at: string;        // ISO datetime
    
    // Scheduling
    scheduled_start?: string;
    scheduled_end?: string;
    status?: 'draft' | 'scheduled' | 'active' | 'ended';
}
```

## Submission Interface

```typescript
interface Submission {
    id: string;
    exam_id: string;
    student_id: string;
    student_name: string;
    student_code?: string;     // Mã HS (từ danh sách lớp)
    answers: Record<number, string | string[]>;  // question_id → answer
    score: number;
    total_questions: number;
    exit_count: number;        // Số lần thoát màn hình
    time_spent: number;        // Giây
    status: 'in_progress' | 'submitted';
    current_question: number;  // Index câu hiện tại
    started_at: string;
    submitted_at: string | null;
}
```

## Cách Tính Điểm (Toán THPT Chuẩn CV 7991)

```
Phần 1: 12 câu trắc nghiệm 4 chọn → 0.25 điểm/câu = 3 điểm
Phần 2: 4 câu Đúng/Sai (4 ý/câu):
    1 ý đúng → 0.1đ, 2 ý → 0.25đ, 3 ý → 0.5đ, 4 ý → 1đ = 4 điểm
Phần 3: 6 câu trả lời ngắn → 0.5 điểm/câu = 3 điểm
Tổng: 10 điểm
```

## JSON Response Từ AI (Mẫu)

```json
{
    "title": "Đề kiểm tra Toán 12 - Chương 1",
    "has_answer_markers": true,
    "questions": [
        {
            "id": 1,
            "type": "multiple_choice",
            "question": "Hàm số nào sau đây đồng biến trên $\\mathbb{R}$?",
            "options": [
                "A. $y = -x^3 + 3x$",
                "B. $y = x^3 - 3x$",
                "C. $y = x^3 + 1$",
                "D. $y = -x^3 - 1$"
            ],
            "correct_answer": "C",
            "has_image": false,
            "image_description": "",
            "image_index": -1
        },
        {
            "id": 13,
            "type": "true_false",
            "question": "Cho hàm số $y = \\frac{x+1}{x-2}$",
            "sub_questions": [
                {"label": "a", "content": "Đồ thị hàm số có tiệm cận đứng $x = 2$", "correct_answer": "true"},
                {"label": "b", "content": "Đồ thị hàm số có tiệm cận ngang $y = 0$", "correct_answer": "false"},
                {"label": "c", "content": "Hàm số đồng biến trên $(2; +\\infty)$", "correct_answer": "false"},
                {"label": "d", "content": "Giá trị lớn nhất của hàm số trên $[3; 5]$ bằng $\\frac{4}{3}$", "correct_answer": "true"}
            ],
            "has_image": false,
            "image_description": "",
            "image_index": -1
        },
        {
            "id": 17,
            "type": "short_answer",
            "question": "Cho hình chóp $S.ABCD$ có đáy là hình vuông cạnh $a$, $SA \\perp (ABCD)$, $SA = a\\sqrt{2}$. Tính thể tích khối chóp.",
            "correct_answer": "\\frac{a^3\\sqrt{2}}{3}",
            "has_image": true,
            "image_description": "Hình chóp S.ABCD với SA vuông góc mặt đáy",
            "image_index": 2,
            "image_page": 3
        }
    ]
}
```

## LƯU Ý về LaTeX trong JSON

Trong JSON string, backslash phải escaped: `\\frac` (2 ký tự: `\` + `\` + `frac`).
Nhưng Gemini thường viết `\frac` (1 backslash) → JSON.parse hiểu `\f` = form feed!
→ PHẢI dùng `sanitizeLatexInJson()` TRƯỚC `JSON.parse()`.
