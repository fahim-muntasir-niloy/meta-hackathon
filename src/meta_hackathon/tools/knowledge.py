from langchain.tools import tool

# SIMULATED: a few hand-written chunks standing in for the DAE/BRRI vector store (K1-K4).
# Reference images are real, openly licensed Wikimedia Commons photos.
_CHUNKS = [
    {
        "id": "brri-blast-01",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/c/c1/Rice_blast_Magnaporthe_grisea.jpg",
        "image_credit": "Wikimedia Commons, public domain",
        "crop": "rice",
        "title": "Rice blast (ধানের ব্লাস্ট রোগ)",
        "source": "BRRI Rice Disease Leaflet (simulated)",
        "keywords": ["blast", "ব্লাস্ট", "spot", "দাগ", "leaf", "পাতা", "eye-shaped"],
        "text": (
            "Spindle/eye-shaped lesions with grey centre and brown margin on leaves. "
            "Favoured by high humidity and excess nitrogen. Keep field water, avoid "
            "extra urea. If >5% leaf area affected, spray Tricyclazole 75 WP at "
            "0.6 g per litre water, twice at 7-10 day interval."
        ),
    },
    {
        "id": "brri-blb-01",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Bacterial_blight_of_rice.jpeg/960px-Bacterial_blight_of_rice.jpeg",
        "image_credit": "Wikimedia Commons, CC BY 3.0 US",
        "crop": "rice",
        "title": "Bacterial leaf blight (ব্যাকটেরিয়াজনিত পাতাপোড়া)",
        "source": "BRRI Rice Disease Leaflet (simulated)",
        "keywords": ["blight", "পাতাপোড়া", "yellow", "হলুদ", "leaf tip", "dry"],
        "text": (
            "Leaf tips turn yellow then straw-coloured, drying from the edges. "
            "Drain the field for 7-10 days, apply 5 kg potash per bigha, stop urea. "
            "No effective chemical cure; use resistant varieties next season."
        ),
    },
    {
        "id": "brri-bph-01",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Nilaparvata_lugens_-_Brown_planthopper_-_UGA5190055.jpg/960px-Nilaparvata_lugens_-_Brown_planthopper_-_UGA5190055.jpg",
        "image_credit": "Wikimedia Commons, CC BY 3.0 US",
        "crop": "rice",
        "title": "Brown planthopper (বাদামি গাছফড়িং)",
        "source": "BRRI Insect Pest Leaflet (simulated)",
        "keywords": ["planthopper", "গাছফড়িং", "hopper", "burn", "insect", "পোকা"],
        "text": (
            "Insects at the base of the plant; circular 'hopper burn' patches. "
            "Split the canopy into alleys for sunlight, drain water. Spray at the "
            "base only when >10 insects per hill."
        ),
    },
]


@tool
def search_knowledgebase(query: str, crop: str | None = None, top_k: int = 3) -> list[dict]:
    """Search the verified agriculture knowledge base (DAE / BRRI / BARI guidance)
    for disease, pest, fertiliser and cultivation advice. Always prefer this over
    internet search for treatment advice, and cite the returned `id`s.

    Args:
        query: Symptoms or question, in Bangla or English.
        crop: Optional crop filter (e.g. "rice").
        top_k: Number of chunks to return (1-5).
    """
    # SIMULATED: naive keyword overlap; replace with hybrid vector search.
    q = query.lower()
    candidates = [c for c in _CHUNKS if not crop or c["crop"] == crop.lower()]
    scored = sorted(
        ((sum(k.lower() in q for k in c["keywords"]), c) for c in candidates),
        key=lambda x: x[0],
        reverse=True,
    )
    hits = [
        {k: c[k] for k in ("id", "title", "source", "text", "image_url", "image_credit")} | {"score": score}
        for score, c in scored[: max(1, min(top_k, 5))]
        if score > 0
    ]
    return hits or [{"id": None, "text": "No matching guidance found.", "score": 0}]
