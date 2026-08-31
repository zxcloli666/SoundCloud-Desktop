"""Turn the approved Sonveil S-note raster into flat, reproducible brand masters.

The source image is AI-rendered, so this script removes its black/noisy backdrop,
normalises the two brand colours and automatically traces the resulting masks.
"""

from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


CORAL = "#D96D3D"
WHITE = "#FFFFFF"
BLACK = "#000000"


def colour_masks(image: Image.Image) -> tuple[Image.Image, Image.Image]:
    rgb = image.convert("RGB")
    coral = Image.new("L", rgb.size)
    white = Image.new("L", rgb.size)
    coral_pixels = coral.load()
    white_pixels = white.load()
    source = rgb.load()

    for y in range(rgb.height):
        for x in range(rgb.width):
            red, green, blue = source[x, y]
            is_white = red >= 155 and green >= 155 and blue >= 155 and max(
                abs(red - green), abs(red - blue), abs(green - blue)
            ) <= 48
            is_coral = red >= 90 and red - green >= 30 and red - blue >= 42
            if is_white:
                white_pixels[x, y] = 255
            elif is_coral:
                coral_pixels[x, y] = 255

    coral = coral.filter(ImageFilter.MedianFilter(3))
    white = white.filter(ImageFilter.MedianFilter(3))
    return coral, white


def crop_masks(coral: Image.Image, white: Image.Image) -> tuple[Image.Image, Image.Image]:
    silhouette = ImageChops.lighter(coral, white)
    bounds = silhouette.getbbox()
    if bounds is None:
        raise RuntimeError("No Sonveil mark was detected in the supplied image")

    left, top, right, bottom = bounds
    pad = max(8, round(max(right - left, bottom - top) * 0.025))
    crop = (
        max(0, left - pad),
        max(0, top - pad),
        min(coral.width, right + pad),
        min(coral.height, bottom + pad),
    )
    coral_crop = coral.crop(crop)
    white_crop = white.crop(crop)
    silhouette_crop = ImageChops.lighter(coral_crop, white_crop)
    return silhouette_crop, white_crop


Point = tuple[int, int]


def direction(start: Point, end: Point) -> int:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    if dx > 0:
        return 0
    if dy > 0:
        return 1
    if dx < 0:
        return 2
    return 3


def trace_loops(mask: Image.Image) -> list[list[Point]]:
    binary = mask.point(lambda value: 1 if value >= 128 else 0)
    pixels = binary.load()
    width, height = binary.size
    edges: dict[Point, list[Point]] = defaultdict(list)

    for y in range(height):
        for x in range(width):
            if not pixels[x, y]:
                continue
            if y == 0 or not pixels[x, y - 1]:
                edges[(x, y)].append((x + 1, y))
            if x == width - 1 or not pixels[x + 1, y]:
                edges[(x + 1, y)].append((x + 1, y + 1))
            if y == height - 1 or not pixels[x, y + 1]:
                edges[(x + 1, y + 1)].append((x, y + 1))
            if x == 0 or not pixels[x - 1, y]:
                edges[(x, y + 1)].append((x, y))

    loops: list[list[Point]] = []
    while edges:
        start = min(edges)
        current = start
        previous_direction: int | None = None
        loop = [start]

        while True:
            candidates = edges.get(current)
            if not candidates:
                break
            if previous_direction is None or len(candidates) == 1:
                next_point = candidates[0]
            else:
                priorities = {1: 0, 0: 1, 3: 2, 2: 3}
                next_point = min(
                    candidates,
                    key=lambda point: priorities[
                        (direction(current, point) - previous_direction) % 4
                    ],
                )
            candidates.remove(next_point)
            if not candidates:
                del edges[current]
            previous_direction = direction(current, next_point)
            current = next_point
            if current == start:
                break
            loop.append(current)

        if len(loop) >= 8 and abs(polygon_area(loop)) >= 24:
            loops.append(loop)
    return loops


def polygon_area(points: list[Point]) -> float:
    return 0.5 * sum(
        x1 * y2 - x2 * y1
        for (x1, y1), (x2, y2) in zip(points, points[1:] + points[:1])
    )


def point_line_distance(point: Point, start: Point, end: Point) -> float:
    if start == end:
        return math.dist(point, start)
    x, y = point
    x1, y1 = start
    x2, y2 = end
    numerator = abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1)
    return numerator / math.hypot(y2 - y1, x2 - x1)


def rdp(points: list[Point], tolerance: float) -> list[Point]:
    if len(points) <= 2:
        return points
    start, end = points[0], points[-1]
    distances = [point_line_distance(point, start, end) for point in points[1:-1]]
    if not distances:
        return [start, end]
    maximum = max(distances)
    if maximum <= tolerance:
        return [start, end]
    index = distances.index(maximum) + 1
    return rdp(points[: index + 1], tolerance)[:-1] + rdp(points[index:], tolerance)


def simplify_closed(points: list[Point], tolerance: float = 0.35) -> list[Point]:
    left_index = min(range(len(points)), key=lambda index: (points[index][0], points[index][1]))
    right_index = max(range(len(points)), key=lambda index: (points[index][0], points[index][1]))
    if left_index > right_index:
        left_index, right_index = right_index, left_index
    first = points[left_index : right_index + 1]
    second = points[right_index:] + points[: left_index + 1]
    simplified = rdp(first, tolerance)[:-1] + rdp(second, tolerance)[:-1]
    return simplified if len(simplified) >= 3 else points


def trace_path(mask: Image.Image) -> tuple[str, int, int]:
    max_dimension = 960
    scale = min(1.0, max_dimension / max(mask.size))
    trace_size = (
        max(1, round(mask.width * scale)),
        max(1, round(mask.height * scale)),
    )
    trace_mask = mask.resize(trace_size, Image.Resampling.LANCZOS)
    loops = [simplify_closed(loop) for loop in trace_loops(trace_mask)]
    commands: list[str] = []
    for loop in loops:
        commands.append(f"M {loop[0][0]} {loop[0][1]}")
        commands.extend(f"L {x} {y}" for x, y in loop[1:])
        commands.append("Z")
    return " ".join(commands), trace_size[0], trace_size[1]


def write_svg(mark_path: Path, app_icon_path: Path, silhouette: Image.Image, white: Image.Image) -> None:
    silhouette_path, width, height = trace_path(silhouette)
    white_path, white_width, white_height = trace_path(white)
    if (white_width, white_height) != (width, height):
        raise RuntimeError("Trace masks must share a coordinate system")

    mark_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="sonveil-mark-title">
  <title id="sonveil-mark-title">Sonveil</title>
  <path fill="{CORAL}" fill-rule="evenodd" d="{silhouette_path}"/>
  <path fill="{WHITE}" fill-rule="evenodd" d="{white_path}"/>
</svg>
'''
    mark_path.write_text(mark_svg, encoding="utf-8")

    scale = min(930 / height, 930 / width)
    target_width = width * scale
    target_height_actual = height * scale
    offset_x = (1024 - target_width) / 2
    offset_y = (1024 - target_height_actual) / 2
    transform = f"translate({offset_x:.3f} {offset_y:.3f}) scale({scale:.6f})"
    app_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-labelledby="sonveil-icon-title">
  <title id="sonveil-icon-title">Sonveil app icon</title>
  <rect width="1024" height="1024" fill="{BLACK}"/>
  <g transform="{transform}">
    <path fill="{CORAL}" fill-rule="evenodd" d="{silhouette_path}"/>
    <path fill="{WHITE}" fill-rule="evenodd" d="{white_path}"/>
  </g>
</svg>
'''
    app_icon_path.write_text(app_svg, encoding="utf-8")


def render_pngs(assets: Path, silhouette: Image.Image, white: Image.Image) -> None:
    canvas_size = 1024
    target_max = 930
    scale = min(target_max / silhouette.width, target_max / silhouette.height)
    size = (round(silhouette.width * scale), round(silhouette.height * scale))
    coral_alpha = silhouette.resize(size, Image.Resampling.LANCZOS)
    white_alpha = white.resize(size, Image.Resampling.LANCZOS)
    offset = ((canvas_size - size[0]) // 2, (canvas_size - size[1]) // 2)

    transparent = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    coral_layer = Image.new("RGBA", size, (217, 109, 61, 255))
    white_layer = Image.new("RGBA", size, (255, 255, 255, 255))
    coral_layer.putalpha(coral_alpha)
    white_layer.putalpha(white_alpha)
    transparent.alpha_composite(coral_layer, offset)
    transparent.alpha_composite(white_layer, offset)
    transparent.save(assets / "sonveil-logo-source.png", optimize=True)

    app_icon = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 255))
    app_icon.alpha_composite(coral_layer, offset)
    app_icon.alpha_composite(white_layer, offset)
    app_icon.save(assets / "sonveil-app-icon.png", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parents[1]
    assets = project_root / "src" / "assets"
    source = args.source.resolve()
    image = Image.open(source)
    coral, white = colour_masks(image)
    silhouette, white = crop_masks(coral, white)

    source_copy = assets / "sonveil-note-source.png"
    image.save(source_copy, optimize=True)
    write_svg(assets / "sonveil-mark.svg", assets / "sonveil-app-icon.svg", silhouette, white)
    render_pngs(assets, silhouette, white)

    manifest_path = assets / "sonveil-brand-manifest.json"
    manifest = {
        "name": "Sonveil",
        "sourceReferences": [source_copy.name],
        "masters": {
            "mark": {"file": "sonveil-mark.svg", "format": "vector"},
            "appIcon": {
                "file": "sonveil-app-icon.svg",
                "viewBox": "0 0 1024 1024",
                "background": BLACK,
            },
        },
        "palette": {
            "mark": CORAL,
            "innerWave": WHITE,
            "appIconBackground": BLACK,
        },
        "exports": {
            "script": "../../scripts/generate-brand-assets.ps1",
            "tauriDirectory": "../../src-tauri/icons",
            "maximumPng": 1024,
            "maximumIco": 256,
            "maximumIcns": 1024,
        },
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
