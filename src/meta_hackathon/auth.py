"""LangGraph Agent Server auth. No real auth yet: the X-Phone-Number header is
trusted as the user identity, and every thread is scoped to its owner's phone."""

from langgraph_sdk import Auth

from meta_hackathon.utils.phone import normalize_phone

auth = Auth()


@auth.authenticate
async def authenticate(headers: dict[bytes, bytes]) -> Auth.types.MinimalUserDict:
    raw = headers.get(b"x-phone-number")
    if not raw:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Missing X-Phone-Number header")
    try:
        phone = normalize_phone(raw.decode())
    except ValueError:
        raise Auth.exceptions.HTTPException(status_code=400, detail="Invalid X-Phone-Number header")
    return {"identity": phone, "is_authenticated": True}


@auth.on
async def owner_only(ctx: Auth.types.AuthContext, value: dict) -> dict:
    """Tag created resources with the owner's phone and filter reads by it."""
    metadata = value.setdefault("metadata", {})
    metadata["owner"] = ctx.user.identity
    return {"owner": ctx.user.identity}
