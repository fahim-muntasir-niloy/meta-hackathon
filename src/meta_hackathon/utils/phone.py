import re

_E164_RE = re.compile(r"^\+?[1-9]\d{7,14}$")
_BANGLA_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")


def normalize_phone(raw: str) -> str:
    """Normalise a phone number to E.164. Raises ValueError if it isn't one."""
    phone = re.sub(r"[\s\-()]", "", raw).translate(_BANGLA_DIGITS)
    if re.fullmatch(r"01\d{9}", phone):  # local Bangladeshi mobile → E.164
        phone = f"+880{phone[1:]}"
    if not _E164_RE.match(phone):
        raise ValueError(f"Invalid phone number: {raw!r}")
    return phone if phone.startswith("+") else f"+{phone}"
