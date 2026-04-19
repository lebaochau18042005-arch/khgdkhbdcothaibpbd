/**
 * ============================================
 * SKILL SỬ: AR Experience Configuration
 * Tổng hợp từ: EdCore-main (AR History), GeoLearn-AR-main
 * ============================================
 *
 * Cấu hình AR cho trải nghiệm lịch sử immersive.
 *
 * Technologies:
 *   - AR.js (Web AR)
 *   - A-Frame (3D framework)
 *   - WebXR API
 *   - EchoAR (cloud 3D management - từ GeoLearn-AR)
 */

const AR_CONFIG = {
  // AR.js settings
  arjs: {
    sourceType: 'webcam',
    debugUIEnabled: false,
    detectionMode: 'mono_and_matrix',
    matrixCodeType: '3x3',
    patternRatio: 0.50,
    maxDetectionRate: 60,
  },

  // A-Frame settings
  aframe: {
    embedded: true,
    arjs: 'sourceType: webcam; debugUIEnabled: false;',
    renderer: 'logarithmicDepthBuffer: true; antialias: true;',
  },

  // Default 3D model settings
  model: {
    scale: '0.5 0.5 0.5',
    rotation: '0 0 0',
    position: '0 0.5 0',
    animation: 'property: rotation; to: 0 360 0; dur: 10000; easing: linear; loop: true',
  },

  // Cloud 3D management (EchoAR-style)
  cloudAR: {
    apiUrl: process.env.AR_CLOUD_API_URL || '',
    apiKey: process.env.AR_CLOUD_API_KEY || '',
  },
};

// Mẫu AR scenes cho các sự kiện lịch sử
const AR_SCENE_TEMPLATES = {
  // Trận đánh
  battle: {
    environment: 'preset: forest; fog: 0.8;',
    lighting: 'type: ambient; color: #888;',
    models: ['soldiers', 'flags', 'weapons'],
    audio: 'battle-ambience.mp3',
    particles: { type: 'smoke', count: 100 },
  },

  // Kiến trúc / Di tích
  monument: {
    environment: 'preset: default; ground: flat;',
    lighting: 'type: directional; color: #FFF; intensity: 1.0;',
    models: ['building'],
    audio: null,
    info_panels: true,
  },

  // Nhân vật lịch sử
  figure: {
    environment: 'preset: default;',
    lighting: 'type: point; color: #FFF; intensity: 1.2;',
    models: ['character'],
    audio: 'narration.mp3',
    speech_bubble: true,
  },

  // Bản đồ 3D
  map3d: {
    environment: 'preset: default; ground: flat;',
    lighting: 'type: ambient; color: #CCC;',
    models: ['terrain', 'markers'],
    interactive: true,
  },
};

// Helper: Tạo A-Frame scene HTML cho sự kiện lịch sử
function generateARSceneHTML(event, template = 'monument') {
  const sceneConfig = AR_SCENE_TEMPLATES[template] || AR_SCENE_TEMPLATES.monument;

  return `
<!DOCTYPE html>
<html>
<head>
  <title>AR: ${event.title_vi}</title>
  <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
  <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
</head>
<body style="margin: 0; overflow: hidden;">
  <a-scene ${AR_CONFIG.aframe.arjs ? `arjs="${AR_CONFIG.aframe.arjs}"` : ''}
           renderer="${AR_CONFIG.aframe.renderer}"
           embedded>

    <!-- Marker-based AR -->
    <a-marker preset="hiro">
      <!-- 3D Model -->
      ${event.ar_model_url ? `
      <a-entity
        gltf-model="${event.ar_model_url}"
        scale="${AR_CONFIG.model.scale}"
        position="${AR_CONFIG.model.position}"
        animation="${AR_CONFIG.model.animation}">
      </a-entity>
      ` : `
      <a-box position="0 0.5 0" material="color: #4CC3D9;" scale="0.5 0.5 0.5"
             animation="property: rotation; to: 0 360 0; dur: 5000; loop: true">
      </a-box>
      `}

      <!-- Info Panel -->
      <a-entity position="0 1.5 0"
                text="value: ${event.title_vi}; align: center; width: 3; color: #FFF;"
                look-at="[camera]">
      </a-entity>
    </a-marker>

    <a-entity camera></a-entity>
  </a-scene>
</body>
</html>`;
}

module.exports = {
  AR_CONFIG,
  AR_SCENE_TEMPLATES,
  generateARSceneHTML,
};
