import sys
from PIL import Image, ImageDraw

def create_panel_icon(output_path):
    sizes = [16, 24, 32, 48, 64, 128, 256]
    images = []

    for size in sizes:
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        s = size / 32.0

        # Circle background
        margin = max(1, int(1 * s))
        draw.ellipse(
            [margin, margin, size - margin - 1, size - margin - 1],
            fill=(15, 23, 42, 255),  # #0f172a dark navy
            outline=(34, 211, 238, 255),  # #22d3ee neon cyan
            width=max(1, int(2 * s))
        )

        # Lightning bolt coordinates scaled from 32x32 design
        bolt_pts = [
            (int(18 * s), int(5 * s)),
            (int(9 * s),  int(17 * s)),
            (int(15 * s), int(17 * s)),
            (int(13 * s), int(27 * s)),
            (int(23 * s), int(14 * s)),
            (int(17 * s), int(14 * s)),
        ]
        draw.polygon(bolt_pts, fill=(245, 158, 11, 255)) # #f59e0b amber

        if size >= 32:
            inner_pts = [
                (int(17.5 * s), int(7 * s)),
                (int(11 * s),   int(16 * s)),
                (int(15.5 * s), int(16 * s)),
                (int(14 * s),   int(24 * s)),
                (int(21 * s),   int(14.5 * s)),
                (int(17 * s),   int(14.5 * s)),
            ]
            draw.polygon(inner_pts, fill=(254, 240, 138, 255))

        images.append(img)

    images[-1].save(
        output_path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=images[:-1]
    )
    print(f"Saved {output_path} successfully with sizes {sizes}")

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "icon.ico"
    create_panel_icon(out)
