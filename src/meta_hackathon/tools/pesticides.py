"""Registered pesticides in Bangladesh (pesticides.py): which products the DAE
has registered for a crop and pest, at what dose, and what a product the
farmer names is registered for.

Sync tools: the database calls block, so LangChain runs these in a thread.
"""

from typing import Literal

from langchain.tools import tool

from meta_hackathon.pesticides import find_registered, lookup_product

Category = Literal["Insecticides", "Fungicide", "Herbicide", "Miticide", "Rodenticide", "Bio Pesticides"]


@tool
def find_registered_pesticides(
    crop: str,
    pest: str,
    category: Category | None = None,
    ingredient: str | None = None,
) -> dict:
    """Pesticides registered in Bangladesh for a crop and pest or disease, with the
    registered dose (DAE list, up to Dec 2020). Grouped by active ingredient, the most
    widely sold first, each with example brands, registration numbers and their dose.

    Use it before naming any chemical or dose: recommend only what this returns, and
    quote the dose exactly as listed.

    Args:
        crop: English crop name: "Rice", "Brinjal", "Potato", "Jute", "Tea".
        pest: English pest or disease: "BPH", "stem borer", "blast", "late blight",
            "fruit and shoot borer". Abbreviations and spelling variants are matched.
        category: "Insecticides" for insects, "Fungicide" for diseases, "Herbicide" for
            weeds, etc. Set it: the source list has some rows under the wrong category.
        ingredient: An active ingredient to check, e.g. "Tricyclazole".
    """
    return find_registered(crop, pest, ingredient=ingredient, category=category)


@tool
def lookup_pesticide_product(query: str) -> dict:
    """A pesticide product by brand name or registration number (e.g. "Virtako",
    "AP-1618"): its active ingredient, company, and every crop/pest/dose it is
    registered for. Use it when the farmer names a product they have or were sold,
    to check whether it is registered for their crop and problem.
    """
    return lookup_product(query)
