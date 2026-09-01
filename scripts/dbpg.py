"""Postgres 直接続で SQL を実行する小道具（Management API トークン失効時の代替）。
使い方: python scripts/dbpg.py "select 1"  または  python scripts/dbpg.py -f file.sql
接続: Supabase pooler(セッションモード5432・IPv4) / パスワードは ~/.warawa-env の SUPABASE_DB_PASS
"""
import os
import sys

import pg8000.native

REF = "dmixilrcxiofanwfhxfq"
HOSTS = [
    "aws-0-ap-northeast-1.pooler.supabase.com",
    "aws-1-ap-northeast-1.pooler.supabase.com",
]


def password() -> str:
    for line in open(os.path.expanduser("~/.warawa-env"), encoding="utf-8"):
        if line.startswith("SUPABASE_DB_PASS="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("no db pass")


def connect():
    last = None
    for host in HOSTS:
        try:
            return pg8000.native.Connection(
                user=f"postgres.{REF}", password=password(), host=host, port=5432,
                database="postgres", ssl_context=True, timeout=15,
            )
        except Exception as e:  # 別リージョン表記へフォールバック
            last = e
    raise SystemExit(f"connect failed: {last}")


def main():
    sql = open(sys.argv[2], encoding="utf-8").read() if sys.argv[1] == "-f" else sys.argv[1]
    con = connect()
    try:
        rows = con.run(sql)
        cols = [c["name"] for c in (con.columns or [])]
        if cols:
            print("\t".join(cols))
            for r in rows or []:
                print("\t".join("" if v is None else str(v) for v in r))
        print(f"-- OK ({con.row_count} rows)")
    finally:
        con.close()


if __name__ == "__main__":
    main()
