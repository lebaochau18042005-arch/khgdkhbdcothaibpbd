/** Shared allowlist: UI and every request must use Gemini 3 or newer. */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

export const GEMINI_MODELS = [
  { id: DEFAULT_GEMINI_MODEL, name: DEFAULT_GEMINI_MODEL, badge: 'Mặc định', desc: 'Tạo giáo án, kế hoạch giáo dục và phân tích tài liệu.' },
  { id: 'gemini-3.5-flash-lite', name: 'gemini-3.5-flash-lite', badge: 'Nhanh • Tiết kiệm', desc: 'Bóc tách tài liệu, tóm tắt và xử lý dữ liệu.' },
  { id: 'gemini-3.1-flash-lite', name: 'gemini-3.1-flash-lite', badge: 'Dự phòng', desc: 'Dự phòng cho các tác vụ nhẹ khi model ưu tiên không khả dụng.' },
  { id: 'gemini-3.1-pro-preview', name: 'gemini-3.1-pro-preview', badge: 'Suy luận sâu • Preview', desc: 'Phản biện và thẩm định kế hoạch phức tạp. Phiên bản thử nghiệm.' },
];

export const normalizeGeminiModel = (model?: string | null): string =>
  GEMINI_MODELS.some(candidate => candidate.id === model) ? model! : DEFAULT_GEMINI_MODEL;

export const getFallbackModels = (model?: string | null): string[] => {
  const preferred = normalizeGeminiModel(model);
  return [preferred, ...GEMINI_MODELS.map(candidate => candidate.id).filter(id => id !== preferred)];
};

export const getSavedGeminiModel = (): string => {
  const saved = localStorage.getItem('GEMINI_MODEL');
  const model = normalizeGeminiModel(saved);
  if (saved !== model) localStorage.setItem('GEMINI_MODEL', model);
  return model;
};
/** Return only supported app models, checking every page of Google's catalog. */
export const checkGeminiModelAvailability = async (apiKey: string): Promise<string[]> => {
  const available = new Set<string>();
  const seenPages = new Set<string>();
  let pageToken = '';
  do {
    if (seenPages.has(pageToken)) throw new Error('Google trả về trang danh sách model bị lặp.');
    seenPages.add(pageToken);
    const query = new URLSearchParams({ pageSize: '1000' });
    if (pageToken) query.set('pageToken', pageToken);
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?' + query, {
      headers: { 'x-goog-api-key': apiKey.trim() },
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'HTTP ' + response.status);
    for (const model of data.models || []) {
      if (typeof model.name === 'string' && model.supportedGenerationMethods?.includes('generateContent')) {
        available.add(model.name.replace(/^models\//, ''));
      }
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return GEMINI_MODELS.map(model => model.id).filter(id => available.has(id));
};
