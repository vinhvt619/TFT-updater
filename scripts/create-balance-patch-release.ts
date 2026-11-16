/**
 * [LỆNH BỊ VÔ HIỆU HÓA] scripts/create-balance-patch-release.ts
 *
 * Lý do: Dữ liệu công bố phải có nguồn và qua kiểm tra toàn vẹn.
 * Tuyệt đối không dùng URL nội bộ giả mạo 'https://tft18.internal' làm evidence cho dữ liệu real.
 * Mã nguồn cũ được lưu lại bên dưới phục vụ điều tra và truy vết.
 */

export {};

async function main() {
  console.error("================================================================================");
  console.error(" [LỆNH BỊ VÔ HIỆU HÓA] scripts/create-balance-patch-release.ts đã bị vô hiệu hóa!");
  console.error(" Lý do: Dữ liệu công bố phải có nguồn và qua kiểm tra toàn vẹn.");
  console.error(" Tuyệt đối không dùng URL nội bộ giả mạo 'https://tft18.internal' làm evidence cho dữ liệu real.");
  console.error("================================================================================");
  process.exit(1);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
