"""
백석대학교 건물 좌표 자동 조회 스크립트
실행: python find_coordinates.py
"""
import requests
import json
from dotenv import load_dotenv
import os

load_dotenv()
REST_KEY = os.getenv("KAKAO_REST_API_KEY", "")

BUILDINGS = [
    "백석대 체육관",
    "백석대학교 스포츠센터",
    "천안 백석대학교 체육관",
]

def search_place(query):
    resp = requests.get(
        "https://dapi.kakao.com/v2/local/search/keyword.json",
        headers={"Authorization": f"KakaoAK {REST_KEY}"},
        params={"query": query, "size": 1},
    )
    data = resp.json()
    docs = data.get("documents", [])
    if docs:
        d = docs[0]
        return {
            "place_name": d["place_name"],
            "lat": float(d["y"]),
            "lng": float(d["x"]),
            "address": d.get("road_address_name") or d.get("address_name"),
        }
    return None

print("=" * 60)
results = []
for building in BUILDINGS:
    result = search_place(building)
    if result:
        print(f"✅ {result['place_name']}")
        print(f"   lat={result['lat']}, lng={result['lng']}")
        print(f"   주소: {result['address']}")
        results.append(result)
    else:
        print(f"❌ 찾지 못함: {building}")
    print()

# CAMPUS_PLACES 형식으로 출력
print("=" * 60)
print("▼ main.py CAMPUS_PLACES 에 붙여넣기용:")
print()
for r in results:
    name = r["place_name"].replace("백석대학교 ", "").replace("백석대 ", "")
    print(f'  {{"id": 0, "place_name": "{name}", "building_type": "", "services": [], "lat": {r["lat"]}, "lng": {r["lng"]}, "description": ""}},')
