"""通知を開いた時の大アイコン public/notify-icon-256.png を生成。
Androidは円形にトリミングして出すので、最初から「オレンジの丸 + ワラエル」で作る。
"""
from PIL import Image, ImageDraw

S = 256
SS = 4  # スーパーサンプリングで円の縁をなめらかに
big = S * SS
img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
# 外周のオレンジリング → 内側はクリーム（体のオレンジと被らないように）
d.ellipse([0, 0, big - 1, big - 1], fill=(217, 106, 26, 255))
m = int(big * 0.05)
d.ellipse([m, m, big - 1 - m, big - 1 - m], fill=(255, 246, 232, 255))

wa = Image.open("public/waraeru-v2.png").convert("RGBA")
tw = int(big * 0.66)
th = int(tw * wa.height / wa.width)
wa = wa.resize((tw, th), Image.LANCZOS)
img.paste(wa, ((big - tw) // 2, (big - th) // 2 + int(big * 0.02)), wa)

img = img.resize((S, S), Image.LANCZOS)
img.save("public/notify-icon-256.png", optimize=True)
print("saved")
