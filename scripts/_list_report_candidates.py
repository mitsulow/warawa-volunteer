"""掲示板(scope=board)からオレンジ軍団(現地入りconfirmed)+管理者の投稿を列挙する。
現地報告タブへ移す候補選び用。service role で読むだけ(変更なし)。
"""
import json
import os
import urllib.request

SUPABASE_URL = "https://dmixilrcxiofanwfhxfq.supabase.co"


def key() -> str:
    for line in open(os.path.expanduser("~/.warawa-env"), encoding="utf-8"):
        if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("no service key")


def get(path: str):
    k = key()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": k, "Authorization": f"Bearer {k}", "User-Agent": "warawa-volunteer/1.0"},
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


# オレンジ軍団 = body offer が confirmed のユーザー
orange = {o["user_id"] for o in get("offers?kind=eq.body&status=eq.confirmed&select=user_id")}
admins = {a["user_id"] for a in get("admins?select=user_id")}
who = orange | admins

rows = get(
    "board_messages?scope=eq.board&select=id,user_id,body,image_urls,created_at,pinned_at,"
    "profiles(display_name,member_no)&order=created_at.desc&limit=200"
)
print(f"オレンジ軍団{len(orange)}人+管理者{len(admins)}人 / 掲示板直近{len(rows)}件中の候補:\n")
for r in rows:
    if r["user_id"] not in who:
        continue
    p = r.get("profiles") or {}
    body = (r.get("body") or "").replace("\n", " ")[:60]
    n = len(r.get("image_urls") or [])
    pin = "📌" if r.get("pinned_at") else "  "
    print(f"{pin} {r['created_at'][:16]} No.{p.get('member_no')} {p.get('display_name')} 写真{n}枚 id={r['id'][:8]}")
    print(f"     {body}")
