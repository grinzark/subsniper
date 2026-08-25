#!/usr/bin/env python3
"""
SubSniper — generate-icon.py
Generates the extension icons (16/48/128) plus a 1024 master from a single
programmatic design, so the icon can always be regenerated.

Design language:
  • Dark rounded-rect background (modern app-icon style).
  • Orange (Reddit-adjacent) crosshair / target = "sniping".
  • A small chat-bubble dot on the reticle = "a lead / a reply".

Run:  python3 assets/generate-icon.py
Requires Pillow.
"""
import os
from PIL import Image, ImageDraw

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
SIZES = [16, 48, 128]
MASTER = 1024

# Palette
BG_TOP = (26, 28, 34, 255)      # near-black charcoal
BG_BOT = (12, 13, 17, 255)
ORANGE = (255, 84, 20, 255)     # SubSniper accent
ORANGE_2 = (255, 138, 0, 255)
WHITE = (255, 255, 255, 255)
BUBBLE = (255, 255, 255, 255)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))


def rounded_rect_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def vertical_gradient(size, top, bot):
    grad = Image.new("RGBA", (size, size), top)
    d = ImageDraw.Draw(grad)
    for y in range(size):
        d.line([(0, y), (size, y)], fill=lerp(top, bot, y / max(1, size - 1)))
    return grad


def build_master(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Background: gradient clipped to a rounded rect.
    radius = int(size * 0.225)
    bg = vertical_gradient(size, BG_TOP, BG_BOT)
    mask = rounded_rect_mask(size, radius)
    img.paste(bg, (0, 0), mask)

    d = ImageDraw.Draw(img)
    cx = cy = size / 2

    # Subtle inner glow ring behind the reticle.
    glow_r = size * 0.34
    d.ellipse([cx - glow_r, cy - glow_r, cx + glow_r, cy + glow_r],
              fill=(255, 84, 20, 26))

    # Outer target ring (orange).
    ring_r = size * 0.30
    ring_w = max(2, int(size * 0.052))
    d.ellipse([cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
              outline=ORANGE, width=ring_w)

    # Crosshair ticks (four), leaving a gap around the ring.
    tick_out = size * 0.44
    tick_in = size * 0.345
    tick_w = max(2, int(size * 0.05))
    for (dx, dy) in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
        x1, y1 = cx + dx * tick_in, cy + dy * tick_in
        x2, y2 = cx + dx * tick_out, cy + dy * tick_out
        d.line([(x1, y1), (x2, y2)], fill=ORANGE_2, width=tick_w)

    # Center filled dot (the "hit").
    dot_r = size * 0.072
    d.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=ORANGE)

    # Small chat-bubble in the upper-right quadrant of the reticle = "lead".
    bw, bh = size * 0.20, size * 0.15
    bx = cx + size * 0.085
    by = cy - size * 0.235
    d.rounded_rectangle([bx, by, bx + bw, by + bh],
                        radius=size * 0.045, fill=BUBBLE)
    # Bubble tail.
    tail = [(bx + bw * 0.28, by + bh),
            (bx + bw * 0.28, by + bh + size * 0.05),
            (bx + bw * 0.52, by + bh)]
    d.polygon(tail, fill=BUBBLE)
    # Three dots inside the bubble.
    ddot_r = size * 0.017
    for k in range(3):
        ddx = bx + bw * (0.28 + 0.22 * k)
        ddy = by + bh * 0.5
        d.ellipse([ddx - ddot_r, ddy - ddot_r, ddx + ddot_r, ddy + ddot_r],
                  fill=ORANGE)

    return img


def main():
    master = build_master(MASTER)
    master.save(os.path.join(OUT_DIR, "icon.png"))
    master.save(os.path.join(OUT_DIR, "icon1024.png"))
    for s in SIZES:
        resized = master.resize((s, s), Image.LANCZOS)
        resized.save(os.path.join(OUT_DIR, f"icon{s}.png"))
        print(f"wrote icon{s}.png")
    print("wrote icon.png (1024 master)")


if __name__ == "__main__":
    main()
