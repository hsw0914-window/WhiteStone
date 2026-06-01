from fastapi import APIRouter

from services import health_service


router = APIRouter()


@router.get("/")
def read_root():
    return health_service.read_root()
