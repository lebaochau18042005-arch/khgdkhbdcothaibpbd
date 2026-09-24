export type GeminiErrorKind = 'API_KEY_INVALID' | 'PERMISSION_DENIED' | 'QUOTA_EXHAUSTED' | 'INVALID_ARGUMENT' | 'MODEL_NOT_FOUND' | 'MODEL_OVERLOADED' | 'UNKNOWN';

const messages: Record<GeminiErrorKind, string> = {
  API_KEY_INVALID: 'API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra trong Cài đặt.',
  PERMISSION_DENIED: 'API key không có quyền truy cập Gemini API. Vui lòng kiểm tra quyền trong Google AI Studio.',
  QUOTA_EXHAUSTED: 'Đã hết hạn mức hoặc vượt giới hạn tốc độ API. Vui lòng đợi một lúc rồi thử lại.',
  INVALID_ARGUMENT: 'Google không chấp nhận dữ liệu hoặc tham số yêu cầu. Vui lòng kiểm tra tài liệu đầu vào.',
  MODEL_NOT_FOUND: 'Model AI không còn khả dụng. Vui lòng kiểm tra model trong Cài đặt.',
  MODEL_OVERLOADED: 'Dịch vụ AI đang quá tải hoặc tạm thời không khả dụng. Vui lòng thử lại sau.',
  UNKNOWN: 'Không thể hoàn tất yêu cầu AI.',
};

export class GeminiRequestError extends Error {
  constructor(public kind: GeminiErrorKind, public status?: number) {
    super(kind + ': ' + messages[kind]);
    this.name = 'GeminiRequestError';
  }
}

export const classifyGeminiError = (error: unknown): GeminiErrorKind => {
  if (error instanceof GeminiRequestError) return error.kind;
  const value = error as any;
  const status = Number(value?.status || value?.code || value?.error?.code);
  const message = String(value?.message || value?.error?.message || error || '');
  // Explicit HTTP auth, quota and input errors take precedence over message text.
  if (status === 401) return 'API_KEY_INVALID';
  if (status === 403) return 'PERMISSION_DENIED';
  if (status === 429) return 'QUOTA_EXHAUSTED';
  if (/API_KEY_INVALID|API key not valid|API key expired/i.test(message)) return 'API_KEY_INVALID';
  if (status === 400) return 'INVALID_ARGUMENT';
  if (/PERMISSION_DENIED/i.test(message)) return 'PERMISSION_DENIED';
  if (/QUOTA_EXHAUSTED|RESOURCE_EXHAUSTED/i.test(message)) return 'QUOTA_EXHAUSTED';
  if (/INVALID_ARGUMENT/i.test(message)) return 'INVALID_ARGUMENT';
  if (status === 404 || /MODEL_NOT_FOUND|NOT_FOUND|no longer available/i.test(message)) return 'MODEL_NOT_FOUND';
  if ([500, 503, 504].includes(status) || value?.name === 'AbortError' ||
      /MODEL_OVERLOADED|UNAVAILABLE|INTERNAL|DEADLINE_EXCEEDED|overloaded|high demand|temporarily unavailable/i.test(message)) return 'MODEL_OVERLOADED';
  return 'UNKNOWN';
};

export const canFallbackGemini = (error: unknown): boolean =>
  ['MODEL_NOT_FOUND', 'MODEL_OVERLOADED'].includes(classifyGeminiError(error));

export const normalizeGeminiError = (error: unknown): Error => {
  const kind = classifyGeminiError(error);
  return kind === 'UNKNOWN' ? (error instanceof Error ? error : new Error(messages.UNKNOWN)) : new GeminiRequestError(kind);
};

export const geminiHttpError = (status: number, body: string): Error =>
  new GeminiRequestError(classifyGeminiError({ status, message: body }), status);
