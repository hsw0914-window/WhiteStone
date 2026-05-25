from fastapi import APIRouter
from fastapi.routing import APIRoute

import runtime


def build_router(paths: set[str] | None = None, prefixes: tuple[str, ...] = ()) -> APIRouter:
    router = APIRouter()
    for route in runtime.app.routes:
        if not isinstance(route, APIRoute):
            continue
        if paths is not None and route.path not in paths:
            continue
        if prefixes and not any(route.path.startswith(prefix) for prefix in prefixes):
            continue
        router.add_api_route(
            route.path,
            route.endpoint,
            methods=list(route.methods or []),
            name=route.name,
            response_class=route.response_class,
            status_code=route.status_code,
            response_model=route.response_model,
            summary=route.summary,
            description=route.description,
            tags=route.tags,
        )
    return router
