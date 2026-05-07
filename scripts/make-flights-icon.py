"""
Generate a clean modern flights app icon: 512x512, blue gradient background
with a white airplane silhouette centered. Output: public/icons/flights.png
"""
from PIL import Image, ImageDraw
from pathlib import Path
import math

SIZE = 512
OUT = Path(__file__).parent.parent / "public" / "icons" / "flights.png"

# ── Background: vertical-ish gradient, top color → bottom color ──────────
TOP    = (52, 144, 255)   # bright sky blue
BOTTOM = (14, 90, 200)    # deeper blue

img = Image.new("RGB", (SIZE, SIZE), TOP)
px = img.load()
for y in range(SIZE):
    t = y / (SIZE - 1)
    # Slight ease-out so most of the icon is the brighter top color
    t = 1 - (1 - t) ** 1.3
    r = round(TOP[0] + (BOTTOM[0] - TOP[0]) * t)
    g = round(TOP[1] + (BOTTOM[1] - TOP[1]) * t)
    b = round(TOP[2] + (BOTTOM[2] - TOP[2]) * t)
    for x in range(SIZE):
        px[x, y] = (r, g, b)

# ── Airplane: simple, recognizable, slightly tilted up-right ─────────────
# Hand-tuned polygon points, then rotate the whole thing by ~30° around center.
# Coordinates are pre-rotation, centered on (0,0); +x = right, +y = down.
# A classic paper-plane / iOS-Mail-arrow shape works great at this scale.
plane_points = [
    (-180,   0),   # tail tip (rear)
    ( -40, -40),   # rear-top wing
    ( 200, -130),  # nose
    ( 200,  130),  # nose (mirrored)
    ( -40,  40),   # rear-bottom wing
]

# We want a more airplane-y silhouette than a paper plane: top-down view of a
# jet — fuselage + swept wings + tail. Define it as a few polygons.
def jet_polygons():
    # All coords relative to center, +x = right, +y = down.
    # Fuselage (long thin pill)
    fuse = [
        ( 200,  -8), ( 220,  0), ( 200,   8),     # nose cone
        (-160,  20), (-180,  18),                  # rear-bottom
        (-180, -18), (-160, -20),                  # rear-top
    ]
    # Main swept wings (single polygon spanning both sides)
    wings = [
        (  60, -16),    # wing root, top
        ( -40, -160),   # left wingtip
        ( -90, -160),
        (-100,  -16),   # wing root rear, top
        (-100,   16),   # wing root rear, bottom
        ( -90,  160),   # right wingtip
        ( -40,  160),
        (  60,  16),
    ]
    # Tail fins at rear
    tail = [
        (-150, -10),
        (-200, -70),
        (-220, -70),
        (-180,  -8),
        (-180,   8),
        (-220,  70),
        (-200,  70),
        (-150,  10),
    ]
    return [fuse, wings, tail]

# Render onto a transparent overlay so we can rotate it cleanly.
overlay = Image.new("RGBA", (SIZE * 2, SIZE * 2), (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)
cx, cy = SIZE, SIZE  # center of overlay
WHITE = (255, 255, 255, 255)

for poly in jet_polygons():
    pts = [(cx + x, cy + y) for (x, y) in poly]
    draw.polygon(pts, fill=WHITE)

# Rotate the overlay so the plane points up-right at ~30°
rotated = overlay.rotate(30, resample=Image.BICUBIC, center=(cx, cy))

# Crop the overlay back down and paste onto background
left = cx - SIZE // 2
top  = cy - SIZE // 2
plane_layer = rotated.crop((left, top, left + SIZE, top + SIZE))

# Slight downscale of the plane so it doesn't fill the whole tile
SCALE = 0.62
sw = int(SIZE * SCALE)
plane_small = plane_layer.resize((sw, sw), Image.LANCZOS)

# Composite onto background, centered
bg = img.convert("RGBA")
offset = ((SIZE - sw) // 2, (SIZE - sw) // 2)
bg.alpha_composite(plane_small, dest=offset)

# Save
OUT.parent.mkdir(parents=True, exist_ok=True)
bg.convert("RGB").save(OUT, "PNG", optimize=True)
print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
