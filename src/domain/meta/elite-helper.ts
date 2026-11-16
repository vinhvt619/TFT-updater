export function getEliteBadgeInfo(
  snapshot: { status?: string; rows?: any[] } | null | undefined,
  loading: boolean
): { text: string; isVerified: boolean } {
  if (
    snapshot &&
    (snapshot.status === "ranked" || snapshot.status === "provisional") &&
    snapshot.rows &&
    snapshot.rows.length > 0
  ) {
    return {
      text: `Dữ liệu cao thủ đã xác minh (${snapshot.rows.length} bài)`,
      isVerified: true
    };
  }
  return {
    text: loading ? "Đang tải..." : "Đang thu thập dữ liệu",
    isVerified: false
  };
}
