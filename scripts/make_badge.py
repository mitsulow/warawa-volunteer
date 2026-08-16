"""Android通知のステータスバー用モノクロ小アイコン public/badge-96.png を生成。
白(不透明)=形・透明=抜き。ワラエルの体(オレンジ)+メガネ(緑)を白、帽子・目・口を透明の穴にする。
Chromeはアルファだけを使って単色で描くので、色は不要。
"""
from PIL import Image, ImageFilter

src = Image.open("public/waraeru-v2.png").convert("RGBA")
w, h = src.size
out = Image.new("LA", (w, h), (255, 0))
px = src.load()
op = out.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a < 128:
            continue
        # 黒(帽子・瞳)と赤(口)は穴。それ以外(体オレンジ・メガネ緑)は白
        is_dark = r < 60 and g < 60 and b < 60
        is_red = r > 200 and g < 80 and b < 80
        if is_dark or is_red:
            continue
        op[x, y] = (255, 255)

# 穴を少し太らせて小さく描画されても潰れないように（アルファを1回縮める）
alpha = out.getchannel("A").filter(ImageFilter.MinFilter(3))
out.putalpha(alpha)

# 正方形キャンバス(余白8%)に収めて96px
side = int(max(w, h) * 1.16)
canvas = Image.new("LA", (side, side), (255, 0))
canvas.paste(out, ((side - w) // 2, (side - h) // 2), out)
canvas = canvas.resize((96, 96), Image.LANCZOS)
canvas.convert("RGBA").save("public/badge-96.png", optimize=True)

# 確認用: 灰色地に載せたプレビュー
prev = Image.new("RGBA", (96 * 4, 96), (90, 90, 90, 255))
for i, s in enumerate((96, 48, 24, 96)):
    small = (out.convert("RGBA").resize((s, s), Image.LANCZOS) if i == 3 else canvas.convert("RGBA").resize((s, s), Image.LANCZOS))
    prev.paste(small, (i * 96 + (96 - s) // 2, (96 - s) // 2), small)
prev.save("scripts/badge-preview.png")
print("saved")
