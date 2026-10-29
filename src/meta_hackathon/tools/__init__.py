"""Agent tools. Real: get_weather (Open-Meteo), geocode_location (OpenStreetMap),
search_internet (Muse web search), segment_image (SAM 3.1), search_images (Wikimedia
Commons), the DAE pesticide register (find_registered_pesticides, lookup_pesticide_product),
and the crop-case tracker
(start/update/get_crop_case). The rest are simulated for now — swap each body
for the real integration."""

from meta_hackathon.tools.booking import schedule_officer_session
from meta_hackathon.tools.cases import get_crop_case, start_crop_case, update_crop_case
from meta_hackathon.tools.geocode import geocode_location
from meta_hackathon.tools.image_search import search_images
from meta_hackathon.tools.knowledge import search_knowledgebase
from meta_hackathon.tools.pesticides import find_registered_pesticides, lookup_pesticide_product
from meta_hackathon.tools.segment import segment_image
from meta_hackathon.tools.weather import get_weather
from meta_hackathon.tools.web_search import search_internet

ALL_TOOLS = [
    search_internet,
    get_weather,
    # search_knowledgebase,
    find_registered_pesticides,
    lookup_pesticide_product,
    schedule_officer_session,
    geocode_location,
    segment_image,
    search_images,
    start_crop_case,
    update_crop_case,
    get_crop_case,
]

__all__ = ["ALL_TOOLS"]
