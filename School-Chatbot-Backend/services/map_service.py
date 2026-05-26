import json
import re

import runtime
from ai_client import generate_ai_text, has_ai_key
from schemas import NavigateRequest


def get_map():
    return runtime.get_map()


def navigate(req: NavigateRequest):
    try:
        place_name = None
        place_list = [
            {"name": place["place_name"], "services": place.get("services", [])}
            for place in runtime.building_places
        ]
        prompt = f"""사용자 입력: "{req.question}"

캠퍼스 장소 목록:
{json.dumps(place_list, ensure_ascii=False)}

위 장소 중 사용자가 가고 싶은 곳을 찾아서 JSON만 출력해. 설명 없이 JSON만:
{{"place_name": "장소명"}}

찾을 수 없으면: {{"place_name": null}}"""

        if has_ai_key():
            try:
                text = generate_ai_text(prompt, max_tokens=300).strip()
                match = re.search(r"\{.*?\}", text, re.DOTALL)
                if match:
                    place_name = json.loads(match.group()).get("place_name")
            except Exception:
                place_name = None

        destination = next(
            (place for place in runtime.building_places if place.get("place_name") == place_name),
            None,
        ) if place_name else None
        if not destination:
            destination = runtime.find_destination_by_text(req.question)
        if not destination:
            return {"error": "요청한 장소를 찾을 수 없습니다. 건물명이나 주요 시설명을 조금 더 구체적으로 입력해주세요."}

        route, steps, distance, duration = runtime.get_osrm_route(
            req.lat,
            req.lng,
            destination["lat"],
            destination["lng"],
        )
        return {
            "destination": destination,
            "route": route,
            "steps": steps,
            "distance": distance,
            "duration": duration,
            "answer": f"{destination['place_name']}으로 안내를 시작합니다.",
        }
    except Exception as exc:
        return {"error": str(exc)}
