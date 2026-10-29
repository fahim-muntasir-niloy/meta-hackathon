"""How hazardous a pesticide's active ingredient is to people: the WHO
Recommended Classification of Pesticides by Hazard (2019 edition), for the
ingredients most common in the DAE register.

    Ia  extremely hazardous     Ib  highly hazardous     II  moderately hazardous
    III slightly hazardous      U   unlikely to present acute hazard in normal use

Bangladeshi labels carry a matching colour band (red for Ia/Ib, yellow for II,
blue for III, green for U). The class is about acute poisoning of the person
handling it, not about long-term effects or the environment.

Hand-entered, only for ingredients whose class is well established; anything
else comes back unknown rather than guessed. TODO: verify each row against the
WHO 2019 tables before relying on it.
"""

import re

WHO_CLASS: dict[str, str] = {
    # Insecticides
    "carbofuran": "Ib",
    "chlorpyrifos": "II",
    "cypermethrin": "II",
    "lambda cyhalothrin": "II",
    "deltamethrin": "II",
    "fenvalerate": "II",
    "fenpropathrin": "II",
    "imidacloprid": "II",
    "acetamiprid": "II",
    "fipronil": "II",
    "cartap": "II",
    "diazinon": "II",
    "dimethoate": "II",
    "quinalphos": "II",
    "carbaryl": "II",
    "carbosulfan": "II",
    "emamectin benzoate": "II",
    "malathion": "III",
    "chlorantraniliprole": "U",
    "lufenuron": "U",
    "pyriproxyfen": "U",
    "hexythiazox": "U",
    # Fungicides
    "tricyclazole": "II",
    "tebuconazole": "II",
    "propiconazole": "II",
    "difenoconazole": "II",
    "metalaxyl": "II",
    "copper oxychloride": "II",
    "thiram": "II",
    "iprodione": "III",
    "mancozeb": "U",
    "carbendazim": "U",
    "azoxystrobin": "U",
    "trifloxystrobin": "U",
    "sulphur": "U",
    # Herbicides
    "paraquat": "II",
    "2,4-d": "II",
    "pendimethalin": "II",
    "glyphosate": "III",
    "bensulfuron methyl": "U",
}

# Facts a farmer must hear whatever the class says.
NOTES: dict[str, str] = {
    "paraquat": "পেটে গেলে অল্প পরিমাণেও প্রাণঘাতী, কোনো প্রতিষেধক নেই। শিশুদের নাগালের বাইরে তালা দিয়ে রাখুন।",
    "carbofuran": "খুব বিষাক্ত; অনেক দেশে নিষিদ্ধ। হাতে না ধরে গ্লাভস পরে ছিটান, মাছ ও পাখির জন্যও ক্ষতিকর।",
    "aluminium phosphide": "বিষাক্ত গ্যাস তৈরি করে, শ্বাসে গেলে প্রাণঘাতী। শুধু বন্ধ গুদামে, ঘরে কখনো নয়।",
}

_RANK = {"Ia": 0, "Ib": 1, "II": 2, "III": 3, "U": 4}

# Bangla label and the label colour band, per class.
LEVELS = {
    "Ia": ("অত্যন্ত বিপজ্জনক", "red"),
    "Ib": ("খুব বিপজ্জনক", "red"),
    "II": ("মাঝারি বিপজ্জনক", "yellow"),
    "III": ("সামান্য বিপজ্জনক", "blue"),
    "U": ("সাধারণ ব্যবহারে ঝুঁকি কম", "green"),
}

# Common misspellings in the register.
_SPELLING = {"cypermathrin": "cypermethrin", "difenconazole": "difenoconazole", "lambda-cyhalothrin": "lambda cyhalothrin"}


def _components(ingredient: str) -> list[str]:
    """ "Ethion (5%) + Thiamethoxam (20%)" -> ["ethion", "thiamethoxam"]."""
    parts = []
    for part in re.split(r"\s*\+\s*", ingredient):
        name = re.sub(r"\(.*?\)|\d+(\.\d+)?\s*%|[()]", " ", part).lower()
        name = " ".join(name.replace("-", " ").split()) if "2,4" not in name else name.strip()
        name = _SPELLING.get(name, name)
        if name.startswith("2,4-d"):  # "2,4-D Amine", "2,4-D Sodium salt"
            name = "2,4-d"
        if name:
            parts.append(name)
    return parts


def human_hazard(ingredient: str) -> dict:
    """The WHO class of an ingredient; for a mixture, of its most hazardous component."""
    parts = _components(ingredient)
    classes = [(p, WHO_CLASS[p]) for p in parts if p in WHO_CLASS]
    note = next((NOTES[p] for p in parts if p in NOTES), None)
    if not classes:
        return {"who_class": None, "label": "তথ্য নেই: প্যাকেটের রঙের দাগ দেখুন", "note": note}
    part, cls = min(classes, key=lambda pc: _RANK[pc[1]])
    if len(classes) < len(parts) and _RANK[cls] > _RANK["Ib"]:
        # An unclassified component may be worse than the classified ones: do not reassure.
        return {"who_class": None, "label": "তথ্য নেই: প্যাকেটের রঙের দাগ দেখুন", "note": note}
    label, colour = LEVELS[cls]
    out = {"who_class": cls, "label": label, "label_colour": colour, "note": note}
    if len(parts) > 1:
        out["basis"] = f"most hazardous component: {part}"
    return out
