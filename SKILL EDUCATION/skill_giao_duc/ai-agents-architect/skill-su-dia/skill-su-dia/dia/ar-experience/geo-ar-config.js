/**
 * ============================================
 * SKILL ĐỊA: Geography AR Experience Configuration
 * Tổng hợp từ: GeoLearn-AR-main (EchoAR + Typeform)
 * ============================================
 *
 * Cấu hình AR cho trải nghiệm học địa lý.
 * Mô hình: Nhìn QR code → Hiện 3D object đặc trưng → Nhận diện địa điểm
 */

const GEO_AR_CONFIG = {
  // AR platform settings (EchoAR-compatible)
  platform: {
    apiUrl: process.env.GEO_AR_API_URL || '',
    apiKey: process.env.GEO_AR_API_KEY || '',
  },

  // QR Code generation
  qrCode: {
    size: 256,
    errorCorrectionLevel: 'M',
    format: 'png',
  },

  // Default 3D model settings
  modelDefaults: {
    scale: 0.01,
    rotation: { x: 0, y: 0, z: 0 },
    animation: 'rotate',
  },
};

// Mapping: Loại địa lý → 3D model đặc trưng
const GEO_AR_MODELS = {
  // Các mô hình 3D đại diện cho từng loại địa lý
  mountain: {
    description: 'Mô hình núi 3D',
    defaultColor: '#78716C',
    primitiveShape: 'cone',  // Fallback nếu không có model
  },
  river: {
    description: 'Mô hình dòng sông uốn lượn',
    defaultColor: '#3B82F6',
    primitiveShape: 'torus',
  },
  lake: {
    description: 'Mô hình hồ nước',
    defaultColor: '#0EA5E9',
    primitiveShape: 'cylinder',
  },
  island: {
    description: 'Mô hình đảo với cây cọ',
    defaultColor: '#10B981',
    primitiveShape: 'sphere',
  },
  city: {
    description: 'Mô hình tòa nhà thành phố',
    defaultColor: '#EF4444',
    primitiveShape: 'box',
  },
  country: {
    description: 'Mô hình lá cờ quốc gia',
    defaultColor: '#F59E0B',
    primitiveShape: 'plane',
  },
  volcano: {
    description: 'Mô hình núi lửa',
    defaultColor: '#DC2626',
    primitiveShape: 'cone',
  },
  desert: {
    description: 'Mô hình sa mạc cát',
    defaultColor: '#D97706',
    primitiveShape: 'plane',
  },
};

// Template: Learning flow kiểu GeoLearn-AR
const GEO_AR_LEARNING_FLOW = {
  steps: [
    {
      step: 1,
      title: 'Xem bản đồ',
      description: 'Xem vị trí địa điểm trên bản đồ tương tác',
      component: 'MapView',
    },
    {
      step: 2,
      title: 'Quét QR Code',
      description: 'Quét mã QR để xem mô hình 3D AR của địa điểm',
      component: 'QRScanner',
    },
    {
      step: 3,
      title: 'Khám phá AR',
      description: 'Quan sát mô hình 3D và đọc thông tin',
      component: 'ARViewer',
    },
    {
      step: 4,
      title: 'Trả lời quiz',
      description: 'Nhận diện địa điểm dựa trên mô hình AR',
      component: 'QuizView',
    },
    {
      step: 5,
      title: 'Chia sẻ',
      description: 'Chia sẻ kết quả với bạn bè',
      component: 'ShareView',
    },
  ],
};

module.exports = {
  GEO_AR_CONFIG,
  GEO_AR_MODELS,
  GEO_AR_LEARNING_FLOW,
};
