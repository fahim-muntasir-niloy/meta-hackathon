"""Bangla formatting helpers."""

from datetime import date
from zoneinfo import ZoneInfo

DHAKA = ZoneInfo("Asia/Dhaka")

_BN_DIGITS = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
_BN_WEEKDAYS = ["সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার", "রবিবার"]
_BN_MONTHS = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
]


def bn_digits(value: object) -> str:
    """42 → "৪২"; leaves non-digits untouched."""
    return str(value).translate(_BN_DIGITS)


def bn_date(d: date) -> str:
    """2026-10-29 → "বৃহস্পতিবার, ২৯ অক্টোবর ২০২৬"."""
    return bn_digits(f"{_BN_WEEKDAYS[d.weekday()]}, {d.day} {_BN_MONTHS[d.month - 1]} {d.year}")


def bn_day_label(d: date, today: date) -> str:
    """Short chart label: "আজ", "কাল", else "শুক্র ৩০"."""
    if d == today:
        return "আজ"
    if (d - today).days == 1:
        return "কাল"
    return bn_digits(f"{_BN_WEEKDAYS[d.weekday()].removesuffix('বার')} {d.day}")


def bn_hour_label(hour: int) -> str:
    """15 → "বিকাল ৩টা": part of day + 12-hour clock, as farmers say it."""
    if 4 <= hour < 6:
        part = "ভোর"
    elif 6 <= hour < 12:
        part = "সকাল"
    elif 12 <= hour < 15:
        part = "দুপুর"
    elif 15 <= hour < 18:
        part = "বিকাল"
    elif 18 <= hour < 20:
        part = "সন্ধ্যা"
    else:
        part = "রাত"
    return bn_digits(f"{part} {hour % 12 or 12}টা")
