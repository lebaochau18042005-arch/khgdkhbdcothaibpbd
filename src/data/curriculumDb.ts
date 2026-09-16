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
import { getStoredCustomCurriculums } from '../utils/curriculumIngestion';

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
    "Vật lí": VatLy,
    "Địa lí": DiaLy,
    "Giáo dục công dân": GDKTPL,
    ...Others
};

export const getCurriculumBySubjectAndGrade = (subject: string, grade: string): any[] => {
    const cleanSub = (subject || "").trim();
    const cleanGrade = (grade || "").trim();

    // 1. Kiểm tra custom curriculum đã nạp
    try {
        const customDb = getStoredCustomCurriculums();
        if (customDb[cleanSub]?.[cleanGrade]?.length) {
            return customDb[cleanSub][cleanGrade];
        }
        // Thử tìm theo tên không dấu
        const matchedCustomKey = Object.keys(customDb).find(k => 
            k.toLowerCase() === cleanSub.toLowerCase()
        );
        if (matchedCustomKey && customDb[matchedCustomKey]?.[cleanGrade]?.length) {
            return customDb[matchedCustomKey][cleanGrade];
        }
    } catch (e) {
        console.error("Lỗi đọc custom curriculum", e);
    }

    // 2. Tìm trong CURRICULUM_DB chuẩn
    if (CURRICULUM_DB[cleanSub]?.[cleanGrade]) {
        return CURRICULUM_DB[cleanSub][cleanGrade];
    }

    const matchedKey = Object.keys(CURRICULUM_DB).find(k => 
        k.toLowerCase() === cleanSub.toLowerCase()
    );
    if (matchedKey && CURRICULUM_DB[matchedKey]?.[cleanGrade]) {
        return CURRICULUM_DB[matchedKey][cleanGrade];
    }

    return [];
};
