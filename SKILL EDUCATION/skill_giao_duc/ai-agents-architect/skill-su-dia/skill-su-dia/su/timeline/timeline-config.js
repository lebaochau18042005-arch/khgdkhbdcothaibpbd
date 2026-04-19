/**
 * ============================================
 * SKILL SỬ: Timeline Configuration
 * Tổng hợp từ: vis-timeline-master
 * ============================================
 *
 * Cấu hình vis-timeline cho hiển thị sự kiện lịch sử Việt Nam.
 * Sử dụng vis-timeline library để tạo timeline tương tác.
 *
 * Dependencies:
 *   - vis-timeline (https://github.com/visjs/vis-timeline)
 *   - vis-data
 *   - moment.js
 */

// Cấu hình mặc định cho Timeline lịch sử
const TIMELINE_CONFIG = {
  // Localization tiếng Việt
  locale: 'vi',
  locales: {
    vi: {
      current: 'hiện tại',
      time: 'thời gian',
      deleteSelected: 'Xóa mục đã chọn',
    },
  },

  // Thời gian hiển thị mặc định
  start: new Date('0001-01-01'),
  end: new Date(),
  min: new Date('-002879-01-01'),  // Thời Hồng Bàng
  max: new Date('2030-01-01'),

  // Zoom
  zoomMin: 1000 * 60 * 60 * 24 * 365,      // 1 năm minimum
  zoomMax: 1000 * 60 * 60 * 24 * 365 * 5000, // 5000 năm maximum

  // Interaction
  moveable: true,
  zoomable: true,
  selectable: true,
  multiselect: false,

  // Stack items
  stack: true,
  stackSubgroups: true,

  // Styling
  margin: {
    axis: 20,
    item: { horizontal: 10, vertical: 5 },
  },

  // Orientation
  orientation: { axis: 'bottom', item: 'top' },

  // Tooltip
  tooltip: {
    followMouse: true,
    overflowMethod: 'cap',
  },

  // Time axis format
  format: {
    minorLabels: {
      year: 'YYYY',
      month: 'MM/YYYY',
      day: 'DD/MM/YYYY',
    },
    majorLabels: {
      year: 'Năm YYYY',
      month: 'Tháng MM/YYYY',
      day: 'DD/MM/YYYY',
    },
  },
};

// Cấu hình nhóm timeline theo thời kỳ lịch sử
const TIMELINE_GROUPS = [
  {
    id: 'co-dai',
    content: '<b>Thời kỳ Cổ đại</b>',
    style: 'color: #8B4513; background: #FAEBD7;',
    nestedGroups: ['hong-bang', 'an-duong-vuong', 'bac-thuoc'],
  },
  {
    id: 'phong-kien',
    content: '<b>Thời kỳ Phong kiến</b>',
    style: 'color: #4169E1; background: #E6E6FA;',
    nestedGroups: ['nha-ly', 'nha-tran', 'nha-hau-le', 'nha-nguyen'],
  },
  {
    id: 'hien-dai',
    content: '<b>Thời kỳ Hiện đại</b>',
    style: 'color: #228B22; background: #F0FFF0;',
    nestedGroups: ['chong-phap', 'chong-my', 'doi-moi'],
  },
];

// Helper: Chuyển đổi dữ liệu từ DB sang vis-timeline format
function eventToTimelineItem(event) {
  return {
    id: event.id,
    content: event.title_vi,
    title: event.summary_vi,  // Tooltip
    start: event.start_date,
    end: event.end_date || undefined,
    type: event.timeline_type || 'point',
    group: event.timeline_group,
    className: event.timeline_class || `importance-${event.importance}`,
    style: event.timeline_style || undefined,
  };
}

// Helper: Chuyển đổi nhân vật lịch sử sang timeline (lifespan)
function figureToTimelineItem(figure) {
  return {
    id: `figure-${figure.id}`,
    content: figure.name_vi,
    title: figure.biography_vi,
    start: figure.birth_year ? new Date(`${figure.birth_year}-01-01`) : undefined,
    end: figure.death_year ? new Date(`${figure.death_year}-12-31`) : undefined,
    type: 'range',
    group: 'nhan-vat',
    className: 'timeline-figure',
  };
}

// CSS classes cho importance levels
const IMPORTANCE_STYLES = `
  .importance-10 { background-color: #DC2626; color: white; font-weight: bold; border-color: #991B1B; }
  .importance-9  { background-color: #EA580C; color: white; font-weight: bold; }
  .importance-8  { background-color: #D97706; color: white; }
  .importance-7  { background-color: #CA8A04; color: white; }
  .importance-6  { background-color: #65A30D; }
  .importance-5  { background-color: #0891B2; color: white; }
  .importance-4  { background-color: #6366F1; color: white; }
  .importance-3  { background-color: #9CA3AF; }
  .importance-2  { background-color: #D1D5DB; }
  .importance-1  { background-color: #E5E7EB; }

  .timeline-figure {
    background-color: #7C3AED;
    color: white;
    border-radius: 8px;
    border-color: #5B21B6;
  }
`;

module.exports = {
  TIMELINE_CONFIG,
  TIMELINE_GROUPS,
  IMPORTANCE_STYLES,
  eventToTimelineItem,
  figureToTimelineItem,
};
