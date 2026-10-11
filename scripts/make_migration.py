"""schema/sheet-schema.json → migrations/0001_init.sql (Cloudflare D1 테이블 생성 SQL). 사용: python3 scripts/make_migration.py"""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
schema = json.load(open(root / 'schema/sheet-schema.json', encoding='utf-8'))
PK = {'contents': 'content_id', 'topics': 'topic_id'}   # 그 외 탭은 'key' 열이 기본키 (_sync 제외)
out = ['-- 자동 생성 파일: scripts/make_migration.py 로 만들었습니다. Cloudflare D1 콘솔에 붙여넣어 실행하세요.', '']
for tab, spec in schema.items():
    cols = [c[0] for c in spec['columns']]
    lines = []
    if tab == '_sync': lines.append('  "id" INTEGER PRIMARY KEY AUTOINCREMENT')
    pk = PK.get(tab, 'key') if tab != '_sync' else None
    for c in cols:
        lines.append(f'  "{c}" TEXT PRIMARY KEY' if c == pk else f'  "{c}"')
    out.append(f'CREATE TABLE IF NOT EXISTS "{tab}" (\n' + ',\n'.join(lines) + '\n);')
out += ['', 'CREATE INDEX IF NOT EXISTS idx_daily_date ON "channel_daily" ("date");', 'CREATE INDEX IF NOT EXISTS idx_metrics_content ON "content_metrics" ("content_id");', 'CREATE INDEX IF NOT EXISTS idx_contents_pub ON "contents" ("published_at");', '']
(root / 'migrations').mkdir(exist_ok=True)
(root / 'migrations/0001_init.sql').write_text('\n'.join(out), encoding='utf-8'); print('saved migrations/0001_init.sql')
