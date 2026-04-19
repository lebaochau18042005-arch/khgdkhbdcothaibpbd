/**
 * ============================================
 * SKILL ĐỊA: GIS Tools & Geospatial Utilities
 * Tổng hợp từ: OrbisGIS-master, Leafmap-master
 * ============================================
 *
 * Các công cụ GIS cho phân tích và hiển thị dữ liệu không gian địa lý.
 *
 * Hỗ trợ:
 *   - PostGIS queries (từ OrbisGIS)
 *   - GeoJSON processing
 *   - Spatial calculations
 *   - Leafmap Python integration
 */

// ========== SPATIAL CALCULATIONS ==========

const GISTools = {
  /**
   * Tính khoảng cách giữa 2 điểm (Haversine formula)
   * @param {number} lat1, lng1 - Điểm 1
   * @param {number} lat2, lng2 - Điểm 2
   * @returns {number} Khoảng cách (km)
   */
  haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  /**
   * Kiểm tra điểm có nằm trong polygon không (Ray casting)
   */
  pointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  },

  /**
   * Tính diện tích polygon (Shoelace formula) - đơn vị km²
   */
  polygonArea(coordinates) {
    let area = 0;
    const n = coordinates.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += coordinates[i][0] * coordinates[j][1];
      area -= coordinates[j][0] * coordinates[i][1];
    }
    return Math.abs(area / 2) * 111.32 * 111.32;  // Approximate km²
  },

  /**
   * Tính bounding box cho tập hợp điểm
   */
  boundingBox(points) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    for (const [lat, lng] of points) {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }
    return { minLat, maxLat, minLng, maxLng };
  },

  /**
   * Tính trung tâm (centroid) của tập hợp điểm
   */
  centroid(points) {
    const n = points.length;
    const sumLat = points.reduce((s, p) => s + p[0], 0);
    const sumLng = points.reduce((s, p) => s + p[1], 0);
    return [sumLat / n, sumLng / n];
  },
};

// ========== POSTGIS QUERY HELPERS (từ OrbisGIS) ==========

const PostGISQueries = {
  /**
   * Tìm các địa điểm gần một tọa độ
   */
  findNearby(lat, lng, radiusKm, type = null) {
    let query = `
      SELECT *, ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
      ) / 1000 AS distance_km
      FROM geo_places
      WHERE ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        $3 * 1000
      )
    `;
    const params = [lat, lng, radiusKm];

    if (type) {
      query += ' AND type = $4';
      params.push(type);
    }

    query += ' ORDER BY distance_km ASC';
    return { query, params };
  },

  /**
   * Tìm các địa điểm trong bounding box
   */
  findInBBox(minLat, minLng, maxLat, maxLng) {
    return {
      query: `
        SELECT * FROM geo_places
        WHERE ST_Within(
          geom,
          ST_MakeEnvelope($1, $2, $3, $4, 4326)
        )
      `,
      params: [minLng, minLat, maxLng, maxLat],
    };
  },

  /**
   * Tìm places thuộc một region (polygon)
   */
  findInRegion(regionGeojson) {
    return {
      query: `
        SELECT * FROM geo_places
        WHERE ST_Within(
          geom,
          ST_GeomFromGeoJSON($1)
        )
      `,
      params: [JSON.stringify(regionGeojson)],
    };
  },

  /**
   * Tính khoảng cách giữa 2 place
   */
  distanceBetween(placeId1, placeId2) {
    return {
      query: `
        SELECT
          ST_Distance(a.geom::geography, b.geom::geography) / 1000 AS distance_km
        FROM geo_places a, geo_places b
        WHERE a.id = $1 AND b.id = $2
      `,
      params: [placeId1, placeId2],
    };
  },
};

// ========== GEOJSON HELPERS ==========

const GeoJSONHelper = {
  /**
   * Tạo GeoJSON Feature từ place data
   */
  placeToFeature(place) {
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [place.longitude, place.latitude],
      },
      properties: {
        id: place.id,
        name: place.name_vi,
        name_en: place.name_en,
        type: place.type,
        description: place.description_vi,
        area_km2: place.area_km2,
        population: place.population,
      },
    };
  },

  /**
   * Tạo FeatureCollection từ mảng places
   */
  placesToCollection(places) {
    return {
      type: 'FeatureCollection',
      features: places.map(p => this.placeToFeature(p)),
    };
  },

  /**
   * Tạo GeoJSON cho marker cluster
   */
  createCluster(places, clusterRadius = 50) {
    // Simple grid-based clustering
    const clusters = new Map();
    const gridSize = clusterRadius / 111;  // Approximate degrees

    for (const place of places) {
      const gridX = Math.floor(place.longitude / gridSize);
      const gridY = Math.floor(place.latitude / gridSize);
      const key = `${gridX},${gridY}`;

      if (!clusters.has(key)) {
        clusters.set(key, { places: [], lat: 0, lng: 0 });
      }
      const cluster = clusters.get(key);
      cluster.places.push(place);
      cluster.lat += place.latitude;
      cluster.lng += place.longitude;
    }

    return {
      type: 'FeatureCollection',
      features: Array.from(clusters.values()).map(c => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [c.lng / c.places.length, c.lat / c.places.length],
        },
        properties: {
          cluster: true,
          point_count: c.places.length,
          names: c.places.map(p => p.name_vi),
        },
      })),
    };
  },
};

module.exports = {
  GISTools,
  PostGISQueries,
  GeoJSONHelper,
};
