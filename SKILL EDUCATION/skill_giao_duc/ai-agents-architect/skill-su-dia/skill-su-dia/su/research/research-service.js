/**
 * ============================================
 * SKILL SỬ: Historical Research Service
 * Tổng hợp từ: history-main (Valyu DeepResearch)
 * ============================================
 *
 * Service gọi AI research cho các địa điểm / sự kiện lịch sử.
 * Dựa trên mô hình của history-main project (3D Globe + DeepResearch).
 *
 * Có thể tích hợp với:
 *   - Valyu DeepResearch API
 *   - OpenAI API
 *   - Hoặc bất kỳ AI research API nào
 */

class HistoryResearchService {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || process.env.RESEARCH_API_URL;
    this.apiKey = config.apiKey || process.env.RESEARCH_API_KEY;
    this.timeout = config.timeout || 60000;
  }

  /**
   * Nghiên cứu lịch sử cho một địa điểm
   * @param {Object} location - {name, lat, lng}
   * @returns {Object} - {content, sources, images}
   */
  async researchLocation(location) {
    const prompt = this._buildLocationPrompt(location);
    return await this._executeResearch(prompt, location);
  }

  /**
   * Nghiên cứu chi tiết cho một sự kiện lịch sử
   * @param {Object} event - Historical event object
   * @returns {Object} - {content, sources, timeline_context}
   */
  async researchEvent(event) {
    const prompt = this._buildEventPrompt(event);
    return await this._executeResearch(prompt, {
      name: event.title_vi,
      lat: event.location_lat,
      lng: event.location_lng,
    });
  }

  /**
   * Nghiên cứu nhân vật lịch sử
   * @param {Object} figure - Historical figure object
   * @returns {Object} - {biography, achievements, context, sources}
   */
  async researchFigure(figure) {
    const prompt = this._buildFigurePrompt(figure);
    return await this._executeResearch(prompt, { name: figure.name_vi });
  }

  // ========== Private Methods ==========

  _buildLocationPrompt(location) {
    return `Nghiên cứu lịch sử toàn diện về địa điểm "${location.name}" ` +
      `(tọa độ: ${location.lat}, ${location.lng}). ` +
      `Bao gồm: lịch sử hình thành, các sự kiện quan trọng, nhân vật liên quan, ` +
      `ý nghĩa văn hóa, và tình trạng hiện tại. ` +
      `Viết bằng tiếng Việt, trích dẫn nguồn đầy đủ.`;
  }

  _buildEventPrompt(event) {
    return `Nghiên cứu chi tiết về sự kiện lịch sử "${event.title_vi}" ` +
      `(${event.start_date}${event.end_date ? ' - ' + event.end_date : ''}). ` +
      `Bao gồm: bối cảnh, diễn biến, nhân vật chính, kết quả, ý nghĩa lịch sử, ` +
      `và tác động đến hiện tại. ` +
      `Viết bằng tiếng Việt, trích dẫn nguồn đầy đủ.`;
  }

  _buildFigurePrompt(figure) {
    return `Nghiên cứu tiểu sử chi tiết về "${figure.name_vi}" ` +
      `(${figure.birth_year || '?'} - ${figure.death_year || '?'}). ` +
      `Bao gồm: tiểu sử, sự nghiệp, thành tựu, đóng góp cho lịch sử, ` +
      `các sự kiện liên quan, và di sản để lại. ` +
      `Viết bằng tiếng Việt, trích dẫn nguồn đầy đủ.`;
  }

  async _executeResearch(prompt, metadata) {
    // Template method - override cho từng API provider
    // Default: trả về structure mẫu
    return {
      status: 'completed',
      content: '',
      sources: [],
      images: [],
      metadata: {
        ...metadata,
        researched_at: new Date().toISOString(),
        prompt,
      },
    };
  }
}

/**
 * Valyu DeepResearch Provider (từ history-main)
 */
class ValyuResearchProvider extends HistoryResearchService {
  async _executeResearch(prompt, metadata) {
    const response = await fetch(`${this.apiUrl}/v1/deepsearch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query: prompt,
        search_type: 'all',
        max_num_results: 20,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`Research API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      status: 'completed',
      content: data.result || '',
      sources: (data.sources || []).map(s => ({
        title: s.title,
        url: s.url,
        snippet: s.snippet,
        type: s.source_type,
      })),
      images: metadata.images || [],
      metadata: {
        ...metadata,
        research_id: data.id,
        researched_at: new Date().toISOString(),
      },
    };
  }
}

module.exports = {
  HistoryResearchService,
  ValyuResearchProvider,
};
