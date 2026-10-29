"""Read-only lookups in the DAE pesticide register (pesticides.py), the same
ones the agent's tools use. Public reference data, so no phone header needed.

Sync handlers: the database calls block, and FastAPI runs these in a thread."""

from fastapi import APIRouter, HTTPException, Query

from meta_hackathon.pesticides import find_registered, lookup_product, resolve

router = APIRouter(prefix="/v1/pesticides", tags=["pesticides"])


@router.get("")
def registered(
    crop: str = Query(description="e.g. Rice, Brinjal, Potato"),
    pest: str = Query(description="e.g. BPH, stem borer, late blight"),
    category: str | None = Query(None, description="Insecticides, Fungicide, Herbicide, ..."),
    ingredient: str | None = None,
) -> dict:
    return find_registered(crop, pest, category=category, ingredient=ingredient)


@router.get("/products/{query}")
def product(query: str) -> dict:
    found = lookup_product(query)
    if not found["products"]:
        raise HTTPException(status_code=404, detail=f"No registered product matches {query!r}.")
    return found


@router.get("/resolve")
def resolve_term(field: str = Query(pattern="^(crop|pest|brand|holder|active_ingredient|category)$"), q: str = "") -> dict:
    return {"field": field, "query": q, "matches": resolve(field, q, limit=8)}
