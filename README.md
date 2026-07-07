# ✈ AeroScribe VIET

Hệ thống ghi âm và phiên dịch liên lạc hàng không tiếng Việt, sử dụng **Whisper-1** (Speech-to-Text) và **GPT-4o-mini** (AI post-processing). Hỗ trợ thêm **Chế độ Cuộc họp** với DSP Engine xử lý âm thanh phòng lớn (vang, nhiễu).

---

## 🚀 Cài đặt & Chạy

### Yêu cầu
- Node.js **18+**
- npm hoặc yarn
- Trình duyệt **Chrome / Edge** (yêu cầu Web Audio API + MediaRecorder)

### Bước 1 — Cài dependencies
```bash
npm install
```

### Bước 2 — Chạy development server
```bash
npm run dev
```
Mở trình duyệt tại `http://localhost:5173`

### Build production
```bash
npm run build
npm run preview
```

---

## 🔑 Cấu hình API Key

1. Truy cập [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Tạo API key mới (cần billing đã kích hoạt)
3. Mở app → tab **Cài đặt ◎** → dán key vào ô OpenAI API Key
4. Key được lưu vào `localStorage` (chỉ trên máy bạn, không gửi đi đâu ngoài OpenAI)

**Chi phí ước tính** (sử dụng cá nhân):
| API | Giá | Ước tính/giờ ghi âm |
|-----|-----|---------------------|
| Whisper-1 | $0.006/phút | ~$0.36 |
| GPT-4o-mini | $0.15/1M tokens | ~$0.05 |

---

## 📡 Tính năng

### Tab Ghi âm R/T
- Ghi âm liên lạc vô tuyến (R/T) hàng không
- Whisper-1 nhận dạng với aviation prompt (50+ thuật ngữ)
- GPT-4o-mini sửa lỗi giọng vùng miền, chuẩn hóa ICAO
- Xác định vai trò: **KSVKL** / **PHI CÔNG**
- Phát hiện bất thường: emergency, readback error

### Tab Cuộc họp ⊕ *(DSP Engine)*
Xử lý âm thanh phòng lớn qua chuỗi DSP:
```
Mic → echoCancellation → HP Filter → Compressor → Gain → Whisper → GPT-4o
```

**3 Room Presets:**
| Preset | HP Filter | Comp Ratio | Gain | Dùng cho |
|--------|-----------|------------|------|----------|
| Phòng nhỏ | 100 Hz | 4:1 | ×1.3 | ≤20 người |
| Hội trường vừa | 160 Hz | 8:1 | ×1.7 | 20–60 người |
| Hội trường lớn | 220 Hz | 14:1 | ×2.2 | >60 người, họp VATM |

**Tính năng họp:**
- Phân loại nội dung: THÔNG TIN / QUYẾT ĐỊNH / THẢO LUẬN / HÀNH ĐỘNG
- Nhận dạng vai trò: Chủ tọa / Tham dự A / B...
- Tự động trích xuất **Action Items**
- Nút **"Tạo biên bản AI"** — GPT-4o-mini tóm tắt toàn phiên
- Xuất biên bản `.txt` đầy đủ

### Hỗ trợ giọng vùng miền
Không cần training samples. Hai kỹ thuật:
1. **Aviation Prompt** inject sẵn vào Whisper — định hướng nhận dạng thuật ngữ chuyên ngành
2. **GPT-4o-mini post-processing** — sửa lỗi đặc thù từng vùng (miền Trung: eng→anh, miền Nam: ngã→hỏi...)

---

## 📁 Cấu trúc dự án

```
aeroscribe-viet/
├── index.html
├── package.json
├── vite.config.js
├── README.md
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx        # Entry point
    ├── index.css       # Global reset
    └── App.jsx         # Toàn bộ logic + UI (1256 dòng)
```

---

## 🔧 Khuyến nghị phần cứng

| Môi trường | Mic khuyến nghị |
|------------|-----------------|
| Bàn làm việc | Mic USB cardioid (Blue Yeti, HyperX) |
| Họp phòng nhỏ | Mic USB để bàn, đặt giữa |
| Hội trường lớn | Mic conference (Jabra, Poly), kết nối USB laptop |
| Thực địa R/T | Tai nghe có mic boom (headset ATC) |

---

## 🛠 Tech Stack

| Thành phần | Công nghệ |
|------------|-----------|
| Frontend | Vite + React 18 |
| STT | OpenAI Whisper-1 |
| AI Correction | GPT-4o-mini |
| Audio Capture | MediaRecorder API |
| DSP | Web Audio API (BiquadFilter + DynamicsCompressor + GainNode) |
| Visualizer | AnalyserNode + Canvas 2D |
| Storage | localStorage (no backend) |

---

## ⚠ Lưu ý

- Cần HTTPS hoặc `localhost` để truy cập microphone
- Nếu dùng `--tunnel` (Expo) hoặc mạng nội bộ: đảm bảo trình duyệt cấp quyền mic
- Nếu gặp lỗi `NotAllowedError`: vào Settings trình duyệt → cho phép mic cho localhost
- API key **chỉ lưu trên máy bạn** qua localStorage, không có backend
