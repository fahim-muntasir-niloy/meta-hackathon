"""Krishoker Janala (krishokerjanala.gov.bd, the Department of Agricultural
Extension's farmer portal): written advice per crop problem, linked to the
DAE pesticide register (pesticides.py). Loaded into Postgres's `agri` schema
by `krishi-db load-agri` from agri.db (built by the pesticide-rag project).

- 998 problems (pests, diseases, deficiencies, weeds) on 122 crops, each with
  Bangla sections: symptoms, management, do, don't; and reference photos.
- kj_mentions: the chemicals each advice names (a brand or an active
  ingredient) with the dose it gives.
- kj_links: products the register lists for the problem's crop and pest.

search_problems() ranks problems for a crop and the farmer's words.
get_problem() gives the whole advice, and for every chemical the advice names
whether the 2020 register lists it for this crop, at what label dose: the
advice and the register do not always agree (rice blast's advice names
Noblast 38SC, which is registered only for tea).

The text is small and never changes between loads, so it is read once and
searched in memory. Calls block, so async code runs them in a thread.
"""

import json
import math
import re
from functools import cache

from rapidfuzz import fuzz, process

from meta_hackathon.db import reference_rows
from meta_hackathon.hazards import human_hazard
from meta_hackathon.pesticides import HAZARD_SOURCE, SOURCE as REGISTER_SOURCE, _expand

SOURCE = "কৃষকের জানালা (Krishoker Janala), কৃষি সম্প্রসারণ অধিদপ্তর (DAE)"
PHOTO_CREDIT = "কৃষকের জানালা, কৃষি সম্প্রসারণ অধিদপ্তর"
PROBLEM_TYPES = {
    "pest": "পোকা",
    "disease": "রোগ",
    "deficiency": "পুষ্টির অভাব",
    "weed": "আগাছা",
    "rodent": "ইঁদুর",
    "other": "অন্যান্য",
}

MAX_RESULTS = 5
SNIPPET = 220

# ---------------------------------------------------------------------------
# Text matching for Bangla (and the few English words in names and slugs)
# ---------------------------------------------------------------------------
_WORD = re.compile(r"[ঀ-৿a-zA-Z0-9]+")
# Case endings and plural / classifier suffixes, longest first: "পাতায়" -> "পাতা", "দাগগুলো" -> "দাগ".
_SUFFIXES = sorted(
    ["গুলোতে", "গুলোর", "গুলো", "গুলি", "দের", "েরা", "ের", "তে", "টা", "টি", "টার", "য়", "য়", "কে", "র", "ে", "ও", "ই", "ছে"],
    key=len,
    reverse=True,
)
_STOP = {
    "আমার", "আমি", "আমাদের", "কী", "কি", "কেন", "কিভাবে", "কীভাবে", "করব", "করবো", "করে", "করছে", "হচ্ছে",
    "হয়েছে", "হয়েছে", "দেখা", "দেখছি", "যাচ্ছে", "যায়", "এবং", "ও", "না", "জন্য", "এই", "সেই", "একটা", "একটি",
    "অনেক", "খুব", "মতো", "মত", "হয়ে", "হয়ে", "হয়", "হয়", "যাচ্ছে", "গেছে", "লাগছে", "দেখি", "গাছ", "গাছে", "গাছের", "ফসল", "ফসলে", "জমি", "জমিতে", "দিয়েছে", "দিয়েছে", "পড়ছে", "পড়েছে", "আছে", "নেই", "থেকে", "দিয়ে", "দিয়ে",
    "the", "and", "of", "in", "on", "my", "is", "are", "with",
}


_SPELLING = str.maketrans({"ী": "ি", "ূ": "ু"})


def _norm(text: str) -> str:
    """For matching only: the decomposed য + nukta and the precomposed য় are the
    same letter, and long and short ই / উ are spelled both ways ("বাদামি" /
    "বাদামী", "শীষ" / "শিষ")."""
    text = (text or "").replace("য়", "য়").replace("ড়", "ড়").replace("ঢ়", "ঢ়")
    return text.translate(_SPELLING).lower()


def _variants(word: str) -> list[str]:
    """The word and its stem, for substring matching against the advice."""
    out = [word]
    for suffix in _SUFFIXES:
        if word.endswith(suffix) and len(word) - len(suffix) >= 2:
            out.append(word[: -len(suffix)])
            break
    return out


def _terms(text: str) -> list[list[str]]:
    words = [w for w in _WORD.findall(_norm(text)) if w not in _STOP and len(w) >= 2]
    return [_variants(w) for w in dict.fromkeys(words)]


@cache
def _problems() -> tuple[dict, ...]:
    rows = reference_rows(
        """SELECT p.id, p.crop_id, p.crop_bn, p.crop_en, p.name_bn, p.problem_type, p.pest_keyword,
                  p.symptoms_bn, p.images, p.source_url, k.slug, k.body
           FROM agri.v_kj_problem p JOIN agri.kj_search k ON k.problem_id = p.id"""
    )
    for r in rows:
        r["_name"] = _norm(r["name_bn"])
        r["_symptoms"] = _norm(r["symptoms_bn"] or "")
        r["_body"] = _norm(r["body"] or "")
        r["_english"] = " ".join(filter(None, [r["slug"], r["pest_keyword"], r["crop_en"]])).lower()
        r["images"] = json.loads(r["images"] or "[]")
    return tuple(rows)


def preload() -> None:
    """Read the advice now (about 2 s from Postgres) rather than on the first search."""
    _problems()


@cache
def _crops() -> tuple[dict, ...]:
    return tuple(reference_rows("SELECT crop_id, name_bn, name_en FROM agri.kj_crops ORDER BY crop_id"))


def resolve_crop(crop: str) -> list[dict]:
    """The Krishoker Janala crops a farmer's word means: "ধান", "ধানের", "Rice", "boro rice"."""
    q = _norm(crop).strip()
    if not q:
        return []
    crops = _crops()
    names = {c["crop_id"]: (_norm(c["name_bn"]), c["name_en"].lower()) for c in crops}
    words = [w for w in q.split() if w not in _STOP]
    # The whole phrase, then any word or its stem ("আমড়া গাছ" -> আমড়া, not আম; "ধানের" -> ধান).
    for candidates in ([q], [v for w in words for v in _variants(w)]):
        exact = [c for c in crops if any(x in names[c["crop_id"]] for x in candidates)]
        if exact:
            return exact
    # "boro rice" contains "rice"
    stems = set(_variants(q)) | set(words)
    contained = [c for c in crops if any(s in names[c["crop_id"]] for s in stems)]
    contained += [c for c in crops if c not in contained and any(n and n in q for n in names[c["crop_id"]])]
    if contained:
        return contained
    choices = {c["crop_id"]: f"{c['name_bn']} {c['name_en']}" for c in crops}
    hits = process.extract(crop, choices, scorer=fuzz.WRatio, limit=3)
    return [c for c in crops if c["crop_id"] in {key for _, score, key in hits if score >= 85}]


def _df(term: str, pool: tuple[dict, ...]) -> int:
    return sum(term in p["_name"] or term in p["_body"] or term in p["_english"] for p in pool)


def search_problems(crop: str | None, query: str, problem_type: str | None = None, limit: int = MAX_RESULTS) -> dict:
    """Problems for a crop that best match the farmer's words (symptoms or a name)."""
    pool = _problems()
    crops = resolve_crop(crop) if crop else []
    if crops:
        ids = {c["crop_id"] for c in crops}
        pool = tuple(p for p in pool if p["crop_id"] in ids)
    if problem_type:
        pool = tuple(p for p in pool if p["problem_type"] == problem_type)

    terms = _terms(query)
    n = len(pool) or 1
    scored = []
    for p in pool:
        score, matched = 0.0, []
        for variants in terms:
            best = 0.0
            for v in variants:
                weight = 4 if v in p["_name"] else 2 if v in p["_symptoms"] else 1 if v in p["_body"] else 0
                if not weight and v.isascii() and v in p["_english"]:
                    weight = 3
                if weight:
                    best = max(best, weight * math.log(1 + n / max(1, _df(v, pool))))
            if best:
                score += best
                matched.append(variants[0])
        # The farmer named the problem: "ব্লাস্ট রোগ", "মাজরা পোকা".
        if query.strip() and fuzz.partial_ratio(_norm(query), p["_name"]) >= 85:
            score += 6
        if score:
            scored.append((score, matched, p))
    scored.sort(key=lambda x: -x[0])

    results = [
        {
            "problem_id": p["id"],
            "problem": p["name_bn"],
            "crop": p["crop_bn"],
            "type": PROBLEM_TYPES.get(p["problem_type"], p["problem_type"]),
            "symptoms": _snippet(p["symptoms_bn"]),
            "matched_words": matched,
            "photo": p["images"][0] if p["images"] else None,
        }
        for _, matched, p in scored[:limit]
    ]
    out = {
        "crop_matched": [c["name_bn"] for c in crops] if crop else None,
        "results": results,
        "source": SOURCE,
    }
    if crop and not crops:
        out["note"] = f"No crop called {crop!r} in Krishoker Janala; searched all crops."
    elif not results:
        out["note"] = "No problem matches these words. Try other symptom words, the Bangla name, or search_internet."
    return out


def _snippet(text: str | None) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= SNIPPET else text[: SNIPPET - 1] + "…"


# ---------------------------------------------------------------------------
# One problem in full, with the register check
# ---------------------------------------------------------------------------
def _crop_terms(crop_en: str) -> set[str]:
    base = re.sub(r"\(.*?\)", "", crop_en).strip()
    return {t.lower() for t in _expand("crop", base)} | {base.lower()}


def _on_crop(reg_crop: str, terms: set[str]) -> bool:
    """Whether a register row's crop (spelled loosely: "Chili", "Sugarcan,", "Rice Tea") is this crop."""
    reg = (reg_crop or "").lower()
    if any(t in reg for t in terms):
        return True
    parts = [p.strip() for p in re.split(r"[,&/]| and ", reg) if p.strip()]
    return any(fuzz.ratio(t, part) >= 85 for t in terms for part in parts)


def _uses(rows: list[dict], terms: set[str], limit: int = 3) -> list[dict]:
    """The register's rows for this crop, one per brand, as a farmer would compare them."""
    seen, out = set(), []
    for r in rows:
        if _on_crop(r["crop"], terms) and (r["reg_no"], r["pest"]) not in seen:
            seen.add((r["reg_no"], r["pest"]))
            out.append(
                {"brand": r["brand"], "reg_no": r["reg_no"], "company": r["holder"], "for_pest": r["pest"], "label_dose": r["dosage"]}
            )
    return out[:limit]


_FLAT = "SELECT active_ingredient, category, brand, reg_no, holder, crop, pest, dosage, product_id FROM agri.v_flat"


def _advice_chemicals(problem_id: int, terms: set[str]) -> list[dict]:
    """Each chemical the advice names, with the dose it gives and what the register says for this crop."""
    mentions = reference_rows(
        """SELECT m.surface_bn, m.dose_bn, m.section_kind, m.product_id, a.id AS active_id, a.name AS active
           FROM agri.kj_mentions m LEFT JOIN agri.actives a ON a.id = m.active_id
           WHERE m.problem_id = %s ORDER BY m.id""",
        (problem_id,),
    )
    out, seen = [], set()
    for m in mentions:
        key = m["surface_bn"].strip()
        if key in seen:
            continue
        seen.add(key)
        if m["product_id"]:
            rows = reference_rows(f"{_FLAT} WHERE product_id = %s", (m["product_id"],))
            ingredient = rows[0]["active_ingredient"] if rows else None
        elif m["active_id"]:
            rows = reference_rows(
                f"""{_FLAT} WHERE product_id IN (
                       SELECT p.id FROM agri.products p
                       JOIN agri.ingredient_actives ia ON ia.ingredient_id = p.ingredient_id
                       WHERE ia.active_id = %s)""",
                (m["active_id"],),
            )
            ingredient = m["active"]
        else:
            continue
        uses = _uses(rows, terms)
        entry = {
            "named_in_advice": key,
            "advice_dose": m["dose_bn"],
            "active_ingredient": ingredient,
            "registered_for_this_crop": bool(uses),
            "registered_uses_on_this_crop": uses,
        }
        if ingredient:
            entry["human_hazard"] = human_hazard(ingredient)
        if rows and not uses:
            entry["registered_for"] = sorted({r["crop"] for r in rows})[:4]
        out.append(entry)
    return out


def _registered_for_problem(problem_id: int, terms: set[str], limit: int = 5) -> list[dict]:
    """Products the register lists for this crop and this pest or disease, by active ingredient."""
    rows = reference_rows(
        """SELECT active_ingredient, category, brand, reg_no, holder, reg_crop AS crop, reg_pest AS pest,
                  reg_dosage AS dosage
           FROM agri.v_kj_links WHERE problem_id = %s AND method = 'crop_pest' AND confidence = 'high'""",
        (problem_id,),
    )
    by_ingredient: dict[str, list[dict]] = {}
    for r in rows:
        by_ingredient.setdefault(r["active_ingredient"], []).append(r)
    ranked = sorted(by_ingredient.items(), key=lambda kv: -len({r["reg_no"] for r in kv[1]}))
    return [
        {
            "active_ingredient": name,
            "category": group[0]["category"],
            "human_hazard": human_hazard(name),
            "registered_products": len({r["reg_no"] for r in group}),
            "examples": _uses(group, terms, limit=2) or _uses(group, {""}, limit=2),
        }
        for name, group in ranked[:limit]
    ]


@cache
def get_problem(problem_id: int) -> dict | None:
    rows = reference_rows("SELECT * FROM agri.v_kj_problem WHERE id = %s", (problem_id,))
    if not rows:
        return None
    p = rows[0]
    terms = _crop_terms(p["crop_en"])
    chemicals = _advice_chemicals(problem_id, terms)
    return {
        "problem_id": p["id"],
        "problem": p["name_bn"],
        "crop": p["crop_bn"],
        "crop_en": p["crop_en"],
        "type": PROBLEM_TYPES.get(p["problem_type"], p["problem_type"]),
        "symptoms": p["symptoms_bn"] or "",
        "management": p["management_bn"] or "",
        "do": p["do_bn"] or "",
        "dont": p["dont_bn"] or "",
        "reference_photos": [{"url": u, "credit": PHOTO_CREDIT, "source": p["source_url"]} for u in json.loads(p["images"] or "[]")],
        "chemicals_in_advice": chemicals,
        "registered_for_this_problem": _registered_for_problem(problem_id, terms),
        "source": SOURCE,
        "source_url": p["source_url"],
        "register_source": REGISTER_SOURCE,
        "hazard_source": HAZARD_SOURCE,
        "unregistered_in_advice": sum(not c["registered_for_this_crop"] for c in chemicals),
    }
