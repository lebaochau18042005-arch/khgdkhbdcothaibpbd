/**
 * ============================================
 * SKILL ĐỊA: Interactive Map Configuration
 * Tổng hợp từ: Geography-master (Leaflet/Kartograph), Leafmap-master, History (Mapbox)
 * ============================================
 *
 * Cấu hình bản đồ tương tác cho học địa lý.
 *
 * Supports:
 *   - Leaflet (web map - từ Geography project)
 *   - Mapbox GL JS (3D globe - từ History project)
 *   - Leafmap (Python geospatial - từ Leafmap project)
 */

// ========== LEAFLET CONFIG ==========
const LEAFLET_CONFIG = {
  // Default view: Việt Nam
  center: [16.0583, 105.8542],
  zoom: 6,
  minZoom: 2,
  maxZoom: 18,

  // Tile layers
  tileLayers: {
    standard: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri',
      maxZoom: 18,
    },
    terrain: {
      url: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
      attribution: '&copy; Stamen Design',
      maxZoom: 18,
    },
    topo: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenTopoMap',
      maxZoom: 17,
    },
  },

  // Map interactions
  options: {
    zoomControl: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    dragging: true,
    touchZoom: true,
  },
};

// ========== MAPBOX GL CONFIG (3D Globe) ==========
const MAPBOX_CONFIG = {
  accessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  center: [105.8542, 16.0583],  // [lng, lat]
  zoom: 5,
  pitch: 45,         // 3D tilt
  bearing: 0,
  projection: 'globe',  // 3D globe view

  // Globe atmosphere
  atmosphere: {
    color: 'rgb(186, 210, 235)',
    highColor: 'rgb(36, 92, 223)',
    horizonBlend: 0.02,
    spaceColor: 'rgb(11, 11, 25)',
    starIntensity: 0.6,
  },

  // Fog for distance effect
  fog: {
    color: 'rgb(186, 210, 235)',
    highColor: 'rgb(36, 92, 223)',
    horizonBlend: 0.02,
    starIntensity: 0.6,
  },
};

// ========== LEAFMAP (Python) CONFIG ==========
const LEAFMAP_CONFIG = {
  // Basemaps cho Leafmap
  basemaps: [
    'OpenStreetMap',
    'Esri.WorldImagery',
    'Esri.WorldTopoMap',
    'CartoDB.DarkMatter',
    'Stamen.Terrain',
  ],

  // Default settings
  defaults: {
    center: [16.0583, 105.8542],
    zoom: 6,
    height: '600px',
    width: '100%',
  },

  // Python code templates
  codeTemplates: {
    basicMap: `
import leafmap

m = leafmap.Map(center=[16.0583, 105.8542], zoom=6)
m.add_basemap("OpenStreetMap")
m`,

    addGeoJSON: `
import leafmap

m = leafmap.Map(center=[16.0583, 105.8542], zoom=6)
m.add_geojson("vietnam_provinces.geojson",
              layer_name="Tỉnh thành Việt Nam",
              style={"color": "blue", "weight": 2, "fillOpacity": 0.1})
m`,

    splitMap: `
import leafmap

m = leafmap.Map()
m.split_map(
    left_layer="OpenStreetMap",
    right_layer="Esri.WorldImagery"
)
m`,
  },
};

// ========== MAP CONTEXTS cho Geography Practice ==========
const MAP_CONTEXTS = {
  // Bản đồ practice (từ geography project SVG maps)
  vietnam: {
    name: 'Việt Nam',
    center: [16.0583, 105.8542],
    zoom: 6,
    bounds: [[8.18, 102.14], [23.39, 109.46]],
    layers: ['provinces', 'cities', 'rivers', 'mountains'],
  },
  southeast_asia: {
    name: 'Đông Nam Á',
    center: [5.0, 110.0],
    zoom: 4,
    bounds: [[-11, 92], [28, 141]],
    layers: ['countries', 'capitals', 'seas'],
  },
  world: {
    name: 'Thế giới',
    center: [20.0, 0.0],
    zoom: 2,
    layers: ['continents', 'countries', 'oceans'],
  },
};

// ========== HELPERS ==========

// Tạo marker style cho địa điểm theo loại
function getMarkerStyle(placeType) {
  const styles = {
    city: { color: '#EF4444', icon: 'city', size: 8 },
    capital: { color: '#DC2626', icon: 'star', size: 10 },
    river: { color: '#3B82F6', icon: 'water', size: 6 },
    mountain: { color: '#78716C', icon: 'mountain', size: 8 },
    lake: { color: '#0EA5E9', icon: 'water', size: 7 },
    sea: { color: '#1E40AF', icon: 'waves', size: 9 },
    island: { color: '#10B981', icon: 'island', size: 7 },
    country: { color: '#F59E0B', icon: 'flag', size: 9 },
  };
  return styles[placeType] || { color: '#6B7280', icon: 'pin', size: 6 };
}

// Tạo popup content cho địa điểm
function createPopupContent(place) {
  return `
    <div class="geo-popup">
      <h3>${place.name_vi}</h3>
      ${place.name_en ? `<p class="en-name">${place.name_en}</p>` : ''}
      <p>${place.description_vi || ''}</p>
      ${place.area_km2 ? `<p>Diện tích: ${place.area_km2.toLocaleString('vi')} km²</p>` : ''}
      ${place.population ? `<p>Dân số: ${place.population.toLocaleString('vi')}</p>` : ''}
      ${place.capital ? `<p>Thủ đô/Tỉnh lỵ: ${place.capital}</p>` : ''}
      ${place.elevation_m ? `<p>Độ cao: ${place.elevation_m.toLocaleString('vi')} m</p>` : ''}
    </div>
  `;
}

module.exports = {
  LEAFLET_CONFIG,
  MAPBOX_CONFIG,
  LEAFMAP_CONFIG,
  MAP_CONTEXTS,
  getMarkerStyle,
  createPopupContent,
};
