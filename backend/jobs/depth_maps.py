from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFilter
from transformers import pipeline

MODEL = "depth-anything/Depth-Anything-V2-Small-hf"
MENU_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "menu"
DEPTH_DIR = MENU_DIR / "depth"
EDGE_SOFTEN = 1.5
OPAQUE = 0.5
PHOTO_TYPES = {".png", ".webp"}


def device() -> str:
    return "mps" if torch.backends.mps.is_available() else "cpu"


def depth_for(estimator, photo: Image.Image) -> Image.Image:
    rgba = photo.convert("RGBA")
    alpha = np.asarray(rgba.getchannel("A"), dtype=np.float32) / 255.0
    flat = Image.new("RGB", rgba.size, (255, 255, 255))
    flat.paste(rgba, mask=rgba.getchannel("A"))

    raw = np.asarray(estimator(flat)["depth"].resize(rgba.size), dtype=np.float32)
    inside = raw[alpha > OPAQUE]
    low, high = (inside.min(), inside.max()) if inside.size else (0.0, 1.0)
    scaled = np.clip((raw - low) / max(high - low, 1e-6), 0.0, 1.0) * alpha

    image = Image.fromarray((scaled * 255).astype(np.uint8), mode="L")
    return image.filter(ImageFilter.GaussianBlur(EDGE_SOFTEN))


def main() -> None:
    estimator = pipeline("depth-estimation", model=MODEL, device=device())
    DEPTH_DIR.mkdir(exist_ok=True)

    photos = sorted(path for path in MENU_DIR.iterdir() if path.suffix.lower() in PHOTO_TYPES)
    for path in photos:
        with Image.open(path) as photo:
            depth_for(estimator, photo).save(DEPTH_DIR / path.name, optimize=True, lossless=True)
        print(f"depth  {path.name}")

    print(f"\n{len(photos)} depth maps written to {DEPTH_DIR}")


if __name__ == "__main__":
    main()
