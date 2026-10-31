"""Krishoker Janala advice (knowledge.py): find the crop problem that fits,
then read its full advice with the register check on every chemical it names.

Sync tools: the lookups block, and LangChain runs sync tools in a thread.
"""

import logging
import threading
from typing import Literal

from langchain.tools import ToolException, tool

from meta_hackathon.knowledge import get_problem, preload, search_problems

logger = logging.getLogger(__name__)


def _warm() -> None:
    try:
        preload()
    except Exception:
        logger.warning("Could not preload the Krishoker Janala advice; the first search will load it.", exc_info=True)


# Load the advice in the background when the agent starts, not on the first farmer's search (~2 s).
threading.Thread(target=_warm, name="kj-preload", daemon=True).start()

ProblemType = Literal["pest", "disease", "deficiency", "weed", "rodent", "other"]


@tool
def search_crop_problems(crop: str, query: str, problem_type: ProblemType | None = None) -> dict:
    """Find crop problems in Krishoker Janala, the DAE's official advice for Bangladeshi farmers
    (998 pests, diseases and deficiencies on 122 crops). Use it first for any pest, disease,
    deficiency or "what is wrong with my crop" question, and for every photo diagnosis.

    - crop: the crop in Bangla or English ("ধান", "বেগুন", "Potato").
    - query: in Bangla, the problem names you suspect AND the symptoms in the farmer's words,
      e.g. "মাজরা পোকা মরা ডিগ সাদা শীষ" or "ব্লাস্ট পাতায় চোখের মতো দাগ ছাই রং". Names you
      suspect matter most; add the likely alternatives too.
    - problem_type: only pests, only diseases, ... when you are sure which kind it is.

    Returns up to 5 problems, best first, with problem_id and the start of the symptoms.
    Compare the symptoms with what the farmer describes or the photo shows, then call
    get_crop_problem for the one that fits (or two, if you cannot tell them apart).
    """
    return search_problems(crop, query, problem_type)


@tool
def get_crop_problem(problem_id: int) -> dict:
    """The full Krishoker Janala advice for one problem from search_crop_problems: symptoms,
    management, do's and don'ts, official reference photos, and every chemical the advice names
    checked against the DAE pesticide register (Dec 2020):

    - chemicals_in_advice: what the advice names, its dose, the active ingredient, and
      registered_for_this_crop with the register's label dose (for_pest says for which pest).
      When registered_for_this_crop is false, do not recommend it: say the register does not
      list it for this crop.
    - registered_for_this_problem: products the register lists for this crop and pest.
    - reference_photos: official photos of the problem, to show the farmer.
    """
    problem = get_problem(problem_id)
    if problem is None:
        raise ToolException(f"No problem {problem_id}; use a problem_id from search_crop_problems.")
    return problem


for _t in (search_crop_problems, get_crop_problem):
    _t.handle_tool_error = True
