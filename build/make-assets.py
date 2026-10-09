"""Draws the Pelagix app icon and derives the logo / game-icon assets. Usage: python -I build/make-assets.py <project root> [icon|logo|games|all]"""
import shutil
import struct
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgradient(w, h, stops):
    """Vertical multi-stop gradient. stops: [(position 0..1, (r, g, b)), ...]"""
    column = Image.new('RGB', (1, h))
    data = []
    for y in range(h):
        t = y / max(h - 1, 1)
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                data.append(lerp(c0, c1, (t - t0) / (t1 - t0) if t1 > t0 else 0))
                break
        else:
            data.append(stops[-1][1])
    column.putdata(data)
    return column.resize((w, h), Image.NEAREST)


def circle(draw, cx, cy, r, **kw):
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), **kw)


def solid(n, colour, mask):
    layer = Image.new('RGBA', (n, n), colour + (0,))
    layer.putalpha(mask)
    return layer


def render(n, p):
    """Draws the icon on an n x n canvas using the proportions in p (fractions of n)."""
    def px(v):
        return v * n

    icon = Image.new('RGBA', (n, n), (0, 0, 0, 0))

    # --- tile ---------------------------------------------------------------------------------
    inset, radius = px(p['tile_inset']), px(p['tile_radius'])
    tile_mask = Image.new('L', (n, n), 0)
    ImageDraw.Draw(tile_mask).rounded_rectangle((inset, inset, n - 1 - inset, n - 1 - inset), radius=radius, fill=255)
    tile = vgradient(n, n, [(0.0, rgb('#040b22')), (0.38, rgb('#0a2a72')), (0.74, rgb('#1173e0')), (1.0, rgb('#38b6ff'))]).convert('RGBA')

    # soft light pooled behind the ball so it separates from the gradient
    cx, cy, r = px(0.5), px(p['ball_cy']), px(p['ball_r'])
    if p['halo']:
        halo = Image.new('L', (n, n), 0)
        circle(ImageDraw.Draw(halo), cx, cy, r * 1.12, fill=p['halo'])
        halo = halo.filter(ImageFilter.GaussianBlur(px(0.055)))
        tile = Image.alpha_composite(tile, solid(n, rgb('#6fe6ff'), halo))

    # cyan inner glow ring
    if p['ring_w']:
        ri, rw = px(p['ring_inset']), px(p['ring_w'])
        line = Image.new('L', (n, n), 0)
        ImageDraw.Draw(line).rounded_rectangle((ri, ri, n - 1 - ri, n - 1 - ri), radius=max(radius - (ri - inset), 1), outline=255, width=max(round(rw), 1))
        glow = line.filter(ImageFilter.GaussianBlur(px(p['ring_glow'])))
        tile = Image.alpha_composite(tile, solid(n, rgb('#46dcff'), glow.point(lambda v: min(255, int(v * p['ring_glow_gain'])))))
        tile = Image.alpha_composite(tile, solid(n, rgb('#a5f1ff'), line.point(lambda v: int(v * p['ring_alpha']))))

    # --- ball ---------------------------------------------------------------------------------
    navy = rgb('#081230')
    ball = Image.new('RGBA', (n, n), (0, 0, 0, 0))

    if p['shadow']:
        shadow = Image.new('L', (n, n), 0)
        circle(ImageDraw.Draw(shadow), cx, cy + px(0.022), r * 1.01, fill=p['shadow'])
        shadow = shadow.filter(ImageFilter.GaussianBlur(px(0.03)))
        ball = Image.alpha_composite(ball, solid(n, (2, 6, 24), shadow))

    outer = Image.new('L', (n, n), 0)
    circle(ImageDraw.Draw(outer), cx, cy, r, fill=255)
    ball = Image.alpha_composite(ball, solid(n, navy, outer))

    ri_ball = r - px(p['outline'])
    inner = Image.new('L', (n, n), 0)
    circle(ImageDraw.Draw(inner), cx, cy, ri_ball, fill=255)

    # red upper half
    top, bottom = cy - ri_ball, cy + ri_ball
    red = vgradient(n, n, [(0.0, rgb('#ff6a5c')), (top / n, rgb('#ff6a5c')), (cy / n, rgb('#d81f2f')), (1.0, rgb('#d81f2f'))]).convert('RGBA')
    upper = Image.new('L', (n, n), 0)
    ImageDraw.Draw(upper).rectangle((0, 0, n, cy), fill=255)
    ball = Image.alpha_composite(ball, solid_from(red, ImageChops.multiply(inner, upper)))

    # white lower half, shaded towards the bottom edge
    white = vgradient(n, n, [(0.0, rgb('#ffffff')), (cy / n, rgb('#ffffff')), (bottom / n, rgb('#c3d3ee')), (1.0, rgb('#c3d3ee'))]).convert('RGBA')
    lower = ImageChops.invert(upper)
    ball = Image.alpha_composite(ball, solid_from(white, ImageChops.multiply(inner, lower)))

    if p['shade']:
        # soft inner shadow along the lower-right edge gives the sphere its volume
        rim = Image.new('L', (n, n), 0)
        d = ImageDraw.Draw(rim)
        circle(d, cx, cy, ri_ball, fill=p['shade'])
        circle(d, cx - ri_ball * 0.10, cy - ri_ball * 0.13, ri_ball * 0.93, fill=0)
        rim = ImageChops.multiply(rim.filter(ImageFilter.GaussianBlur(px(0.022))), inner)
        ball = Image.alpha_composite(ball, solid(n, (22, 10, 44), rim))

    if p['gloss']:
        # crescent rim light hugging the upper-left edge, plus a small specular spot
        gloss = Image.new('L', (n, n), 0)
        d = ImageDraw.Draw(gloss)
        circle(d, cx, cy, ri_ball * 0.90, fill=p['gloss'])
        circle(d, cx + ri_ball * 0.085, cy + ri_ball * 0.105, ri_ball * 0.90, fill=0)
        fade = Image.new('L', (n, n), 0)
        circle(ImageDraw.Draw(fade), cx - ri_ball * 0.62, cy - ri_ball * 0.62, ri_ball * 0.62, fill=255)
        fade = fade.filter(ImageFilter.GaussianBlur(px(0.045)))
        gloss = ImageChops.multiply(gloss, fade).filter(ImageFilter.GaussianBlur(px(0.005)))
        spot = Image.new('L', (n, n), 0)
        ImageDraw.Draw(spot).ellipse((cx - ri_ball * 0.56, cy - ri_ball * 0.70, cx - ri_ball * 0.30, cy - ri_ball * 0.52), fill=min(255, int(p['gloss'] * 1.5)))
        spot = spot.rotate(32, center=(cx - ri_ball * 0.43, cy - ri_ball * 0.61), resample=Image.BICUBIC).filter(ImageFilter.GaussianBlur(px(0.007)))
        gloss = ImageChops.multiply(ImageChops.lighter(gloss, spot), ImageChops.multiply(inner, upper))
        ball = Image.alpha_composite(ball, solid(n, (255, 255, 255), gloss))

    # band
    bh = px(p['band'])
    band = Image.new('L', (n, n), 0)
    ImageDraw.Draw(band).rectangle((0, cy - bh, n, cy + bh), fill=255)
    ball = Image.alpha_composite(ball, solid(n, navy, ImageChops.multiply(band, outer)))

    # centre button: navy socket, cyan ring, white cap
    socket = Image.new('L', (n, n), 0)
    circle(ImageDraw.Draw(socket), cx, cy, px(p['btn_outer']), fill=255)
    ball = Image.alpha_composite(ball, solid(n, navy, socket))

    if p['btn_cyan']:
        cyan = Image.new('L', (n, n), 0)
        circle(ImageDraw.Draw(cyan), cx, cy, px(p['btn_cyan']), fill=255)
        if p['btn_glow']:
            glow = ImageChops.multiply(cyan.filter(ImageFilter.GaussianBlur(px(p['btn_glow']))), socket)
            ball = Image.alpha_composite(ball, solid(n, rgb('#35d6ff'), glow))
        ball = Image.alpha_composite(ball, solid_from(vgradient(n, n, [(0.0, rgb('#8ff2ff')), ((cy - px(p['btn_cyan'])) / n, rgb('#8ff2ff')), ((cy + px(p['btn_cyan'])) / n, rgb('#18b4f5')), (1.0, rgb('#18b4f5'))]).convert('RGBA'), cyan))

    cap = Image.new('L', (n, n), 0)
    circle(ImageDraw.Draw(cap), cx, cy, px(p['btn_white']), fill=255)
    cap_fill = vgradient(n, n, [(0.0, rgb('#ffffff')), ((cy - px(p['btn_white']) * 0.2) / n, rgb('#ffffff')), ((cy + px(p['btn_white'])) / n, rgb('#cfe0f7')), (1.0, rgb('#cfe0f7'))]).convert('RGBA')
    ball = Image.alpha_composite(ball, solid_from(cap_fill, cap))

    if p['btn_dot']:
        dot = Image.new('L', (n, n), 0)
        d = ImageDraw.Draw(dot)
        circle(d, cx, cy, px(p['btn_white']) * 0.58, outline=150, width=max(round(px(0.006)), 1))
        ball = Image.alpha_composite(ball, solid(n, rgb('#9fb6d8'), dot))

    tile = Image.alpha_composite(tile, ball)

    # hairline edge so the tile keeps its shape on dark backgrounds
    if p['edge']:
        edge = Image.new('L', (n, n), 0)
        ImageDraw.Draw(edge).rounded_rectangle((inset, inset, n - 1 - inset, n - 1 - inset), radius=radius, outline=p['edge'], width=max(round(px(0.006)), 1))
        tile = Image.alpha_composite(tile, solid(n, rgb('#7fd4ff'), edge))

    icon.paste(tile, (0, 0), tile_mask)
    return icon


def solid_from(image, mask):
    layer = image.copy()
    layer.putalpha(mask)
    return layer


FULL = dict(
    tile_inset=0.0, tile_radius=0.225, ring_inset=0.030, ring_w=0.0055, ring_glow=0.016, ring_glow_gain=1.25, ring_alpha=0.42,
    halo=78, edge=0, shadow=150, shade=58, gloss=120,
    ball_cy=0.5, ball_r=0.318, outline=0.036, band=0.031, btn_outer=0.112, btn_cyan=0.083, btn_glow=0.012, btn_white=0.064, btn_dot=True,
)
# Under ~48 px the fine detail turns to mush: bigger ball, heavier strokes, no ring.
SMALL = dict(
    tile_inset=0.0, tile_radius=0.21, ring_inset=0, ring_w=0, ring_glow=0, ring_glow_gain=0, ring_alpha=0,
    halo=70, edge=0, shadow=0, shade=0, gloss=0,
    ball_cy=0.5, ball_r=0.405, outline=0.068, band=0.056, btn_outer=0.165, btn_cyan=0, btn_glow=0, btn_white=0.088, btn_dot=False,
)
MEDIUM = dict(
    tile_inset=0.0, tile_radius=0.22, ring_inset=0.045, ring_w=0.016, ring_glow=0.02, ring_glow_gain=1.2, ring_alpha=0.5,
    halo=78, edge=0, shadow=110, shade=44, gloss=84,
    ball_cy=0.5, ball_r=0.345, outline=0.046, band=0.040, btn_outer=0.130, btn_cyan=0.094, btn_glow=0, btn_white=0.068, btn_dot=False,
)


def write_ico(path, images):
    """ICO with 32-bit BMP entries below 256 px and a PNG entry at 256 px (the layout Windows tools expect)."""
    blobs = []
    for im in images:
        w, h = im.size
        if w >= 256:
            buf = BytesIO()
            im.save(buf, format='PNG', optimize=True)
            blobs.append(buf.getvalue())
            continue
        bgra = im.transpose(Image.FLIP_TOP_BOTTOM).tobytes('raw', 'BGRA')
        row = ((w + 31) // 32) * 4
        alpha = im.getchannel('A').transpose(Image.FLIP_TOP_BOTTOM)
        mask = bytearray()
        for y in range(h):
            bits = bytearray(row)
            for x in range(w):
                if alpha.getpixel((x, y)) == 0:
                    bits[x // 8] |= 0x80 >> (x % 8)
            mask += bits
        header = struct.pack('<IiiHHIIiiII', 40, w, h * 2, 1, 32, 0, len(bgra) + len(mask), 0, 0, 0, 0)
        blobs.append(header + bgra + bytes(mask))
    out = struct.pack('<HHH', 0, 1, len(images))
    offset = 6 + 16 * len(images)
    for im, blob in zip(images, blobs):
        w, h = im.size
        out += struct.pack('<BBBBHHII', w % 256, h % 256, 0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
    Path(path).write_bytes(out + b''.join(blobs))


def make_icon(root):
    build = root / 'build'
    build.mkdir(exist_ok=True)
    master = render(4096, FULL).resize((1024, 1024), Image.LANCZOS)
    master.save(build / 'icon.png', optimize=True)
    medium = render(2048, MEDIUM)
    small = render(1024, SMALL)
    sizes = {
        256: master.resize((256, 256), Image.LANCZOS),
        128: master.resize((128, 128), Image.LANCZOS),
        64: medium.resize((64, 64), Image.LANCZOS),
        48: medium.resize((48, 48), Image.LANCZOS),
        32: small.resize((32, 32), Image.LANCZOS),
        24: small.resize((24, 24), Image.LANCZOS),
        16: small.resize((16, 16), Image.LANCZOS),
    }
    write_ico(build / 'icon.ico', [sizes[s] for s in (16, 24, 32, 48, 64, 128, 256)])
    public = root / 'src' / 'renderer' / 'public'
    public.mkdir(parents=True, exist_ok=True)
    sizes[256].save(public / 'icon.png', optimize=True)
    return sizes


def make_logo(root):
    assets = root / 'src' / 'renderer' / 'src' / 'assets'
    assets.mkdir(parents=True, exist_ok=True)
    logo = Image.open(root / 'logo.png').convert('RGBA')
    for name, width in (('logo.png', 1100), ('logo-small.png', 440)):
        height = round(logo.height * width / logo.width)
        logo.resize((width, height), Image.LANCZOS).save(assets / name, optimize=True)
        print(name, (width, height), (assets / name).stat().st_size, 'bytes')


def copy_games(root):
    dest = root / 'src' / 'renderer' / 'public' / 'games'
    dest.mkdir(parents=True, exist_ok=True)
    count = 0
    for src in sorted((root / 'games').glob('*.png')):
        shutil.copyfile(src, dest / src.name)
        count += 1
    print('copied', count, 'game icons')


if __name__ == '__main__':
    root = Path(sys.argv[1])
    what = sys.argv[2] if len(sys.argv) > 2 else 'all'
    if what in ('icon', 'all'):
        make_icon(root)
        print('icon written')
    if what in ('logo', 'all'):
        make_logo(root)
    if what in ('games', 'all'):
        copy_games(root)
