import asyncio
import base64
import io
import json
import os
import re
import subprocess
import sys
import tempfile

import httpx
from PIL import Image, ImageFilter, ImageOps

from app.config import settings
from app.core.exceptions import BusinessRuleError
from app.models.enums import PriorityStatus
from app.schemas.session import IdScanRead

DISCOUNTABLE = (PriorityStatus.SENIOR, PriorityStatus.PWD)

_NON_NAME_KEYWORDS = (
    "REPUBLIC",
    "PHILIPPINES",
    "PROVINCE",
    "GOVERNMENT",
    "NATIONAL",
    "COMMISSION",
    "OFFICE",
    "SENIOR",
    "CITIZEN",
    "CITIZENS",
    "AFFAIRS",
    "PERSON",
    "PERSONS",
    "DISABILITY",
    "PDAO",
    "OSCA",
    "ISSUING",
    "LGU",
    "DATE",
    "BIRTH",
    "SPECIMEN",
    "CAPSTONE",
    "DEMO",
    "VISUAL",
    "IMPAIRMENT",
    "PSYCHOSOCIAL",
    "ORTHOPEDIC",
    "HEARING",
    "LEARNING",
    "MENTAL",
    "SPEECH",
    "TYPE",
    "SIGNATURE",
    "HOLDER",
    "ENTITLED",
    "BENEFITS",
    "PRIVILEGES",
    "PRIVELIGES",
    "ACCORDANCE",
    "VIOLATION",
    "PUNISHABLE",
    "VALID",
    "ANYWHERE",
    "IDENTIFICATION",
    "CARD",
    "MUNICIPALITY",
    "CITY",
    "ADDRESS",
    "BRGY",
    "ZONE",
    "SAMPALOK",
    "MANILA",
    "METRO",
    "DAVAO",
    "TAGUM",
    "FILIPINO",
    "NATIONALITY",
    "NASYONALIDAD",
    "KASARIAN",
    "PETSA",
    "KAPANGANAKAN",
    "APELYIDO",
    "SURNAME",
    "PANGALAN",
    "GIVEN",
    "PANGGITNANG",
    "NUMBER",
)

_IGNORED_NUMBERS = {
    "9442",
    "10754",
    "19754",
    "9994",
    "7277",
    "1955",
}


def _fix_ocr_letters(text: str) -> str:
    return (
        text.replace("0", "O")
        .replace("1", "I")
        .replace("5", "S")
        .replace("8", "B")
    )


def _clean_alpha(raw: str | None, max_len: int) -> str:
    if not raw:
        return ""
    cleaned = re.sub(r"[^A-Za-zÀ-ÖØ-öø-ÿÑñ\s.'-]", " ", str(raw))
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:max_len]


def _is_valid_name_candidate(raw: str) -> str:
    if not raw:
        return ""
    fixed = _fix_ocr_letters(raw.upper().strip())
    fixed = re.sub(
        r"\b(?:APELYIDO|SURNAME|PANGALAN|GIVEN\s*NAME|PANGGITNANG|MIDDLE\s*NAME|NAME|TYPE\s*OF\s*DISABILITY|SIGNATURE)\b",
        " ",
        fixed,
    )
    cleaned = _clean_alpha(fixed.title(), 80)
    words = [w.upper().strip(".'-") for w in cleaned.split() if len(w.strip(".'-")) >= 2]
    if not words:
        return ""
    if any(w in _NON_NAME_KEYWORDS for w in words):
        return ""
    return " ".join(w.title() for w in words)[:80]


def _extract_last4_from_id_string(raw: str | None) -> str:
    if not raw:
        return ""
    text = str(raw).upper().strip()
    text = re.sub(r"\b(?:RA|ACT|ACTS)\s*[0-9]{4,5}\b", "", text)

    alnum_tokens = re.findall(r"[A-Z]{0,4}[0-9][0-9\-–—\s]{2,}[0-9]", text)
    for token in reversed(alnum_tokens):
        digits = "".join(re.findall(r"\d", token))
        if len(digits) >= 4 and digits not in _IGNORED_NUMBERS:
            return digits[-4:]

    all_digits = "".join(re.findall(r"\d", text))
    if len(all_digits) >= 4 and all_digits not in _IGNORED_NUMBERS:
        return all_digits[-4:]
    return ""


# Read
def _parse_ocr_text_lines(raw_text: str, default_status: PriorityStatus) -> IdScanRead | None:
    if not raw_text or not raw_text.strip():
        return None

    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    upper_lines = [line.upper() for line in lines]
    upper_all = "\n".join(upper_lines)

    detected_status = default_status
    if any(k in upper_all for k in ("DISABILITY", "PWD", "PDAO", "PSYCHOSOCIAL", "9442", "10754", "19754")):
        detected_status = PriorityStatus.PWD
    elif any(k in upper_all for k in ("SENIOR", "OSCA", "CITIZEN", "APELYIDO", "NCSC")):
        detected_status = PriorityStatus.SENIOR

    surname = ""
    given_name = ""
    middle_name = ""

    for idx, uline in enumerate(upper_lines):
        if ("APELYIDO" in uline or "SURNAME" in uline) and "PANGGITNANG" not in uline:
            after = re.split(r"SURNAME|APELYIDO", uline)[-1].strip(" /:-.")
            cand = _is_valid_name_candidate(after)
            if not cand and idx + 1 < len(lines):
                cand = _is_valid_name_candidate(lines[idx + 1])
            if cand and not surname:
                surname = cand
        elif "PANGALAN" in uline or "GIVEN NAME" in uline or "GIVEN" in uline:
            after = re.split(r"GIVEN\s*NAME|GIVEN|PANGALAN", uline)[-1].strip(" /:-.")
            cand = _is_valid_name_candidate(after)
            if not cand and idx + 1 < len(lines):
                cand = _is_valid_name_candidate(lines[idx + 1])
            if cand and not given_name:
                given_name = cand
        elif "PANGGITNANG" in uline or "MIDDLE" in uline:
            after = re.split(r"SURNAME|APELYIDO|MIDDLE\s*NAME|PANGGITNANG", uline)[-1].strip(" /:-.")
            cand = _is_valid_name_candidate(after)
            if not cand and idx + 1 < len(lines):
                cand = _is_valid_name_candidate(lines[idx + 1])
            if cand and not middle_name:
                middle_name = cand

    cardholder = ""
    if given_name or surname:
        parts = [p for p in (given_name, middle_name, surname) if p]
        cardholder = " ".join(parts)[:80]

    if not cardholder:
        for idx, uline in enumerate(upper_lines):
            if re.fullmatch(r"[\s\-_]*[NHM]A[MN]E[\s\-_:.;]*", uline):
                if idx > 0:
                    above_cand = _is_valid_name_candidate(lines[idx - 1])
                    if above_cand and len(above_cand.split()) >= 2:
                        cardholder = above_cand
                        break
                if idx + 1 < len(lines):
                    below_cand = _is_valid_name_candidate(lines[idx + 1])
                    if below_cand and len(below_cand.split()) >= 2:
                        cardholder = below_cand
                        break

            inline_match = re.search(
                r"(?:CARDHOLDER\s*NAME|FULL\s*NAME|\b[NHM]A[MN]E)\s*[:.;\-]\s*(.+)$",
                uline,
            )
            if inline_match:
                inline_cand = _is_valid_name_candidate(inline_match.group(1))
                if inline_cand and len(inline_cand.split()) >= 2:
                    cardholder = inline_cand
                    break

    if not cardholder:
        for line in lines:
            if any(ch.isdigit() for ch in line):
                continue
            cand = _is_valid_name_candidate(line)
            if cand and 2 <= len(cand.split()) <= 4 and len(cand) >= 6:
                cardholder = cand
                break

    issuing_lgu = ""
    lgu_patterns = (
        r"(?:ISSUING\s*LGU|CITY\s*/\s*MUNICIPALITY\s*OF|MUNICIPALITY\s*OF|CITY\s*GOVERNMENT\s*OF|CITY\s*OF)\s*[:.;\-]?\s*([A-ZÑ\s.'-]{3,35})",
        r"\b([A-ZÑ]{3,20}\s+CITY)\b",
    )
    for pat in lgu_patterns:
        m = re.search(pat, upper_all)
        if m:
            raw_lgu = m.group(1).splitlines()[0].strip()
            raw_lgu = re.split(
                r"\b(?:OFFICE|DATE|BIRTH|NAME|OSCA|PWD|ID|DISABILITY|METRO|PROVINCE|REPUBLIC)\b",
                raw_lgu,
            )[0].strip()
            cleaned_lgu = _clean_alpha(raw_lgu.title(), 50)
            if len(cleaned_lgu) >= 4:
                issuing_lgu = cleaned_lgu
                break

    id_last4 = ""
    sc_or_pwd_code = re.findall(r"\b(?:SC|PWD|OSCA|DV|TG)[-\s]*([0-9]{4,12})\b", upper_all)
    if sc_or_pwd_code:
        id_last4 = sc_or_pwd_code[-1][-4:]

    if not id_last4:
        hyphen_codes = re.findall(
            r"[A-Z0-9]{1,5}\s*[-–—]\s*[0-9]{2,4}\s*[-–—]\s*([0-9]{4,8})\b",
            upper_all,
        )
        if hyphen_codes:
            id_last4 = hyphen_codes[-1][-4:]

    if not id_last4:
        for idx, uline in enumerate(upper_lines):
            if any(k in uline for k in ("ID NUMBER", "ID NO", "OSCA ID", "PWD ID", "CONTROL NO")):
                window = [uline]
                if idx + 1 < len(upper_lines):
                    window.append(upper_lines[idx + 1])
                if idx > 0:
                    window.append(upper_lines[idx - 1])
                for wline in window:
                    if any(bad in wline for bad in ("REPUBLIC ACT", "9442", "19754", "10754", "BIRTH")):
                        continue
                    num_groups = re.findall(r"\d{4,12}", wline)
                    valid_groups = [g for g in num_groups if g not in _IGNORED_NUMBERS]
                    if valid_groups:
                        id_last4 = valid_groups[-1][-4:]
                        break
                if id_last4:
                    break

    if not id_last4:
        for uline in upper_lines:
            if any(
                skip in uline
                for skip in ("BIRTH", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "BRGY", "ZONE", "REPUBLIC ACT", "9442")
            ):
                continue
            long_nums = [
                g
                for g in re.findall(r"\b(\d{5,12})\b", uline)
                if g not in _IGNORED_NUMBERS
            ]
            if long_nums:
                id_last4 = long_nums[-1][-4:]
                break

    if not id_last4:
        for uline in reversed(upper_lines):
            if any(
                skip in uline
                for skip in ("BIRTH", "BRGY", "ZONE", "REPUBLIC ACT", "9442", "19754", "10754")
            ):
                continue
            four_nums = [
                g
                for g in re.findall(r"\b(\d{4})\b", uline)
                if g not in _IGNORED_NUMBERS and not (1920 <= int(g) <= 2026)
            ]
            if four_nums:
                id_last4 = four_nums[-1]
                break

    if not id_last4 and not cardholder:
        return None

    return IdScanRead(
        detected_status=detected_status,
        id_last4=id_last4,
        cardholder_name=cardholder,
        issuing_lgu=issuing_lgu or "Davao City",
        engine="windows-ocr",
        confidence_note="ID details extracted automatically from photo.",
    )


def _run_windows_native_ocr(image_bytes: bytes) -> str:
    if sys.platform != "win32":
        return ""
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            with Image.open(io.BytesIO(image_bytes)) as img:
                rgb = img.convert("RGB")
                if rgb.width < 1200:
                    scale = 1200 / max(rgb.width, 1)
                    rgb = rgb.resize(
                        (int(rgb.width * scale), int(rgb.height * scale)),
                        Image.Resampling.LANCZOS,
                    )
                enhanced = ImageOps.autocontrast(rgb, cutoff=1)
                enhanced = enhanced.filter(ImageFilter.SHARPEN)
                enhanced.save(tmp.name, format="PNG")
            tmp_path = tmp.name

        ps_script = f"""
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {{
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
}})[0]

Function Await($WinRtTask, $ResultType) {{
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}}

$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync('{tmp_path}')) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
foreach ($line in $result.Lines) {{
    Write-Output $line.Text
}}
$stream.Dispose()
"""
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_script],
            capture_output=True,
            text=True,
            timeout=8,
        )
        return proc.stdout.strip()
    except Exception:
        return ""
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


# Validate
async def scan_priority_id_image(
    declared: PriorityStatus, image_base64: str
) -> IdScanRead:
    raw_b64 = image_base64.strip()
    mime_type = "image/jpeg"
    if raw_b64.startswith("data:"):
        header, _, raw_b64 = raw_b64.partition(",")
        if "image/png" in header:
            mime_type = "image/png"
        elif "image/webp" in header:
            mime_type = "image/webp"

    try:
        image_bytes = base64.b64decode(raw_b64, validate=False)
    except Exception as exc:
        raise BusinessRuleError("Could not read the captured ID photo. Please try again.") from exc

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img.verify()
    except Exception as exc:
        raise BusinessRuleError("Please upload or snap a valid photo of the ID card.") from exc

    target_status = declared if declared in DISCOUNTABLE else PriorityStatus.SENIOR
    gemini_error_detail = ""

    if settings.GEMINI_API_KEY:
        prompt = (
            "You are reading a Philippine Senior Citizen (OSCA / NCSC) or Person With Disability (PWD) ID card. "
            "Philippine IDs use several layouts: "
            "- Layout A (PWD Card): The person's full name (e.g. 'JUAN DELA CRUZ') is printed ABOVE the horizontal line labeled 'NAME', and the ID number (e.g. '137404') is printed above the photo or above 'ID NO.'. Ignore Republic Act numbers like 9442 or 10754 or seal years like 1955. "
            "- Layout B (NCSC Senior Citizen Card): The name is split into 'Apelyido/Surname' (e.g. 'DELA CRUZ'), 'Pangalan/Given Name' (e.g. 'JOSIE'), and 'Panggitnang Apelyido' (e.g. 'ERICE') — combine them as 'Given Name + Middle Name + Surname' (e.g. 'Josie Erice Dela Cruz'). The ID number is under the QR code labeled 'ID NUMBER' (e.g. 'SC98273828'). The city/LGU is inside the 'Address' field (e.g. 'Manila City'). "
            "- Layout C (Standard LGU Card): Fields are labeled 'NAME: ...', 'ISSUING LGU: ...', and 'OSCA/PWD ID NO.: ...'. "
            "Return ONLY a valid JSON object with these exact keys: "
            "1. 'detected_status': 'senior' or 'pwd'. "
            "2. 'full_id_number': the ENTIRE ID number string printed on the card (e.g. 'SC98273828', '137404', or 'DV-2026-4821'). "
            "3. 'cardholder_name': the person's full name (e.g. 'Juan Dela Cruz' or 'Josie Erice Dela Cruz'). "
            "4. 'issuing_lgu': the city or municipality name (e.g. 'Manila City', 'Bonifacio', or 'Davao City')."
        )
        payload_b64 = base64.b64encode(image_bytes).decode("ascii")
        models_to_try = ("gemini-2.5-flash", "gemini-2.0-flash")

        async with httpx.AsyncClient(timeout=15.0) as client:
            for model_name in models_to_try:
                url = (
                    "https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{model_name}:generateContent?key={settings.GEMINI_API_KEY}"
                )
                body = {
                    "contents": [
                        {
                            "parts": [
                                {"text": prompt},
                                {
                                    "inline_data": {
                                        "mime_type": mime_type,
                                        "data": payload_b64,
                                    }
                                },
                            ]
                        }
                    ],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "temperature": 0.0,
                    },
                }
                try:
                    resp = await client.post(url, json=body)
                    if resp.status_code != 200:
                        gemini_error_detail = f"HTTP {resp.status_code}"
                        continue

                    data = resp.json()
                    parts = (
                        data.get("candidates", [{}])[0]
                        .get("content", {})
                        .get("parts", [])
                    )
                    raw_json_str = ""
                    for part in parts:
                        if part.get("thought"):
                            continue
                        if "text" in part and part["text"].strip():
                            raw_json_str = part["text"].strip()

                    if not raw_json_str:
                        continue

                    raw_json_str = re.sub(r"^```(?:json)?\s*", "", raw_json_str)
                    raw_json_str = re.sub(r"\s*```$", "", raw_json_str)
                    json_match = re.search(r"\{.*\}", raw_json_str, flags=re.DOTALL)
                    if json_match:
                        raw_json_str = json_match.group(0)

                    parsed = json.loads(raw_json_str)
                    raw_status = str(parsed.get("detected_status", "")).lower()
                    if "pwd" in raw_status:
                        target_status = PriorityStatus.PWD
                    elif "senior" in raw_status:
                        target_status = PriorityStatus.SENIOR

                    raw_id_str = parsed.get("full_id_number") or parsed.get("id_last4") or ""
                    last4 = _extract_last4_from_id_string(raw_id_str)
                    holder = _clean_alpha(parsed.get("cardholder_name"), 80)
                    lgu = _clean_alpha(parsed.get("issuing_lgu"), 50) or "Davao City"

                    if not last4 or not holder:
                        ocr_backup = await asyncio.to_thread(_run_windows_native_ocr, image_bytes)
                        backup_parsed = _parse_ocr_text_lines(ocr_backup, target_status)
                        if backup_parsed:
                            if not last4 and backup_parsed.id_last4:
                                last4 = backup_parsed.id_last4
                            if not holder and backup_parsed.cardholder_name:
                                holder = backup_parsed.cardholder_name
                            if lgu == "Davao City" and backup_parsed.issuing_lgu:
                                lgu = backup_parsed.issuing_lgu

                    if last4 or holder:
                        del image_bytes
                        return IdScanRead(
                            detected_status=target_status,
                            id_last4=last4,
                            cardholder_name=holder,
                            issuing_lgu=lgu,
                            engine=model_name,
                            confidence_note="ID details detected automatically from photo (image purged from memory).",
                        )
                except Exception as exc:
                    gemini_error_detail = str(exc)
                    continue

    ocr_text = await asyncio.to_thread(_run_windows_native_ocr, image_bytes)
    del image_bytes
    local_parsed = _parse_ocr_text_lines(ocr_text, target_status)
    if local_parsed is not None:
        return local_parsed

    if not settings.GEMINI_API_KEY:
        raise BusinessRuleError(
            "Could not read the ID text offline. Add GEMINI_API_KEY to your .env file (and restart uvicorn) or type the details below."
        )

    raise BusinessRuleError(
        f"Could not clearly read the ID text ({gemini_error_detail or 'blurry image'}). Please hold the ID steady or type the details below."
    )