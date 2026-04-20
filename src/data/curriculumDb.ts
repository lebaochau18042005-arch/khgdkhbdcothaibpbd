import { ToanHoc } from './curriculum/toan';
import { NguVan } from './curriculum/nguVan';
import { VatLy } from './curriculum/vatLy';
import { HoaHoc } from './curriculum/hoaHoc';
import { SinhHoc } from './curriculum/sinhHoc';
import { LichSu } from './curriculum/lichSu';
import { DiaLy } from './curriculum/diaLy';
import { TiengAnh } from './curriculum/tiengAnh';
import { TinHoc } from './curriculum/tinHoc';
import { GDKTPL } from './curriculum/gdktpl';
import { CongNghe } from './curriculum/congNghe';
import { Others } from './curriculum/others';
import { KhoaHocTuNhien } from './curriculum/khtn';
import { LichSuDiaLy } from './curriculum/lichSuDiaLy';

export const CURRICULUM_DB: Record<string, Record<string, any[]>> = {
    "Toán học": ToanHoc,
    "Ngữ văn": NguVan,
    "Vật lý": VatLy,
    "Hóa học": HoaHoc,
    "Sinh học": SinhHoc,
    "Lịch sử": LichSu,
    "Địa lý": DiaLy,
    "Tiếng Anh": TiengAnh,
    "Tin học": TinHoc,
    "Giáo dục kinh tế và pháp luật": GDKTPL,
    "Công nghệ": CongNghe,
    "Khoa học tự nhiên": KhoaHocTuNhien,
    "Lịch sử và Địa lí": LichSuDiaLy,
    "Giáo dục công dân": GDKTPL,
    ...Others
};
