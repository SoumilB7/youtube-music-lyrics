"""Generates the extension icons (pure stdlib, no Pillow needed)."""
import struct, zlib, os

def png(path, size, pad=0):
    """pad: transparent margin in px on each side (the 128px store icon wants 16)."""
    ss = 4  # supersampling
    S = (size - 2 * pad) * ss
    P = pad * ss
    r = S * 0.22  # corner radius
    bars = [(0.24, 0.80, 0.30), (0.24, 0.66, 0.50), (0.24, 0.52, 0.70)]  # x0, x1, y (fractions)
    bar_h = 0.085
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    x, y = px * ss + sx + 0.5 - P, py * ss + sy + 0.5 - P
                    if not (0 <= x < S and 0 <= y < S):
                        continue
                    # rounded square mask
                    cx = min(max(x, r), S - r); cy = min(max(y, r), S - r)
                    if (x - cx) ** 2 + (y - cy) ** 2 > r * r:
                        continue
                    t = (x + y) / (2 * S)  # diagonal gradient red -> magenta
                    col = (int(255 - 25 * t), int(40 + 10 * t), int(70 + 110 * t))
                    fx, fy = x / S, y / S
                    for i, (x0, x1, by) in enumerate(bars):
                        if x0 <= fx <= x1 and abs(fy - by) <= bar_h / 2:
                            a = 1.0 if i == 1 else 0.6
                            col = tuple(int(c * (1 - a) + 255 * a) for c in col)
                    acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2]; acc[3] += 255
            n = ss * ss
            alpha = acc[3] // n
            if alpha:
                k = acc[3] / 255
                row += bytes([int(acc[0] / k), int(acc[1] / k), int(acc[2] / k), alpha])
            else:
                row += bytes(4)
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) \
        + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(data)

out = os.path.join(os.path.dirname(__file__), '..', 'icons')
for s in (16, 32, 48):
    png(os.path.join(out, f'icon{s}.png'), s)
# Chrome Web Store guidance: 128x128 canvas, 96x96 artwork, 16px transparent padding.
png(os.path.join(out, 'icon128.png'), 128, pad=16)
print('ok')
