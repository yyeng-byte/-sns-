-- 자동 생성 파일: scripts/make_migration.py 로 만들었습니다. Cloudflare D1 콘솔에 붙여넣어 실행하세요.

CREATE TABLE IF NOT EXISTS "contents" (
  "content_id" TEXT PRIMARY KEY,
  "brand",
  "channel",
  "topic_id",
  "title",
  "format",
  "topic_category",
  "status",
  "scheduled_at",
  "published_at",
  "post_url",
  "external_id",
  "owner",
  "memo",
  "created_at",
  "updated_at",
  "signup_count",
  "ga4_sessions",
  "ext_1",
  "ext_2",
  "ext_3"
);
CREATE TABLE IF NOT EXISTS "channel_daily" (
  "key" TEXT PRIMARY KEY,
  "brand",
  "channel",
  "date",
  "reach",
  "views",
  "likes",
  "comments",
  "shares",
  "saves",
  "followers",
  "followers_gain",
  "watch_minutes",
  "clicks",
  "source",
  "collected_at",
  "ext_1",
  "ext_2"
);
CREATE TABLE IF NOT EXISTS "content_metrics" (
  "key" TEXT PRIMARY KEY,
  "content_id",
  "snapshot_date",
  "reach",
  "views",
  "likes",
  "comments",
  "shares",
  "saves",
  "watch_minutes",
  "avg_view_pct",
  "source",
  "collected_at",
  "ext_1",
  "ext_2"
);
CREATE TABLE IF NOT EXISTS "bitly_clicks" (
  "key" TEXT PRIMARY KEY,
  "content_id",
  "brand",
  "channel",
  "link_id",
  "link_title",
  "date",
  "clicks",
  "collected_at",
  "ext_1"
);
CREATE TABLE IF NOT EXISTS "topics" (
  "topic_id" TEXT PRIMARY KEY,
  "brand",
  "topic_title",
  "source",
  "keywords",
  "target_channels",
  "rationale",
  "score",
  "status",
  "content_ids",
  "created_by",
  "created_at",
  "ext_1"
);
CREATE TABLE IF NOT EXISTS "competitors" (
  "key" TEXT PRIMARY KEY,
  "competitor_id",
  "brand",
  "name",
  "channel",
  "handle_or_url",
  "snapshot_date",
  "followers",
  "posts_30d",
  "top_post_url",
  "top_post_title",
  "top_post_metric",
  "note",
  "ext_1"
);
CREATE TABLE IF NOT EXISTS "keywords" (
  "key" TEXT PRIMARY KEY,
  "brand",
  "keyword",
  "snapshot_date",
  "volume_pc",
  "volume_mobile",
  "competition",
  "doc_count",
  "note",
  "ext_1"
);
CREATE TABLE IF NOT EXISTS "config" (
  "key" TEXT PRIMARY KEY,
  "value",
  "note"
);
CREATE TABLE IF NOT EXISTS "_sync" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "run_at",
  "source",
  "brand",
  "status",
  "rows_daily",
  "rows_contents",
  "rows_metrics",
  "message"
);

CREATE INDEX IF NOT EXISTS idx_daily_date ON "channel_daily" ("date");
CREATE INDEX IF NOT EXISTS idx_metrics_content ON "content_metrics" ("content_id");
CREATE INDEX IF NOT EXISTS idx_contents_pub ON "contents" ("published_at");
