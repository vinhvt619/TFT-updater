# Riot Elite operations

Elite board lấy match thật theo từng region (KR, VN, NA, EUW), queue/set/version
đúng mục tiêu và cửa sổ 72 giờ. Raw match được lưu content-addressed trước khi
normalize; match ID, participant, placement, units và items phải có lineage.
PUUID chỉ tồn tại trong bộ nhớ nối cohort; `accountKey` lưu HMAC-SHA256 bằng
`ACCOUNT_KEY_HMAC_SECRET`, không lưu PUUID thô.

Chạy collector khi đã cấu hình credentials:

```powershell
npx tsx scripts/meta/ingest-riot-elite.ts --regions=KR,VN,NA,EUW --top=50 --window=72h --online-required
```

Collector có queue/rate limit, retry theo `Retry-After`, checkpoint resume và
deduplicate match ID. Match thiếu raw artifact, sai queue/set/version hoặc thiếu
participant bị quarantine. Snapshot chỉ publish sau regional coverage, valid
match lineage và privacy gate.

Khi thiếu `RIOT_API_KEY` hoặc HMAC secret, API vẫn trả `ready=false` và
`status=collecting`; không seed Elite demo vào dataset real và không dùng demo
pointer làm real fallback. Kiểm tra trạng thái tại `/api/v1/meta/rankings?board=elite&mode=real`.
