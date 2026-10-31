"""Bangladesh's registered pesticides: which products are registered for a
crop and pest, at what dose.

Source: DAE "List of Registered Agricultural Pesticides, Bio Pesticides and
Public Health Pesticides", approved up to the 81st PTAC meeting (Dec 2020),
extracted from the PDF by the separate pesticide-rag project (extract.py +
build_db.py, not in this repo). Its agri.db is loaded into Postgres's `agri`
schema by `krishi-db load-agri` (dbcli.py): tables ingredients ->
products -> recommendations (one row per product x crop x pest x dosage), plus
`aliases` (BPH = brown planthopper ...) and the joined view `v_flat`.

A crop and pest can match hundreds of rows (rice + BPH: ~900 rows, 90
ingredients), so results are grouped by active ingredient: what to buy is an
ingredient, any of its registered brands will do.

Read-only queries through db.reference_rows; calls block, so async code runs them in a thread.
"""

from collections import Counter
from functools import cache

from rapidfuzz import fuzz, process

from meta_hackathon.db import reference_rows
from meta_hackathon.hazards import human_hazard

HAZARD_SOURCE = "WHO Recommended Classification of Pesticides by Hazard (2019); acute risk to the person handling it"
SOURCE = "DAE Bangladesh, registered agricultural pesticides, up to the 81st PTAC meeting (Dec 2020)"

MAX_INGREDIENTS = 10
EXAMPLE_BRANDS = 3
# A fuzzy match below this is a guess, not the farmer's term.
MIN_MATCH_SCORE = 80


def _rows(sql: str, params=()) -> list[dict]:
    return reference_rows(sql, params)


@cache
def _aliases() -> dict[str, dict[str, frozenset[str]]]:
    """field -> lowercase term -> every equivalent term (canonical + aliases)."""
    groups: dict[tuple[str, str], set[str]] = {}
    for a in _rows("SELECT field, canonical, term FROM agri.aliases"):
        groups.setdefault((a["field"], a["canonical"]), {a["canonical"]}).add(a["term"])
    out: dict[str, dict[str, frozenset[str]]] = {}
    for (field, _), terms in groups.items():
        for t in terms:
            out.setdefault(field, {})[t.lower()] = frozenset(terms)
    return out


def _expand(field: str, term: str) -> set[str]:
    return {term} | set(_aliases().get(field, {}).get(term.lower(), ()))


@cache
def _vocab(column: str) -> tuple[str, ...]:
    return tuple(r["v"] for r in _rows(f"SELECT DISTINCT {column} AS v FROM agri.v_flat WHERE {column} IS NOT NULL"))


def resolve(column: str, term: str, limit: int = 3) -> list[str]:
    """The stored values a user's term most likely means (e.g. "stem borer" -> "Yellow Stemborer")."""
    hits: dict[str, float] = {}
    for t in _expand(column, term):
        for value, score, _ in process.extract(t, _vocab(column), scorer=fuzz.WRatio, limit=limit):
            hits[value] = max(score, hits.get(value, 0))
    return [v for v, s in sorted(hits.items(), key=lambda kv: -kv[1]) if s >= MIN_MATCH_SCORE][:limit]


_STOP_WORDS = {"and", "the", "of", "in", "on"}


def _like(column: str, terms: set[str]) -> tuple[str, list[str]]:
    """Any of the terms; each term matches when all its words appear, in any order
    ("fruit and shoot borer" matches "Shoot & fruit borer", "stem borer" "Yellow Stemborer")."""
    clauses, params = [], []
    for term in terms:
        words = [w for w in term.replace("&", " ").split() if w.lower() not in _STOP_WORDS] or [term]
        clauses.append("(" + " AND ".join(f"{column} ILIKE %s" for _ in words) + ")")
        params += [f"%{w}%" for w in words]
    return "(" + " OR ".join(clauses) + ")", params


def _match(crop: str, pest: str, ingredient: str | None, category: str | None) -> list[dict]:
    where, params = [], []
    for column, terms in [
        ("crop", _expand("crop", crop)),
        ("pest", _expand("pest", pest)),
        ("active_ingredient", {ingredient} if ingredient else None),
        ("category", {category} if category else None),
    ]:
        if terms:
            clause, p = _like(column, terms)
            where.append(clause)
            params += p
    return _rows(f"SELECT * FROM agri.v_flat WHERE {' AND '.join(where)}", params)


def _typical(products: list[dict]) -> list[dict]:
    """Example products, those with the commonest dose first: what most bottles in a shop say."""
    common = Counter(p["dosage"] for p in products)
    return sorted(products, key=lambda p: -common[p["dosage"]])[:EXAMPLE_BRANDS]


def find_registered(crop: str, pest: str, *, ingredient: str | None = None, category: str | None = None) -> dict:
    """Registered products for a crop and pest, grouped by active ingredient,
    the most widely sold ingredients first."""
    rows = _match(crop, pest, ingredient, category)
    matched = {"crop": crop, "pest": pest}
    if not rows:
        # Spelling variants the aliases do not cover: retry with the closest stored terms.
        crops, pests = resolve("crop", crop) or [crop], resolve("pest", pest) or [pest]
        for c in crops:
            for p in pests:
                if rows := _match(c, p, ingredient, category):
                    matched = {"crop": c, "pest": p}
                    break
            if rows:
                break

    by_ingredient: dict[str, list[dict]] = {}
    for r in rows:
        by_ingredient.setdefault(r["active_ingredient"], []).append(r)
    ranked = sorted(by_ingredient.items(), key=lambda kv: -len({r["reg_no"] for r in kv[1]}))

    ingredients = []
    for name, group in ranked[:MAX_INGREDIENTS]:
        brands = {r["reg_no"]: r for r in group}
        ingredients.append(
            {
                "active_ingredient": name,
                "category": group[0]["category"],
                "human_hazard": human_hazard(name),
                "registered_products": len(brands),
                # Doses differ by formulation (20SL vs 70WG), so each product carries its own.
                "examples": [
                    {"brand": r["brand"], "reg_no": r["reg_no"], "company": r["holder"], "dosage": r["dosage"]}
                    for r in _typical(list(brands.values()))
                ],
                "listed_for": sorted({r["pest"] for r in group})[:3],
                "page": group[0]["page"],
            }
        )
    return {
        "matched": matched,
        "total_products": len({r["reg_no"] for r in rows}),
        "total_ingredients": len(by_ingredient),
        "ingredients": ingredients,
        "source": SOURCE,
        "hazard_source": HAZARD_SOURCE,
    }


def lookup_product(query: str) -> dict:
    """A product by registration number (AP-1234) or brand name, with all its registered uses."""
    query = query.strip()
    products = _rows(
        """SELECT p.id, p.reg_no, p.brand, p.formulation, p.holder, p.page, i.name AS active_ingredient, i.category
           FROM agri.products p JOIN agri.ingredients i ON i.id = p.ingredient_id
           WHERE lower(p.reg_no) = lower(%s) OR p.brand ILIKE %s
           LIMIT 5""",
        (query, f"%{query}%"),
    )
    if not products:
        brands = [b for b, score, _ in process.extract(query, _vocab("brand"), scorer=fuzz.WRatio, limit=3) if score >= 85]
        if brands:
            products = _rows(
                f"""SELECT p.id, p.reg_no, p.brand, p.formulation, p.holder, p.page, i.name AS active_ingredient, i.category
                    FROM agri.products p JOIN agri.ingredients i ON i.id = p.ingredient_id
                    WHERE p.brand = ANY(%s) LIMIT 5""",
                (brands,),
            )
    for p in products:
        p["human_hazard"] = human_hazard(p["active_ingredient"])
        p["registered_uses"] = _rows(
            "SELECT crop, pest, dosage FROM agri.recommendations WHERE product_id = %s", (p.pop("id"),)
        )
    return {"query": query, "found": len(products), "products": products, "source": SOURCE}
