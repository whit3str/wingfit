from io import BytesIO
from pathlib import Path
from uuid import uuid4

import aiofiles
import httpx
from fastapi import HTTPException
from PIL import Image

from ..config import settings


def generate_filename(format: str) -> str:
    return f"{uuid4()}.{format}"


def assets_folder_path() -> Path:
    return Path(settings.ASSETS_FOLDER)


def remove_image(path: str):
    try:
        Path(assets_folder_path() / path).unlink()
    except HTTPException(status_code=404, detail="The resource does not exist"):
        raise Exception("Image not found")
    except OSError as e:
        raise Exception("Error deleting image:", e)


async def download_file(link: str) -> str:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=8) as client:
            response = await client.get(link)
            response.raise_for_status()

            async with aiofiles.tempfile.NamedTemporaryFile("wb", delete=False) as tmpfile:
                await tmpfile.write(response.content)
                return tmpfile.name
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"Failed to download file: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error during file download: {e}")


def save_image(content: bytes, path: Path, size: int = 128) -> bool:
    try:
        with Image.open(BytesIO(content)) as im:
            if im.mode not in ("RGB", "RGBA"):
                im = im.convert("RGB")

            if size > 0:  # Crop as square (size * size)
                im_ratio = im.width / im.height
                target_ratio = 1  # Square ratio is 1

                if im_ratio > target_ratio:
                    new_height = size[1]
                    new_width = int(new_height * im_ratio)
                else:
                    new_width = size[0]
                    new_height = int(new_width / im_ratio)

                im = im.resize((new_width, new_height), Image.LANCZOS)

                left = (im.width - size[0]) // 2
                top = (im.height - size[1]) // 2
                right = left + size[0]
                bottom = top + size[1]

                im = im.crop((left, top, right, bottom))

            im.save(path, format=im.format)
            return True
    except Exception:
        # TODO Enhance logging
        ...
    return False
