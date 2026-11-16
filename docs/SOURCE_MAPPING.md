# Quy tắc Ánh xạ Nguồn sang Hợp đồng Dữ liệu Chuẩn hóa (Source Mapping)

Ngày lập: 10/09/2026  
Hệ thống: **TFT 18 Change Tracker**

---

## 1. Nguyên tắc cốt lõi
- **Không đoán JSON path:** Mọi trường dữ liệu được trích xuất phải có định nghĩa rõ ràng.
- **Phân tách Entity:** Phân loại rõ `shop_champion`, `summon`, `npc`, `unknown`. Mặc định UI chỉ hiển thị `shop_champion`.
- **Đánh index cấp sao (Star Level Indexing):**
  - Trong cấu trúc mảng giá trị của CDragon (`variables[].value`):
    - Index 0: Thường là giá trị sentinel / fallback hoặc base.
    - Index 1: Tương ứng 1 sao.
    - Index 2: Tương ứng 2 sao.
    - Index 3: Tương ứng 3 sao.
    - Index 4: Tương ứng 4 sao (nếu có hỗ trợ).
  - Nếu trường chỉ có một giá trị duy nhất (không phải mảng), giá trị đó chỉ áp dụng cho toàn bộ cấp sao nếu trường đó là flat stat (như tầm đánh, tốc đánh cơ bản) và có bằng chứng không scale theo sao.

---

## 2. Bảng ánh xạ chỉ số cơ bản (Base Stats)

| Trường chuẩn hóa | Nguồn CDragon / Raw | Đơn vị | Quy tắc chuyển đổi |
|---|---|---|---|
| `health` | `stats.hp` | `flat` | Lưu theo cấp sao. Nếu chỉ có base, tính theo hệ số đã xác minh hoặc ghi chú `derived`. |
| `attack_damage` | `stats.damage` | `flat` | Tương tự máu. |
| `attack_speed` | `stats.attackSpeed` | `attacks_per_second` | Giữ nguyên float (làm tròn 2 chữ số thập phân khi hiển thị). |
| `armor` | `stats.armor` | `flat` | Giáp cơ bản chưa trang bị/tộc hệ. |
| `magic_resistance` | `stats.magicResist` | `flat` | Kháng phép cơ bản. |
| `attack_range` | `stats.range` | `hexes` | Quy đổi từ khoảng cách pixel (1 hex ~ 180 units) sang số ô (1, 2, 3, 4, 5). |
| `mana_start` | `stats.initialMana` | `mana` | Năng lượng lúc bắt đầu giao tranh. |
| `mana_max` | `stats.mana` | `mana` | Năng lượng tối đa để dùng kỹ năng. |
| `crit_chance` | `stats.critChance` | `percent` | Thang 0–100%. |
| `crit_multiplier` | `stats.critMultiplier` | `ratio` | Hệ số sát thương chí mạng (ví dụ 1.4 = 140%). |

---

## 3. Ánh xạ kỹ năng (Abilities & Parameters)

### 3.1. Cấu trúc Kỹ năng
- `abilityKey`: Khóa duy nhất (ví dụ: `active`, `passive`, `spell_1`).
- `name`: Tên kỹ năng theo locale (`vi`, `en`).
- `description`: Chuỗi mô tả kỹ năng nguyên bản từ nguồn.
- `parameters`: Danh sách các thông số kỹ năng trích xuất được từ `variables`.

### 3.2. Token trong mô tả
Chuỗi mô tả thường chứa các placeholder như:
- `@ModifiedDamage@`: Tham số sát thương.
- `@Duration@`: Thời gian tác dụng.
- `%i:scaleAP%`, `%i:scaleAD%`: Icon/tỷ lệ sức mạnh phép thuật / công kích.
**Chính sách:** Giữ nguyên chuỗi placeholder an toàn trong mô tả, đồng thời liệt kê giá trị các biến số trong bảng tham số kỹ năng (`NumericParameter[]`). Không dùng `eval()` để tính toán động.

---

## 4. Ánh xạ Biến thể (Variants)
- Đa số tướng có 1 biến thể duy nhất: `variantKey = "base"`.
- Với các tướng có nhiều dạng (ví dụ: Kayn Đỏ/Xanh, Jayce Cận chiến/Đánh xa), tạo các biến thể riêng biệt:
  - `variantKey = "form_melee"`, `variantKey = "form_ranged"`.
  - So sánh chỉ số chỉ thực hiện giữa **cùng một biến thể** ở hai phiên bản.
