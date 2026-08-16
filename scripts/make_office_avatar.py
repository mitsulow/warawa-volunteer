"""事務局アカウントのアイコン public/office-avatar.png (256px): オレンジの丸の中にワラエル + 「事務局」の文字。"""
from PIL import Image, ImageDraw, ImageFont

S = 256
SS = 4
big = S * SS
img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.ellipse([0, 0, big - 1, big - 1], fill=(217, 106, 26, 255))
m = int(big * 0.05)
d.ellipse([m, m, big - 1 - m, big - 1 - m], fill=(255, 246, 232, 255))

wa = Image.open("public/waraeru-v2.png").convert("RGBA")
tw = int(big * 0.56)
th = int(tw * wa.height / wa.width)
wa = wa.resize((tw, th), Image.LANCZOS)
img.paste(wa, ((big - tw) // 2, int(big * 0.13)), wa)

# 下部に帯 + 「事務局」
band_top = int(big * 0.66)
band = Image.new("RGBA", (big, big), (0, 0, 0, 0))
bd = ImageDraw.Draw(band)
bd.rectangle([0, band_top, big, band_top + int(big * 0.2)], fill=(217, 106, 26, 255))
# 丸でマスク
mask = Image.new("L", (big, big), 0)
ImageDraw.Draw(mask).ellipse([m, m, big - 1 - m, big - 1 - m], fill=255)
img.paste(band, (0, 0), Image.composite(band, Image.new("RGBA", (big, big), (0, 0, 0, 0)), mask))

font = ImageFont.truetype("C:/Windows/Fonts/YuGothB.ttc", int(big * 0.13))
text = "事務局"
bbox = d.textbbox((0, 0), text, font=font)
tw2 = bbox[2] - bbox[0]
th2 = bbox[3] - bbox[1]
d.text(((big - tw2) / 2 - bbox[0], band_top + (int(big * 0.2) - th2) / 2 - bbox[1]), text, font=font, fill=(255, 255, 255, 255))

img = img.resize((S, S), Image.LANCZOS)
img.save("public/office-avatar.png", optimize=True)
print("saved")
