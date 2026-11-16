# Hướng dẫn Vận hành Worker Tự động (Persistent Worker Runbook)

Tài liệu này hướng dẫn cách vận hành, cấu hình và giám sát tiến trình worker tự động cập nhật dữ liệu (`scripts/worker.ts` & `src/server/pipeline/orchestrator.ts`) cho TFT-updater.

---

## 1. Tổng quan Kiến trúc

Worker chịu trách nhiệm thực thi chu trình khép kín:
```
Fetch Sources (Riot Notes + Meta Sites + Riot API)
  ↓
Receipt & Raw Storage (Content-addressed SHA-256)
  ↓
Normalization & Verification (Scope, Schema, Board integrity)
  ↓
Atomic Pointer Publication
  ↓
Consensus Ranking Computation (Mục A & Mục B)
  ↓
Cache Invalidation
```

### Nguyên tắc Bắt buộc:
1. **Tuyệt đối không dùng Mock/Sample/Demo trên Production:** Nếu `NODE_ENV=production` và cờ `--dataset=demo` được truyền vào, tiến trình sẽ throw error ngay lập tức và dừng lại.
2. **Khóa chống đụng độ (Mutex Lease Lock):** Sử dụng file lease tại `storage/locks/pipeline.lease` ghi nhận PID, hostname, thời gian lấy lease và nhịp tim (`heartbeat`). Nếu tiến trình bị crash đột ngột (killed/SIGKILL), worker khởi động tiếp theo sẽ phát hiện PID đã chết hoặc heartbeat quá 5 phút để tiếp quản an toàn.
3. **Chịu lỗi từng phần (Graceful Partial Quorum):** Khi một trong các trang meta gặp sự cố mạng hoặc lỗi phân tích, nguồn đó bị cách ly tạm thời, các nguồn còn lại vẫn tiếp tục được xử lý và công bố ranking với nhãn cảnh báo phù hợp.
4. **Cô lập bí mật (Zero-Leakage):** Không bao giờ ghi log `RIOT_API_KEY` hoặc `ACCOUNT_KEY_HMAC_SECRET`. Nếu thiếu credentials, nhánh Elite chuyển sang trạng thái `BLOCKED (needs_credentials)` một cách an toàn mà không làm sập pipeline.

---

## 2. Các Lệnh Thực thi

### A. Kiểm thử giới hạn (Bounded Test Runs)
Dành cho kiểm tra cục bộ, CI/CD hoặc nghiệm thu kỹ thuật:

```bash
# Chạy chính xác 2 chu kỳ online trên dữ liệu Real (Nghiệm thu RT-03)
pnpm tsx scripts/worker.ts --cycles=2 --dataset=real --interval=5

# Chạy một chu kỳ duy nhất
pnpm tsx scripts/worker.ts --once --dataset=real

# Chạy với nguồn offline cache khi mạng ngoài không khả dụng
pnpm tsx scripts/worker.ts --once --dataset=real --allow-offline-cache
```

### B. Vận hành thường trực (Production Daemon)
Dành cho máy chủ sản phẩm:

```bash
# Chạy daemon liên tục mỗi 30 phút (1800 giây)
pnpm tsx scripts/worker.ts --cycles=0 --interval=1800 --dataset=real
```

Sử dụng PM2 để quản lý tiến trình tự động khởi động lại khi crash:
```bash
# Khởi động qua PM2
pm2 start "pnpm tsx scripts/worker.ts --cycles=0 --interval=1800 --dataset=real" --name "tft-pipeline-worker"

# Kiểm tra log
pm2 logs tft-pipeline-worker

# Xem trạng thái
pm2 status
```

---

## 3. Quản lý Khóa Lease & Sự cố

- **Vị trí file khóa:** `storage/locks/pipeline.lease`
- **Cấu trúc JSON:**
  ```json
  {
    "pid": 12345,
    "hostname": "PROD-WORKER-01",
    "acquiredAt": "2026-11-07T08:00:00.000Z",
    "heartbeat": "2026-11-07T08:15:00.000Z",
    "cycleCount": 12,
    "datasetKind": "real",
    "status": "running"
  }
  ```
- **Xử lý khi bị kẹt khóa:** Worker tự động kiểm tra `process.kill(pid, 0)` và tuổi của heartbeat (> 5 phút). Nếu tiến trình cũ không còn tồn tại, lease tự động được giải phóng mà không cần can thiệp thủ công.
- **Dừng an toàn:** Gửi tín hiệu `SIGINT` (Ctrl+C) hoặc `SIGTERM`. Worker sẽ hoàn thành chu kỳ hiện tại (hoặc dừng an toàn), xóa file lease và thoát với mã 0.

---

## 4. Nhật ký Chạy & Đo lường (Telemetry)

Mỗi chu kỳ chạy đều sinh một tệp manifest chi tiết lưu tại `storage/pipeline-runs/run_<timestamp>_<id>.json` ghi nhận:
- `startedAt`, `finishedAt`, `durationMs`
- Trạng thái từng nguồn (thành công, cache, lỗi, mã HTTP)
- Snapshot ID được công bố
- Trạng thái Elite (completed / needs_credentials / rate_limited)
