import type { LessonMeta, WorkbookField } from "./course";

/**
 * VABIX · Quản lý cấp trung thực chiến — partner course for Công ty Cổ phần Bê tông Ly tâm Thủ Đức 1.
 * Each lesson is a class workshop on a shared class board (convex/classBoard.ts): groups work together,
 * the instructor sees the whole class. To add a lesson: add it here and in convex/qlctCourse.ts, add its
 * source file, then run `npx convex run seed:addCourseQlct`.
 */
export const QLCT_COURSE = {
  slug: "vabix-quan-ly-cap-trung",
  code: "QLCT",
  title: "QUẢN LÝ CẤP TRUNG THỰC CHIẾN",
  tagline: "VABIX đồng hành cùng đội ngũ quản lý cấp trung Công ty Cổ phần Bê tông Ly tâm Thủ Đức 1",
  partner: "Công ty Cổ phần Bê tông Ly tâm Thủ Đức 1",
  partnerLogo: "/brand/partners/btlt-thu-duc-1.png",
  footer: "LÃNH ĐẠO TỈNH THỨC & KIẾN TẠO",
  cohortName: "Bê tông Ly tâm Thủ Đức 1 · Lớp 01",
  mapLede: {
    vi: "Chương trình quản lý cấp trung thực chiến theo APPLIER. Mỗi buổi là một thao trường nhóm: tự soi, đối chiếu mô thức, thực hành và pitching, góp góc nhìn, cải tiến, đúc kết và cam kết hành động.",
    en: "A hands-on middle-management programme built on APPLIER. Each session is a group workshop: self-reflection, paradigms, practice and pitching, peer lenses, improvement, lessons learned and a commitment to act.",
  },
} as const;

type QlctLesson = LessonMeta & { titleEn: string; summaryEn: string; titleUpper: string; titleUpperEn: string; source: string };

export const QLCT_LESSONS: QlctLesson[] = [
  {
    number: 1,
    code: "01",
    title: "Phẩm chất lãnh đạo & Trí tuệ kinh doanh",
    titleEn: "Leadership Character & Business Acumen",
    titleUpper: "PHẨM CHẤT LÃNH ĐẠO & TRÍ TUỆ KINH DOANH",
    titleUpperEn: "LEADERSHIP CHARACTER & BUSINESS ACUMEN",
    framework: "NHÂN · ĐẠO · CHÍ · TẦM",
    summary: "Tự soi bốn miền phẩm chất lãnh đạo và năm góc nhìn Business Acumen; thực hành nhóm, pitching, góp góc nhìn, chốt V2 và cam kết 90 ngày.",
    summaryEn: "Reflect on four domains of leadership character and five Business Acumen lenses; group practice, pitching, peer lenses, a final V2 and a 90-day commitment.",
    group: "APPLIER",
    hasReport: false,
    storageKey: "vabix-qlct-buoi01-lanh-dao-acumen-v1",
    schemaVersion: "1",
    contentVersion: "2026.10",
    source: "source/vabix-qlct/buoi01/index.html",
  },
  {
    number: 2,
    code: "02",
    title: "Quản trị con người & Kiến tạo đội ngũ",
    titleEn: "People Management & Team Building",
    titleUpper: "QUẢN TRỊ CON NGƯỜI & KIẾN TẠO ĐỘI NGŨ",
    titleUpperEn: "PEOPLE MANAGEMENT & TEAM BUILDING",
    framework: "MÂM · HƠI · VỎ · GAI",
    summary: "Bánh xe Nhân lực: Mâm COD, Hơi CRISS, Vỏ WSC, Gai MAPY. Bốn nhóm thực hành bốn cấu kiện, pitching, góp góc nhìn, chốt V2 và cam kết 90 ngày.",
    summaryEn: "The People Wheel: Rim COD, Air CRISS, Casing WSC, Tread MAPY. Four groups practise four components, pitch, add peer lenses, settle V2 and commit for 90 days.",
    group: "APPLIER",
    hasReport: false,
    storageKey: "vabix-qlct-buoi02-nhan-luc-v1",
    schemaVersion: "1",
    contentVersion: "2026.10",
    source: "source/vabix-qlct/buoi02/index.html",
  },
];

/** What a learner's own record of each board lesson holds (mirrored from the board on every personal save). */
const PERSONAL_01: [string, string][] = [
  ["group", "Nhóm"],
  ["extract.trait", "Phẩm chất suy ngẫm nhiều nhất"],
  ["extract.p1", "Bài học Paradigm 01"],
  ["extract.behavior", "Hành vi nhận diện"],
  ["extract.lens", "Góc nhìn Business Acumen dễ bỏ sót"],
  ["extract.p2", "Bài học Paradigm 02"],
  ["extract.integrated", "Bài học tích hợp"],
  ["extract.before", "Trước đây tôi thường nghĩ"],
  ["extract.after", "Sau buổi học tôi nhận ra"],
  ["extract.sentence", "Câu mang theo"],
  ["resolve.trait", "Phẩm chất ưu tiên"],
  ["resolve.lens", "Business Acumen ưu tiên"],
  ["resolve.action", "Hành động 90 ngày"],
  ["resolve.d30", "30 ngày"],
  ["resolve.d60", "60 ngày"],
  ["resolve.d90", "90 ngày"],
  ["resolve.evidence", "Bằng chứng hoàn thành"],
  ["resolve.support", "Hỗ trợ"],
  ["resolve.barrier", "Rủi ro & cách xử lý"],
  ["resolve.commitment", "Câu cam kết"],
];

const PERSONAL_02: [string, string][] = [
  ["group", "Nhóm / cấu kiện"],
  ["vote", "Lựa chọn ở Activate"],
  ["extract.wheel", "Bài học lớn nhất về Bánh xe Nhân lực"],
  ["extract.rim", "Bài học từ Mâm – COD"],
  ["extract.air", "Bài học từ Hơi – CRISS"],
  ["extract.casing", "Bài học từ Vỏ – WSC"],
  ["extract.tread", "Bài học từ Gai – MAPY"],
  ["extract.integrated", "Bài học tích hợp"],
  ["extract.before", "Trước đây tôi thường nghĩ"],
  ["extract.after", "Sau buổi học tôi nhận ra"],
  ["extract.sentence", "Câu ghi nhớ"],
  ["resolve.focus", "Trọng tâm Bánh xe Nhân lực"],
  ["resolve.action", "Hành động 90 ngày"],
  ["resolve.d30", "30 ngày"],
  ["resolve.d60", "60 ngày"],
  ["resolve.d90", "90 ngày"],
  ["resolve.evidence", "Bằng chứng hoàn thành"],
  ["resolve.support", "Hỗ trợ"],
  ["resolve.barrier", "Rủi ro & cách xử lý"],
];

const PERSONAL: Record<number, [string, string][]> = { 1: PERSONAL_01, 2: PERSONAL_02 };

export function qlctLesson(number: number) {
  return QLCT_LESSONS.find((lesson) => lesson.number === number);
}

export function qlctFields(number: number): WorkbookField[] {
  return qlctLesson(number) ? (PERSONAL[number] ?? []).map(([path, label]) => ({ path, label })) : [];
}

export function isQlctStorageKey(storageKey: string | undefined) {
  return Boolean(storageKey?.startsWith("vabix-qlct-"));
}

export function isQlctCourse(slug: string | undefined, storageKey?: string) {
  return slug === QLCT_COURSE.slug || isQlctStorageKey(storageKey);
}

export function qlctDisplay(storageKey: string | undefined, number: number, locale: "vi" | "en") {
  if (!isQlctStorageKey(storageKey)) return null;
  const row = qlctLesson(number);
  if (!row) return null;
  return locale === "en" ? { title: row.titleEn, summary: row.summaryEn } : { title: row.title, summary: row.summary };
}
