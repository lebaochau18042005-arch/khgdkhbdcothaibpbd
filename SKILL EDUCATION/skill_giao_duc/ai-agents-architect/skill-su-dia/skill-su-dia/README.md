# Skill Sử-Địa

Bộ skill giáo dục **Lịch sử** và **Địa lý** Việt Nam, tổng hợp từ 7 repository mã nguồn mở.

## Cấu trúc thư mục

```
skill-su-dia/
├── database/                          # Database schemas & dữ liệu mẫu
│   ├── schemas/
│   │   ├── 001_users.sql              # Users, auth, rate limits
│   │   ├── 002_history.sql            # Thời kỳ, sự kiện, nhân vật lịch sử
│   │   ├── 003_geography.sql          # Danh mục, địa điểm, flashcards, bản đồ
│   │   └── 004_learning.sql           # Quiz, adaptive learning, gamification
│   ├── seeds/
│   │   ├── 001_authorities.sql        # Roles mặc định
│   │   ├── 002_historical_periods.sql # 12 thời kỳ lịch sử VN
│   │   ├── 003_historical_events.sql  # 11 sự kiện tiêu biểu
│   │   ├── 004_historical_figures.sql # 9 nhân vật lịch sử
│   │   ├── 005_geo_categories.sql     # Danh mục địa lý (châu lục, quốc gia, vùng miền)
│   │   ├── 006_geo_places.sql         # 15 địa điểm tiêu biểu VN
│   │   ├── 007_geo_flashcards.sql     # 10 flashcards mẫu
│   │   └── 008_badges.sql             # 13 huy hiệu gamification
│   └── migrations/                    # (dành cho migration tools)
│
├── su/                                # MODULE LỊCH SỬ
│   ├── timeline/
│   │   └── timeline-config.js         # Cấu hình vis-timeline (groups, styles, helpers)
│   ├── research/
│   │   └── research-service.js        # AI research service (Valyu DeepResearch)
│   ├── ar-experience/
│   │   └── ar-config.js               # AR config (A-Frame, AR.js, scene templates)
│   ├── quiz/
│   │   └── history-quiz-engine.js     # Quiz engine: timeline_order, map_click, IRT
│   └── data/
│       └── vietnam-history-data.json  # Dữ liệu lịch sử VN (6 thời kỳ, quiz templates)
│
├── dia/                               # MODULE ĐỊA LÝ
│   ├── map/
│   │   └── map-config.js              # Cấu hình Leaflet, Mapbox GL, Leafmap
│   ├── adaptive-learning/
│   │   └── adaptive-engine.js         # IRT item selection, FSRS scheduling, option selection
│   ├── gis/
│   │   └── gis-tools.js              # GIS utils, PostGIS queries, GeoJSON helpers
│   ├── ar-experience/
│   │   └── geo-ar-config.js           # AR cho địa lý (QR + 3D models)
│   ├── quiz/
│   │   └── geography-quiz-engine.js   # Quiz: map_click, flashcard, AR identify
│   └── data/
│       └── vietnam-geography-data.json # Dữ liệu địa lý VN (63 tỉnh, sông, núi, UNESCO)
│
├── shared/                            # MODULES DÙNG CHUNG
│   ├── utils/
│   │   └── fsrs.js                    # FSRS-4.5 spaced repetition algorithm
│   ├── auth/
│   │   └── auth-service.js            # Authentication & learning profile
│   └── components/                    # (dành cho UI components)
│
├── skill-config.json                  # Cấu hình tổng thể skill
└── README.md                          # File này
```

## Nguồn tổng hợp

| Repository | Sử dụng cho | Thành phần chính |
|---|---|---|
| **history-main** | 3D Globe, AI Research | `su/research/`, database schemas |
| **EdCore-main** | AR Experience, Auth, Gamification | `su/ar-experience/`, `shared/auth/`, badges |
| **geography-master** | Adaptive Learning, Flashcards | `dia/adaptive-learning/`, flashcards, A/B testing |
| **vis-timeline-master** | Timeline Visualization | `su/timeline/` |
| **leafmap-master** | Map Config, Basemaps | `dia/map/` |
| **orbisgis-master** | GIS Tools, PostGIS | `dia/gis/` |
| **GeoLearn-AR-main** | AR Geography | `dia/ar-experience/` |

## Database

**PostgreSQL + PostGIS** với 4 schema files:

- **001_users.sql** - Users, authorities, rate limits
- **002_history.sql** - Thời kỳ, sự kiện, nhân vật, timeline groups
- **003_geography.sql** - Categories, places, flashcards, map contexts, mnemonics
- **004_learning.sql** - Quiz sets, questions, sessions, answers, knowledge, XP, badges, A/B tests

### Khởi tạo database

```bash
# Tạo database
createdb skill_su_dia

# Bật PostGIS
psql skill_su_dia -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql skill_su_dia -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# Chạy schemas
for f in database/schemas/*.sql; do psql skill_su_dia -f "$f"; done

# Chạy seeds
for f in database/seeds/*.sql; do psql skill_su_dia -f "$f"; done
```

## Tính năng chính

### Lịch sử (Sử)
- **Timeline tương tác** - Hiển thị sự kiện theo dòng thời gian (vis-timeline)
- **Bản đồ 3D** - Click vào địa điểm xem lịch sử (Mapbox Globe)
- **AI Research** - Nghiên cứu lịch sử tự động bằng AI
- **AR Experience** - Trải nghiệm lịch sử qua AR (A-Frame + AR.js)
- **Quiz thông minh** - Sắp xếp timeline, nhận diện trên bản đồ

### Địa lý (Địa)
- **Bản đồ tương tác** - Leaflet + Mapbox GL JS + Leafmap (Python)
- **Practice bản đồ** - Nhận diện quốc gia, tỉnh thành trên bản đồ (kiểu slepemapy.cz)
- **Adaptive learning** - IRT model tự điều chỉnh độ khó theo năng lực
- **Flashcards** - Hệ thống flashcard với FSRS spaced repetition
- **GIS tools** - PostGIS queries, spatial calculations, GeoJSON
- **AR Geography** - Nhận diện địa điểm qua QR + 3D models

### Dùng chung
- **FSRS Algorithm** - Spaced repetition cho cả Sử và Địa
- **Gamification** - XP, levels, streaks, 13 huy hiệu
- **Authentication** - Multi-provider auth (Supabase, OAuth2, local)

## Biến môi trường

```env
# Bắt buộc
DATABASE_URL=postgresql://user:pass@localhost:5432/skill_su_dia
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.xxx

# Tùy chọn
RESEARCH_API_URL=https://api.valyu.network
RESEARCH_API_KEY=xxx
AR_CLOUD_API_URL=xxx
AR_CLOUD_API_KEY=xxx
AUTH_MODE=local  # local | supabase | oauth2
```

## Tech Stack đề xuất

| Layer | Công nghệ |
|---|---|
| Frontend | React/Next.js, Leaflet, Mapbox GL JS, vis-timeline, AR.js |
| Backend | Node.js/Express hoặc Django |
| Database | PostgreSQL + PostGIS |
| AI/ML | Valyu DeepResearch, IRT, FSRS |
| AR/VR | A-Frame, AR.js, WebXR |
