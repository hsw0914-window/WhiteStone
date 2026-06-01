from fastapi import HTTPException

import runtime
from config import VALID_MAJORS
from schemas import RecommendRequest


def recommend_courses(req: RecommendRequest, current_user: dict):
    return runtime.build_course_recommendation(req.major, req.grade)


def list_roadmap_courses(major: str | None, current_user: dict):
    selected_major = runtime.normalize_major(major or current_user.get("major", ""))
    if selected_major and selected_major not in VALID_MAJORS:
        raise HTTPException(status_code=400, detail="지원하지 않는 전공입니다.")
    courses = runtime.get_roadmap_courses(selected_major) if selected_major else runtime.roadmap_courses
    return {
        "major": selected_major,
        "count": len(courses),
        "courses": courses,
    }
