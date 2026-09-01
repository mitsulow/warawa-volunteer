"""わらわ〜ボランティア DBバックアップ。
public スキーマの全テーブルを JSON で
  デスクトップ/わらわ〜バックアップ/YYYY-MM-DD/<table>.json
に書き出す（Supabase無料プランには自動バックアップが無いため）。
「バックアップ取って」で手動実行、またはタスクスケジューラで毎晩自動。
30日より古い日付フォルダは自動で消す。
使い方: python scripts/backup.py
"""
import datetime as dt
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dbpg import connect  # noqa: E402  (Management APIトークン失効のためPostgres直接続に切替 2026-09-01)

DEST_ROOT = os.path.join(os.path.expanduser("~"), "OneDrive", "デスクトップ", "わらわ〜バックアップ")
KEEP_DAYS = 30
CHUNK = 2000

_CON = None


def sql(q: str):
    global _CON
    if _CON is None:
        _CON = connect()
    rows = _CON.run(q)
    cols = [c["name"] for c in (_CON.columns or [])]
    return [dict(zip(cols, r)) for r in (rows or [])]


def main():
    today = dt.date.today().isoformat()
    dest = os.path.join(DEST_ROOT, today)
    os.makedirs(dest, exist_ok=True)

    tables = [r["table_name"] for r in sql(
        "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1")]
    summary = {}
    for t in tables:
        rows = []
        offset = 0
        while True:
            part = sql(f'select * from public."{t}" order by 1 limit {CHUNK} offset {offset}')
            rows.extend(part)
            if len(part) < CHUNK:
                break
            offset += CHUNK
        with open(os.path.join(dest, f"{t}.json"), "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=1, default=str)
        summary[t] = len(rows)
        print(f"{t}: {len(rows)}")

    # auth ユーザー（メール・作成日だけ）: 寄付者連絡や復旧の手がかり
    users = sql("select id, email, created_at, last_sign_in_at from auth.users order by created_at")
    with open(os.path.join(dest, "_auth_users.json"), "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=1, default=str)
    summary["_auth_users"] = len(users)

    # Storage(photos) の一覧（URL復元用。ファイル本体はR2/Storageに残る）
    objs = sql("select name, bucket_id, created_at, metadata->>'size' as size from storage.objects order by created_at")
    with open(os.path.join(dest, "_storage_objects.json"), "w", encoding="utf-8") as f:
        json.dump(objs, f, ensure_ascii=False, indent=1, default=str)
    summary["_storage_objects"] = len(objs)

    with open(os.path.join(dest, "_summary.json"), "w", encoding="utf-8") as f:
        json.dump({"date": today, "taken_at": dt.datetime.now().isoformat(timespec="seconds"), "counts": summary}, f, ensure_ascii=False, indent=1)

    # 古いバックアップの掃除
    cutoff = dt.date.today() - dt.timedelta(days=KEEP_DAYS)
    for name in os.listdir(DEST_ROOT):
        p = os.path.join(DEST_ROOT, name)
        try:
            d = dt.date.fromisoformat(name)
        except ValueError:
            continue
        if os.path.isdir(p) and d < cutoff:
            shutil.rmtree(p, ignore_errors=True)
            print("removed old", name)

    print("done ->", dest)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # ログに残す
        os.makedirs(DEST_ROOT, exist_ok=True)
        with open(os.path.join(DEST_ROOT, "_error.log"), "a", encoding="utf-8") as f:
            f.write(f"{dt.datetime.now().isoformat(timespec='seconds')} {e!r}\n")
        print("ERROR", e, file=sys.stderr)
        sys.exit(1)
