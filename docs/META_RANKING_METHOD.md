# Phương Pháp Xếp Hạng Đội Hình Mạnh (Meta Ranking Method)

Ngày ban hành: 11/09/2026. Phiên bản thuật toán: `meta-rank-v1`.

Tài liệu này giải thích chi tiết phương pháp tính điểm và phân loại tier S–A–B–C cho hai mục độc lập của module **Đội hình mạnh**:
- **Mục A: Tổng hợp các trang meta** (MetaTFT, TFT Academy, TFT Flex, DataTFT, tactics.tools).
- **Mục B: Đội hình từ kết quả cao thủ các khu vực** (KR, VN, NA, EUW; bảo lưu CN).

---

## 1. Thang Điểm & Ngưỡng Tier Chuẩn (Thang S/A/B/C)

| Khoảng điểm | Tier | Ý nghĩa và Tiêu chí |
|---|:---:|---|
| `80 <= score <= 100` | **S** | Nhóm đội hình mạnh nhất, kết quả vượt trội và ổn định cao. |
| `65 <= score < 80` | **A** | Đội hình mạnh, đạt kết quả và đánh giá tốt qua nhiều trận. |
| `50 <= score < 65` | **B** | Khả dụng, xấp xỉ mức nền trung tính hoặc cần điều kiện bài đẹp. |
| `0 <= score < 50` | **C** | Hiệu suất thấp hơn mức trung bình (đã đủ mẫu kiểm chứng). |

### Nguyên tắc Bất biến:
- **Tuyệt đối không ép C khi thiếu dữ liệu:** Nếu đội hình chưa đủ số lượng nguồn hoặc chưa đạt ngưỡng mẫu tối thiểu, hệ thống giữ trạng thái `collecting` (Đang thu thập dữ liệu) hoặc `provisional` (Tạm thời), không gán tier C.
- **Không chia theo quota:** Không bắt buộc 10% đội hình phải là S. Nếu meta cân bằng hoặc chưa đội hình nào đạt ngưỡng mẫu S, bảng xếp hạng có thể không có Tier S.

---

## 2. Mục A — Động cơ Đồng thuận 5 Website Meta

### 2.1. Quy đổi điểm phiếu từ Tier gốc
| Tier công bố từ nguồn | Điểm phiếu tương ứng |
|---|:---:|
| `S+` | 95 |
| `S` | 90 |
| `S-` | 85 |
| `A+` | 80 |
| `A` | 75 |
| `A-` | 70 |
| `B+` | 65 |
| `B` | 60 |
| `B-` | 55 |
| `C+` | 45 |
| `C` | 40 |
| `C-` | 35 |
| `D` | 25 |

- Các phân loại điều kiện (`Situational`, `For Fun`, `Early Game`) không đổi thành điểm số.
- Với nguồn thống kê thuần (như tactics.tools) không có Tier chữ: tự động tạo phiếu thống kê nếu cỡ mẫu $\ge 200$ trận dựa trên công thức hiệu suất chuẩn hóa.

### 2.2. Điểm đồng thuận (Consensus Score)
Mỗi nhóm xuất xứ (`provenanceGroupId`) chỉ đóng góp tối đa 1 phiếu đại diện có trọng số $w = 1.0$:
$$\text{websiteScore} = \frac{\sum (\text{groupVote}_i \times w_i)}{\sum w_i}$$

- **Cấp Tier chính thức:** Cần ít nhất **2 nhóm nguồn hợp lệ**.
- **Điều kiện cho Tier S:** Cần ít nhất **3 nhóm nguồn hợp lệ** xác nhận. Nếu đạt $\ge 80$ điểm nhưng mới có 2 nguồn, giữ `tier = null`, `candidateTier = "S"`, `status = "provisional"`.
- **Nhãn đồng thuận:**
  - $\max(\text{vote}) - \min(\text{vote}) \le 25$: *Đồng thuận cao*.
  - $\max(\text{vote}) - \min(\text{vote}) \ge 30$: *Các nguồn khác nhau*.

---

## 3. Mục B — Động cơ Thống kê Cao thủ các Khu vực

### 3.1. Điều chỉnh Thời gian và Giới hạn Đóng góp Tài khoản
- **Trọng số thời gian (Bán rã 48 giờ):**
  $$\text{ageWeight}_i = 2^{-\frac{\text{ageHours}_i}{48}}$$
- **Trần đóng góp tài khoản (Account Mass Cap):** Mỗi tài khoản đóng góp tối đa 5 đơn vị trọng số cho một đội hình:
  $$\text{accountCapFactor}_p = \min\left(1, \frac{5}{\text{accountMass}_p}\right)$$
  $$w_i = \text{ageWeight}_i \times \text{accountCapFactor}_p$$
- **Cỡ mẫu hiệu dụng:**
  $$n_{\text{effective}} = \frac{(\sum w_i)^2}{\sum w_i^2}$$

### 3.2. Thu hẹp Bayes (Empirical Bayes Shrinkage)
Để tránh hiện tượng một người chơi thắng 2-3 trận đưa đội hình lên Tier S ảo, các tỷ lệ được co về mức nền (baseline) của khu vực với trọng lượng prior $m = 20$:
$$\text{adjustedTop4} = \frac{\sum w_i \cdot \text{isTop4}_i + m \cdot \text{baselineTop4}}{\sum w_i + m}$$
$$\text{adjustedWin} = \frac{\sum w_i \cdot \text{isWin}_i + m \cdot \text{baselineWin}}{\sum w_i + m}$$
$$\text{adjustedAvg} = \frac{\sum w_i \cdot \text{placement}_i + m \cdot \text{baselineAvg}}{\sum w_i + m}$$

### 3.3. Công thức Điểm Hiệu suất (Performance Score)
$$\text{clamp100}(x) = \min(100, \max(0, x))$$
$$\text{top4Component} = \text{clamp100}(50 + 200 \times (\text{top4Rate} - \text{baselineTop4}))$$
$$\text{placeComponent} = \text{clamp100}(50 + 30 \times (\text{baselineAvg} - \text{avgPlace}))$$
$$\text{winComponent} = \text{clamp100}(50 + 150 \times (\text{winRate} - \text{baselineWin}))$$
$$\text{performanceScore} = 0.50 \times \text{top4Component} + 0.35 \times \text{placeComponent} + 0.15 \times \text{winComponent}$$

### 3.4. Tiêu chuẩn Chất lượng Khu vực (Quality Gates)
Điểm số chỉ được chuyển thành Tier công bố khi đạt đủ các ngưỡng:
- $\ge 60$ lượt chơi
- $\ge 40$ trận riêng biệt
- $\ge 10$ tài khoản độc lập
- $n_{\text{effective}} \ge 40$
- $w_{\text{mass}} \ge 20$
- **Điều kiện riêng cho Tier S:** $\ge 120$ lượt chơi, $\ge 60$ trận, $\ge 15$ tài khoản, $n_{\text{effective}} \ge 60$.

### 3.5. Tổng hợp Đa Khu vực (Macro-Average)
Bảng tổng hợp không cộng gộp số trận (tránh để máy chủ đông trận lấn át), mà dùng trung bình cộng đều giữa các khu vực hợp lệ:
$$\text{globalScore} = \frac{\sum_{r \in R} \text{regionalScore}_r}{|R|}$$
Khu vực chưa quan sát được lượt chơi nào đóng góp mức prior trung tính 50.0 có nhãn `isPriorOnly`.
