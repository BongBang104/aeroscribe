// ══════════════════════════════════════════════════════════════
//  AEROSCRIBE VIET — PROMPT ENGINE
//  Tối ưu cho Gemini nhận dạng R/T hàng không tiếng Việt
// ══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
//  NGUYÊN TẮC XÂY DỰNG PROMPT
//
//  [1] ROLE PRIMING   — Khai báo vai trò chuyên gia cụ thể, không chung chung
//  [2] AUDIO CONTEXT  — Mô tả đặc điểm âm thanh để Gemini biết trước
//  [3] VOCABULARY INJ — Inject từ vựng domain TRƯỚC khi xử lý audio
//  [4] PHONETIC MAP   — Map âm đọc VN → ký hiệu chuẩn ICAO
//  [5] PATTERN RULES  — Regex-like rules cho callsign, số, tần số
//  [6] ERROR TYPES    — Liệt kê lỗi cần phát hiện (readback error...)
//  [7] OUTPUT SCHEMA  — JSON schema chặt chẽ, không để Gemini tự quyết
//  [8] EXAMPLES       — Few-shot examples ngắn, đặc trưng domain
// ─────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
//  PHẦN 1: STATIC KNOWLEDGE BASE (không đổi theo session)
// ══════════════════════════════════════════════════════════════

const PHONETIC_ALPHABET_MAP = `
BẢNG PHIÊN ÂM ICAO — CÁCH KSVKL/PHI CÔNG VIỆT NAM PHÁT ÂM:
A=Alpha    → "an-pha", "al-pha"
B=Bravo    → "brờ-ra-vô", "bra-vô"
C=Charlie  → "sơ-li", "char-li"
D=Delta    → "đen-ta", "del-ta"
E=Echo     → "ê-cô", "e-khô"
F=Foxtrot  → "phót-trót", "fox-trót"
G=Golf     → "gôn-phờ", "gôn-phơ"
H=Hotel    → "hô-ten", "hô-tel"
I=India    → "in-đia", "in-đi-a"
J=Juliet   → "uy-li-ét", "du-li-ét"
K=Kilo     → "ki-lô", "ki-lo"
L=Lima     → "li-ma"
M=Mike     → "mai-cờ", "mai-k"
N=November → "nô-vem-bờ", "no-vem-bơ"
O=Oscar    → "ốt-ca", "os-ca"
P=Papa     → "pa-pa"
Q=Quebec   → "quê-bét", "kê-bét"
R=Romeo    → "rô-mi-ô", "ro-mê-ô"
S=Sierra   → "si-e-ra", "xi-e-ra"
T=Tango    → "tang-gô", "tan-gô"
U=Uniform  → "u-ni-phom", "u-ni-phom"
V=Victor   → "víc-to", "vích-to"
W=Whiskey  → "uýt-ki", "whis-ki"
X=Xray     → "ech-rây", "x-ray"
Y=Yankee   → "yeng-ki", "yan-ki"
Z=Zulu     → "zu-lu"`;

const ICAO_NUMBERS = `
QUY TẮC ĐỌC SỐ ICAO (tiếng Anh chuẩn hoặc tiếng Việt hóa):
0 = "zero" / "zê-rô" / "không"
1 = "one" / "oan" / "một"
2 = "two" / "tu" / "hai"
3 = "three" / "tri" / "ba"
4 = "four" / "pho" / "bốn"
5 = "five" / "phai-vơ" / "năm"
6 = "six" / "xích" / "sáu"
7 = "seven" / "sê-vờn" / "bảy"
8 = "eight" / "ết" / "tám"
9 = "niner" / "nai-nơ" / "chín"
Dấu thập phân = "decimal" / "đê-xi-men" / "phẩy"

ÁP DỤNG:
- FL350 → "ba năm không" hoặc "three five zero"
- QNH 1013 → "một không một ba" hoặc "one zero one three"  
- Squawk 7700 → "bảy bảy không không" hoặc "seven seven zero zero"
- Heading 270 → "hai bảy không" (KHÔNG đọc "hai trăm bảy mươi")
- Frequency 119.1 → "một một chín phẩy một" hoặc "one one niner decimal one"`;

const CALLSIGN_PATTERNS = `
CALLSIGN HÃNG BAY VIỆT NAM:
Vietnam Airlines: VNA hoặc VN + 3 chữ số → VNA123, VN456
Bamboo Airways:  BAV hoặc BL + 3 chữ số → BAV789, BL321
Vietjet Air:     VJC hoặc VJ + 3 chữ số → VJC456, VJ789
Pacific Airlines: PIC hoặc BL + 3 chữ số → PIC123
Vietravel:       VTR + 3 chữ số → VTR456
Cargo/Charter:   Prefix đa dạng

QUY TẮC: Callsign LUÔN có dạng [2-3 chữ cái] + [3 chữ số]
Nếu nghe không rõ chữ số → dùng phonetic alphabet để khôi phục
VD: "VNA một an-pha ba" → VNA1A3 (nếu có chữ cái xen số)`;

const STATION_IDS = `
TRẠM KIỂM SOÁT VIỆT NAM:
- "Hà Nội Kiểm soát" / "Hanoi Control" → ACC Hà Nội (VVHH)
- "Hồ Chí Minh Kiểm soát" / "Ho Chi Minh Control" → ACC TP.HCM (VVTS)
- "Đà Nẵng Tiếp cận" / "Danang Approach" → APP Đà Nẵng (VVDN)
- "Nội Bài Tiếp cận" / "Noibai Approach" → APP Nội Bài (VVNB)
- "Tân Sơn Nhất Tháp" / "Tan Son Nhat Tower" → TWR TSN (VVTS)
- "Nội Bài Tháp" / "Noibai Tower" → TWR Nội Bài
- "Cam Ranh Tháp" / "Cam Ranh Tower" → TWR Cam Ranh (VVCR)
- "Phú Quốc Tháp" / "Phu Quoc Tower" → TWR Phú Quốc (VVPQ)
- "Liên Khương Tháp" / "Lien Khuong Tower" → TWR Liên Khương (VVDL)`;

const STANDARD_PHRASES = `
CÁC CỤM TỪ CHUẨN R/T (có thể bị nhiễu hoặc phát âm lệch):
"Roger" / "rô-gơ" → Đã nhận, hiểu
"Wilco" / "win-cô" → Đã nhận, sẽ thực hiện  
"Affirm" / "a-phim" → Có/Đúng
"Negative" / "nét-ti-típ" / "nê-ga-típ" → Không/Sai
"Stand by" / "stan-bai" → Chờ
"Cleared" / "clê" / "clia" → Được phép
"Maintain" / "men-tên" → Duy trì
"Descend" / "đi-xen" → Hạ độ cao
"Climb" / "clai" → Leo lên
"Contact" / "con-tắc" → Liên lạc với
"Frequency" / "pri-quen-xi" → Tần số
"Report" / "ri-pót" → Báo cáo
"Unable" / "an-ây-bồ" → Không thể
"Expedite" / "ét-xpê-đai" → Khẩn trương`;

const READBACK_RULES = `
QUY TẮC READBACK (PHI CÔNG đọc lại lệnh của KSVKL):
- Phi công PHẢI đọc lại: callsign, FL/altitude, heading, speed, frequency, squawk
- Nếu phi công bỏ sót một phần → đánh dấu "READBACK INCOMPLETE"
- Nếu phi công đọc sai số → đánh dấu "READBACK ERROR - [phần sai]"
- Nếu phi công đọc "Roger" / "Wilco" không có readback → có thể bình thường với lệnh thông tin
VD READBACK ĐÚNG: 
  KSVKL: "VNA123, climb FL350, contact Hanoi Control 124.9"
  Phi công: "Climb FL350, contact 124.9, VNA123" ✓
VD READBACK SAI:
  Phi công: "Climb FL305, contact 124.9, VNA123" → ERROR: FL305 thay vì FL350`;

// ══════════════════════════════════════════════════════════════
//  PHẦN 2: FEW-SHOT EXAMPLES
//  Gemini học nhanh hơn từ ví dụ cụ thể hơn là mô tả trừu tượng
// ══════════════════════════════════════════════════════════════

const FEW_SHOT_EXAMPLES = `
VÍ DỤ NHẬN DẠNG ĐÚNG:

[Ví dụ 1 — KSVKL phát lệnh leo]
Audio nghe được: "VNA một hai ba, leo lên mực bay ba năm không, duy trì tốc độ..."
Kết quả đúng:
{"speaker":"KSVKL","original":"VNA một hai ba, leo lên mực bay ba năm không, duy trì tốc độ","corrected":"VNA123, leo lên mực bay FL350, duy trì tốc độ.","notes":""}

[Ví dụ 2 — Phi công readback]
Audio: "leo lên ba năm không, VNA một hai ba"
Kết quả đúng:
{"speaker":"PHI CÔNG","original":"leo lên ba năm không, VNA một hai ba","corrected":"Leo lên FL350, VNA123.","notes":"Readback đầy đủ ✓"}

[Ví dụ 3 — Nhiễu radio, thiếu chữ]
Audio: "VJC... bảy tám chín... ti... cận... ILS..."
Kết quả đúng:
{"speaker":"KHÔNG RÕ","original":"VJC... bảy tám chín... ti... cận... ILS...","corrected":"VJC789, [NHIỄU] tiếp cận ILS [NHIỄU]","notes":"Audio bị gián đoạn, thiếu thông tin quan trọng"}

[Ví dụ 4 — Readback sai]
KSVKL vừa phát: "BAV321, hạ xuống FL120, QNH 1012"
Audio phi công: "hạ xuống FL210, QNH 1012, BAV321"
Kết quả đúng:
{"speaker":"PHI CÔNG","original":"hạ xuống FL210, QNH 1012, BAV321","corrected":"Hạ xuống FL210, QNH 1012, BAV321.","notes":"⚠ READBACK ERROR: Phi công đọc FL210 thay vì FL120 — cần sửa ngay!"}

[Ví dụ 5 — Emergency]
Audio: "...pan pan pan... VNA456... engine... failure..."
Kết quả đúng:
{"speaker":"PHI CÔNG","original":"pan pan pan VNA456 engine failure","corrected":"Pan Pan Pan, VNA456, engine failure.","notes":"🚨 URGENCY CALL (PAN PAN) — ưu tiên xử lý khẩn"}`;

// ══════════════════════════════════════════════════════════════
//  PHẦN 3: PROMPT BUILDERS
// ══════════════════════════════════════════════════════════════

/**
 * Build ATC R/T prompt tối ưu cho Gemini
 * @param {string} speakerHint  - "KSVKL" | "PHI CÔNG" | "TỰ ĐỘNG"
 * @param {string} unit         - "ACC" | "APP" | "TWR" | "GND"
 * @param {string} airport      - "Nội Bài" | "Đà Nẵng" | "Tân Sơn Nhất"...
 * @param {string} glossaryCtx  - "ACC:Trung tâm kiểm soát | APP:Tiếp cận..."
 * @param {string[]} prevLines  - 2-3 lệnh gần nhất (để detect readback error)
 */
export const buildAtcPrompt = ({
  speakerHint = "TỰ ĐỘNG",
  unit        = "ACC",
  airport     = "không xác định",
  glossaryCtx = "",
  prevLines   = [],
}) => {
  const prevContext = prevLines.length
    ? `\nLIÊN LẠC TRƯỚC ĐÓ (để phát hiện readback error):\n${prevLines.slice(-3).map((l,i)=>`${i+1}. [${l.speaker}] ${l.corrected}`).join("\n")}`
    : "";

  return `[ROLE]
Bạn là hệ thống xử lý liên lạc vô tuyến điện hàng không (R/T) chuyên biệt, có kiến thức sâu về:
- ICAO Doc 4444 PANS-ATM (phraseology chuẩn)
- Quy trình ATC Việt Nam (VATM/CAAV)
- Giọng nói tiếng Việt 3 miền trong môi trường R/T

[AUDIO CONTEXT]
Loại âm thanh: Liên lạc R/T hàng không qua sóng VHF
Đặc điểm: Có thể bị nhiễu tĩnh, clipping, fading, méo tiếng do codec radio
Đơn vị: ${unit} ${airport}
Người nói dự kiến: ${speakerHint === "TỰ ĐỘNG" ? "Xác định từ ngữ cảnh" : speakerHint}
Ngôn ngữ: Tiếng Việt pha tiếng Anh (phraseology ICAO)

[KIẾN THỨC DOMAIN]
${PHONETIC_ALPHABET_MAP}

${ICAO_NUMBERS}

${CALLSIGN_PATTERNS}

${STATION_IDS}

${STANDARD_PHRASES}

${READBACK_RULES}

[GLOSSARY HIỆN TẠI]
${glossaryCtx || "Dùng glossary mặc định"}

[NGỮ CẢNH PHIÊN]${prevContext}

[FEW-SHOT EXAMPLES]
${FEW_SHOT_EXAMPLES}

[NHIỆM VỤ — THỰC HIỆN THEO THỨ TỰ]
Bước 1: PHIÊN ÂM — Nghe audio và ghi lại chính xác những gì nghe được (original)
Bước 2: NHẬN DẠNG — Áp dụng phonetic map, number rules, callsign patterns để xác định nội dung thực
Bước 3: CHUẨN HÓA — Sửa theo chuẩn ICAO, viết hoa callsign, định dạng FL/QNH/squawk
Bước 4: XÁC ĐỊNH SPEAKER — KSVKL (ra lệnh) hoặc PHI CÔNG (đọc lại/báo cáo)
Bước 5: PHÁT HIỆN VẤN ĐỀ — Readback error, emergency, communication failure
Bước 6: OUTPUT JSON

[QUY TẮC XỬ LÝ ĐẶC BIỆT]
- Nếu audio nhiễu nặng không nghe được: dùng "[NHIỄU]" thay vì đoán bừa
- Nếu callsign không rõ: ghi "CALLSIGN KHÔNG RÕ" thay vì bịa
- KHÔNG thêm thông tin không có trong audio
- KHÔNG sửa lỗi readback (chỉ đánh dấu để KSVKL xử lý)
- Giữ nguyên emergency call (MAYDAY/PAN PAN) chính xác 100%

[OUTPUT FORMAT — JSON THUẦN, KHÔNG CÓ BACKTICK]
{
  "speaker": "KSVKL|PHI CÔNG|KHÔNG RÕ",
  "original": "phiên âm gốc nghe được từ audio",
  "corrected": "đã chuẩn hóa ICAO, callsign in hoa, FL/QNH/squawk đúng format",
  "unit": "ACC|APP|TWR|GND|KHÔNG RÕ",
  "callsign": "VNA123 hoặc null nếu không có",
  "key_values": {
    "FL": "350 hoặc null",
    "QNH": "1013 hoặc null",
    "heading": "270 hoặc null",
    "squawk": "7700 hoặc null",
    "frequency": "124.9 hoặc null",
    "speed": "250 hoặc null"
  },
  "notes": "Readback error / Emergency / Nhiễu / rỗng nếu bình thường",
  "severity": "NORMAL|WARNING|EMERGENCY"
}`;
};

// ══════════════════════════════════════════════════════════════
//  MEETING PROMPT (giữ nguyên từ phiên bản trước, tối ưu nhỏ)
// ══════════════════════════════════════════════════════════════
export const buildMeetingPrompt = ({ roomLabel, glossaryCtx }) => `
[ROLE]
Bạn là hệ thống xử lý audio cuộc họp chuyên ngành hàng không dân dụng Việt Nam.
Được tối ưu để xử lý: tiếng vang phòng lớn, nhiều người nói, nhiễu thiết bị.

[AUDIO CONTEXT]
Môi trường: ${roomLabel} — có tiếng vang và nhiễu nền
Loại cuộc họp: Nội bộ ngành hàng không (VATM/CAAV/Cảng vụ)
Ngôn ngữ: Tiếng Việt, có thể xen thuật ngữ tiếng Anh

[KIẾN THỨC DOMAIN]
${glossaryCtx}

Thuật ngữ thường gặp: báo cáo hoạt động bay, an toàn hàng không, sự cố, kế hoạch ca trực,
đào tạo huấn luyện, văn bản quy định, ICAO SARPS, phân tích nguyên nhân, biện pháp khắc phục.

[NHIỆM VỤ]
1. Phiên âm audio, loại bỏ tiếng vang lặp do phòng
2. Làm sạch: bỏ từ đệm (ờ, à, ừm, thì là, mà, cái, ấy)
3. Xác định vai trò: Chủ tọa (dẫn dắt, phân công) vs Tham dự (báo cáo, phát biểu)
4. Phân loại nội dung
5. Trích action item nếu có

[OUTPUT JSON THUẦN]
{
  "speaker": "CHỦ TỌA|THAM DỰ A|THAM DỰ B|KHÔNG RÕ",
  "original": "phiên âm gốc kể cả từ đệm",
  "cleaned": "đã làm sạch, mạch lạc",
  "category": "THÔNG TIN|QUYẾT ĐỊNH|THẢO LUẬN|HÀNH ĐỘNG",
  "action_item": "ai làm gì trước khi nào, hoặc null",
  "confidence": 0.85
}`;

// ══════════════════════════════════════════════════════════════
//  SUMMARY PROMPT
// ══════════════════════════════════════════════════════════════
export const buildSummaryPrompt = (content, actions) => `
Bạn là thư ký họp hàng không dân dụng. Tóm tắt cuộc họp sau theo cấu trúc:
1. CHỦ ĐỀ & MỤC TIÊU (2-3 câu)
2. CÁC ĐIỂM CHÍNH ĐÃ THẢO LUẬN (gạch đầu dòng)
3. QUYẾT ĐỊNH ĐÃ THỐNG NHẤT
4. DANH SÁCH HÀNH ĐỘNG CẦN THỰC HIỆN
5. KẾT LUẬN

Nội dung cuộc họp:
${content}
${actions ? "\nAction items đã xác định:\n" + actions : ""}
Trả lời bằng tiếng Việt, súc tích và chuyên nghiệp.`;
