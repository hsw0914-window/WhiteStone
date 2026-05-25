from ._runtime import build_router

router = build_router(prefixes=("/auth",))
