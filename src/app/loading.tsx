export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-[#94a3b8] space-y-3">
      <div className="w-8 h-8 border-3 border-[#06b6d4] border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm font-medium text-[#f8fafc]">Đang tải dữ liệu TFT Mùa 18...</p>
    </div>
  );
}
