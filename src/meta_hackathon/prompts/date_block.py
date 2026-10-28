"""Today's date for the system prompt, with relative days pre-computed so the
model can answer "কালকে কি বৃষ্টি হবে?" without doing date arithmetic."""

from datetime import date, datetime, timedelta

from meta_hackathon.utils.bangla import DHAKA, bn_date


def _day(d: date) -> str:
    return f"{d.isoformat()} ({d:%A}) — {bn_date(d)}"


def date_block(now: datetime | None = None) -> str:
    now = now or datetime.now(DHAKA)
    today = now.date()

    def rel(days: int) -> str:
        return _day(today + timedelta(days=days))

    return f"""\
# Current date and time
Now: {now:%H:%M}, Asia/Dhaka (UTC+6)
- Today (আজ): {rel(0)}
- Yesterday (গতকাল): {rel(-1)}
- Tomorrow (আগামীকাল): {rel(1)}
- Day after tomorrow (পরশু): {rel(2)}
- In 7 days (এক সপ্তাহ পর): {rel(7)}

Use these dates for every relative time word ("today", "tomorrow", "this week", "আজ", "পরশু", "আগামী সপ্তাহ"); never guess the date.
"কাল"/"কালকে" means tomorrow with future tense ("কালকে কি বৃষ্টি হবে?") and yesterday with past tense ("কালকে বৃষ্টি হয়েছিল").
When a farmer asks about a specific day, call get_weather and answer for that exact date.
"""
