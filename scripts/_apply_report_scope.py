"""report_scope.sql を1文ずつ適用（pg8000は複文不可のため）。冪等: 既適用ならスキップ表示"""
import re
import sys

sys.path.insert(0, "scripts")
from dbpg import connect  # noqa: E402

sql = open("scripts/report_scope.sql", encoding="utf-8").read()
# コメント行を除去して ; で分割（本文に;を含む文はないので単純分割で足りる）
body = "\n".join(l for l in sql.splitlines() if not l.strip().startswith("--"))
stmts = [s.strip() for s in body.split(";") if s.strip()]

con = connect()
try:
    for s in stmts:
        head = re.sub(r"\s+", " ", s)[:70]
        try:
            con.run(s)
            print("OK :", head)
        except Exception as e:
            msg = str(e)
            if "already exists" in msg or "does not exist" in msg:
                print("SKIP:", head, "|", msg.splitlines()[0][:80])
            else:
                raise
finally:
    con.close()
print("done")
