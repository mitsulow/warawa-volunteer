"""10年前のわらわ〜ボランティア写真アルバムを、さやかさん名義で掲示板の投稿として登録する（1回だけ）。
デスクトップ/わらわ～ボランティア の o0*.jpg（1〜4.png と ChatGPT画像・動画は除外）を full(1600)/thumb(480) にしてStorageへ。
"""
import glob
import io
import json
import os
import time
import urllib.request

from PIL import Image, ImageOps

REF = "dmixilrcxiofanwfhxfq"
SAYAKA = "ba38cfa3-d9ba-43dc-955a-3fa767396fe9"
FOLDER = "C:/Users/waras/OneDrive/デスクトップ/わらわ～ボランティア"
BODY = "10年前のわらわ〜ボランティアの写真が出てきました。今回も多くの笑顔に出会えますように。"


def env(path, key):
    for line in open(os.path.expanduser(path), encoding="utf-8"):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("missing " + key)


def http(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


mgmt = env("~/.rakuichi-env", "SUPABASE_ACCESS_TOKEN")
st, body = http(f"https://api.supabase.com/v1/projects/{REF}/api-keys?reveal=true",
                headers={"Authorization": f"Bearer {mgmt}", "User-Agent": "warawa/1.0"})
service = next(k["api_key"] for k in json.loads(body) if k.get("name") == "service_role")
H = {"apikey": service, "Authorization": f"Bearer {service}"}

files = sorted(glob.glob(os.path.join(FOLDER, "o0*.jpg")))
print("photos:", len(files))


def resize_jpeg(path, max_w, q):
    im = Image.open(path)
    im = ImageOps.exif_transpose(im).convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=q, optimize=True)
    return buf.getvalue()


fulls, thumbs = [], []
stamp = int(time.time() * 1000)
for i, f in enumerate(files):
    pairs = []
    for name, w, q in (("full", 1600, 82), ("thumb", 480, 78)):
        data = resize_jpeg(f, w, q)
        p = f"{SAYAKA}/{stamp + i}-{name}.jpg"
        st, res = http(f"https://{REF}.supabase.co/storage/v1/object/photos/{p}", data=data,
                       headers={**H, "Content-Type": "image/jpeg", "cache-control": "31536000", "x-upsert": "true"}, method="POST")
        if st not in (200, 201):
            raise SystemExit(f"upload failed {st} {res[:200]}")
        pairs.append(f"https://{REF}.supabase.co/storage/v1/object/public/photos/{p}")
    fulls.append(pairs[0])
    thumbs.append(pairs[1])
    print(i + 1, os.path.basename(f), "ok")

row = {"scope": "board", "user_id": SAYAKA, "body": BODY, "image_url": fulls[0], "image_urls": fulls, "thumb_urls": thumbs}
st, res = http(f"https://{REF}.supabase.co/rest/v1/board_messages", data=json.dumps(row).encode(),
               headers={**H, "Content-Type": "application/json", "Prefer": "return=representation"}, method="POST")
print("insert", st, res[:200])
