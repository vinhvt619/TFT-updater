/**
 * [LỆNH BỊ VÔ HIỆU HÓA] scripts/meta/seed-real.ts
 *
 * Lý do: Dữ liệu công bố phải có nguồn và qua kiểm tra toàn vẹn.
 * Tuyệt đối không sinh PUUID, trận đấu, vị trí hoặc bàn cờ giả mạo để gán nhãn 'real'.
 * Để nạp dữ liệu thật, hãy sử dụng sync API chính thức hoặc import artifact có kiểm chứng.
 */

async function runSeedMetaReal() {
  console.error("================================================================================");
  console.error(" [LỆNH BỊ VÔ HIỆU HÓA] scripts/meta/seed-real.ts đã bị vô hiệu hóa!");
  console.error(" Lý do: Dữ liệu công bố phải có nguồn và qua kiểm tra toàn vẹn.");
  console.error(" Tuyệt đối không sinh PUUID, trận đấu, vị trí hoặc bàn cờ giả mạo để gán nhãn 'real'.");
  console.error(" Để nạp dữ liệu thật, hãy sử dụng sync API chính thức hoặc import artifact có kiểm chứng.");
  console.error("================================================================================");
  process.exit(1);
}

runSeedMetaReal().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
