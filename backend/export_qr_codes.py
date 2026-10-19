"""CLI script that exports all table QR codes as printable PNG files into backend/qr_exports/."""

import argparse
import asyncio
from pathlib import Path
import sys

from sqlalchemy import select

# Ensure backend root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import SessionFactory
from app.models.table import Table
from app.services.table import detect_lan_url, generate_qr_png


async def export_all(base_url: str | None = None, output_dir: Path | None = None) -> None:
    if output_dir is None:
        output_dir = Path(__file__).resolve().parent / "qr_exports"
    output_dir.mkdir(parents=True, exist_ok=True)

    target_base = (base_url or detect_lan_url()).rstrip("/")
    print(f"Exporting QR codes using base URL: {target_base}")
    print(f"Destination: {output_dir}\n")

    async with SessionFactory() as session:
        result = await session.execute(
            select(Table).where(Table.is_active.is_(True)).order_by(Table.table_number.asc())
        )
        tables = result.scalars().all()

        if not tables:
            print("No active tables found in database.")
            return

        for table in tables:
            target_url = f"{target_base}/t/{table.qr_token}"
            png_bytes = generate_qr_png(target_url)
            filename = output_dir / f"table_{table.table_number:02d}_{table.table_id}.png"
            filename.write_bytes(png_bytes)
            print(f"  [OK] Table {table.table_number:2d} ({table.table_id}) -> {filename.name}")

        print(f"\nSuccessfully exported {len(tables)} table QR codes to {output_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export table QR codes to PNG images")
    parser.add_argument(
        "--base-url",
        type=str,
        default=None,
        help="Base URL for QR codes (defaults to auto-detected LAN URL: http://<LAN_IP>:5173)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Output directory (defaults to backend/qr_exports/)",
    )
    args = parser.parse_args()
    asyncio.run(export_all(base_url=args.base_url, output_dir=args.output_dir))


if __name__ == "__main__":
    main()
