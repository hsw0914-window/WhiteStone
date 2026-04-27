from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json, os, re, requests as http
from dotenv import load_dotenv
from google import genai

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

KAKAO_JS_KEY      = os.getenv("KAKAO_JS_KEY", "")
KAKAO_REST_KEY    = os.getenv("KAKAO_REST_API_KEY", "")
GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY", "")

# ── 장소 데이터 (DB 연결 전 mock) ─────────────────────────────────────────────
CAMPUS_PLACES = [
    {"id":  1, "place_name": "진리관",          "building_type": "강의동", "services": ["인쇄", "복사"],              "lat": 36.840163, "lng": 127.184503, "description": "1층에 인쇄·복사 기기 있음"},
    {"id":  2, "place_name": "도서관",           "building_type": "도서관", "services": ["열람", "학습", "자료검색"],  "lat": 36.8374,   "lng": 127.1836,   "description": "백석대 중앙도서관"},
    {"id":  3, "place_name": "학생복지관",       "building_type": "복지동", "services": ["학생지원", "장학", "상담"],  "lat": 36.840621, "lng": 127.182499, "description": "장학 및 학생 지원 업무"},
    {"id":  4, "place_name": "학생식당",         "building_type": "식당",   "services": ["식당", "학생식당"],          "lat": 36.840500, "lng": 127.182600, "description": "학생 대상 구내식당"},
    {"id":  5, "place_name": "지혜관",           "building_type": "강의동", "services": ["강의", "학습", "사회복지", "상담심리"],    "lat": 36.838697, "lng": 127.184373, "description": "사회복지·상담심리 학부 강의동"},
    {"id":  6, "place_name": "인성관",           "building_type": "강의동", "services": ["강의", "학습", "신학", "기독교"],          "lat": 36.839426, "lng": 127.183537, "description": "신학·기독교학부 강의동"},
    {"id":  7, "place_name": "본부동",           "building_type": "행정동", "services": ["행정", "학사", "등록", "증명서", "민원"],   "lat": 36.839646, "lng": 127.185891, "description": "학사행정·증명서 발급"},
    {"id":  8, "place_name": "글로벌외식산업관", "building_type": "강의동", "services": ["강의", "외식", "조리", "식품"],            "lat": 36.837539, "lng": 127.185102, "description": "외식·조리학부 강의동"},
    {"id":  9, "place_name": "창조관",           "building_type": "강의동", "services": ["강의", "디자인", "영상", "방송"],          "lat": 36.837398, "lng": 127.182433, "description": "디자인·영상방송학부 강의동"},
    {"id": 10, "place_name": "백석홀",           "building_type": "강당",   "services": ["강당", "행사", "공연", "채플"],            "lat": 36.839395, "lng": 127.182501, "description": "채플 및 대형 행사장"},
    {"id": 11, "place_name": "교수회관",         "building_type": "교수동", "services": ["교수", "면담", "연구", "상담"],            "lat": 36.839720, "lng": 127.184766, "description": "교수 연구실 및 면담실"},
    {"id": 12, "place_name": "승리관",           "building_type": "강의동", "services": ["강의", "경영", "경제", "무역"],            "lat": 36.841776, "lng": 127.185807, "description": "경영·경제학부 강의동"},
    {"id": 13, "place_name": "조형관",           "building_type": "강의동", "services": ["강의", "조형", "미술", "회화"],            "lat": 36.840871, "lng": 127.188460, "description": "조형·미술학부 강의동"},
    {"id": 14, "place_name": "예술대학동",       "building_type": "강의동", "services": ["강의", "예술", "음악", "실용음악"],        "lat": 36.838872, "lng": 127.187748, "description": "음악·실용음악학부 강의동"},
    {"id": 15, "place_name": "체육관",           "building_type": "체육관", "services": ["체육", "운동", "스포츠", "헬스", "농구"],  "lat": 36.841338, "lng": 127.187358, "description": "체육 시설 및 헬스장"},
]

# ── 카카오맵 HTML ──────────────────────────────────────────────────────────────
@app.get("/map", response_class=HTMLResponse)
def get_map():
    places_json = json.dumps(CAMPUS_PLACES, ensure_ascii=False)
    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
  <style>
    * {{ margin:0; padding:0; box-sizing:border-box; }}
    body {{ overflow:hidden; }}
    #map {{ width:100%; height:100vh; }}
    .place-label {{
      padding:4px 8px; font-size:12px; font-weight:700;
      color:#1d4ed8; background:#eff6ff;
      border:1px solid #bfdbfe; border-radius:6px; white-space:nowrap;
    }}
    #nav-bar {{
      display:none; position:fixed; bottom:0; left:0; right:0;
      background:#1B76FF; color:#fff; padding:14px 20px;
      font-size:15px; font-weight:700; text-align:center;
      z-index:999;
    }}
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="nav-bar">안내 중...</div>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey={KAKAO_JS_KEY}"></script>
  <script>
    var map = new kakao.maps.Map(document.getElementById('map'), {{
      center: new kakao.maps.LatLng(36.8397, 127.1840),
      level: 4
    }});

    var places       = {places_json};
    var openInfowindow = null;
    var routePolyline  = null;
    var userOverlay    = null;
    var destMarker     = null;

    // ── 장소 마커 ──
    places.forEach(function(place) {{
      var pos    = new kakao.maps.LatLng(place.lat, place.lng);
      var marker = new kakao.maps.Marker({{ position: pos, map: map }});
      var iw     = new kakao.maps.InfoWindow({{
        content: '<div class="place-label">' + place.place_name + '</div>',
        removable: true,
      }});
      kakao.maps.event.addListener(marker, 'click', function() {{
        if (openInfowindow) openInfowindow.close();
        iw.open(map, marker);
        openInfowindow = iw;
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          JSON.stringify({{ type: 'MARKER_CLICK', place: place }})
        );
      }});
    }});

    // ── 사용자 위치 마커 (파란 점) ──
    function updateUserLocation(lat, lng) {{
      var pos = new kakao.maps.LatLng(lat, lng);
      var dot = '<div style="width:16px;height:16px;background:#1B76FF;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(27,118,255,0.5);"></div>';
      if (!userOverlay) {{
        userOverlay = new kakao.maps.CustomOverlay({{ content: dot, position: pos, zIndex: 10 }});
        userOverlay.setMap(map);
      }} else {{
        userOverlay.setPosition(pos);
      }}
      map.setCenter(pos);
    }}

    // ── 경로 그리기 ──
    function drawRoute(routePoints, dest) {{
      if (routePolyline) routePolyline.setMap(null);
      if (destMarker)    destMarker.setMap(null);

      var path = routePoints.map(function(p) {{
        return new kakao.maps.LatLng(p.lat, p.lng);
      }});

      routePolyline = new kakao.maps.Polyline({{
        path: path,
        strokeWeight: 6,
        strokeColor: '#1B76FF',
        strokeOpacity: 0.9,
        strokeStyle: 'solid'
      }});
      routePolyline.setMap(map);

      // 목적지 마커
      destMarker = new kakao.maps.Marker({{
        position: new kakao.maps.LatLng(dest.lat, dest.lng),
        map: map,
      }});
      new kakao.maps.InfoWindow({{
        content: '<div class="place-label">📍 ' + dest.place_name + '</div>',
      }}).open(map, destMarker);

      // 경로 전체가 보이도록 범위 조정
      var bounds = new kakao.maps.LatLngBounds();
      path.forEach(function(p) {{ bounds.extend(p); }});
      map.setBounds(bounds, 60);

      document.getElementById('nav-bar').style.display = 'block';
      document.getElementById('nav-bar').textContent   = dest.place_name + ' 으로 안내 중';
    }}

    // ── 안내 종료 ──
    function clearRoute() {{
      if (routePolyline) routePolyline.setMap(null);
      if (destMarker)    destMarker.setMap(null);
      routePolyline = null;
      destMarker    = null;
      document.getElementById('nav-bar').style.display = 'none';
    }}

    // ── React Native → WebView 메시지 ──
    function handleMessage(event) {{
      try {{
        var data = JSON.parse(event.data);
        if (data.type === 'UPDATE_LOCATION') updateUserLocation(data.lat, data.lng);
        if (data.type === 'DRAW_ROUTE')      drawRoute(data.route, data.destination);
        if (data.type === 'CLEAR_ROUTE')     clearRoute();
        if (data.type === 'MOVE_TO') {{
          map.setCenter(new kakao.maps.LatLng(data.lat, data.lng));
          map.setLevel(3);
        }}
      }} catch(e) {{}}
    }}
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
  </script>
</body>
</html>"""
    return HTMLResponse(content=html)


# ── 키워드 기반 폴백 ──────────────────────────────────────────────────────────
def keyword_match(question: str) -> str | None:
    q = question
    for place in CAMPUS_PLACES:
        if place["place_name"] in q:
            return place["place_name"]
        for svc in place["services"]:
            if svc in q:
                return place["place_name"]
    return None

# ── Gemini: 자연어 → 목적지 추출 (실패 시 키워드 폴백) ──────────────────────
def extract_destination(question: str) -> str | None:
    try:
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        place_list = [{"name": p["place_name"], "services": p["services"]} for p in CAMPUS_PLACES]
        prompt = f"""사용자 입력: "{question}"

캠퍼스 장소 목록:
{json.dumps(place_list, ensure_ascii=False)}

위 장소 중 사용자가 가고 싶은 곳을 찾아서 JSON만 출력해. 설명 없이 JSON만:
{{"place_name": "장소명"}}

찾을 수 없으면: {{"place_name": null}}"""

        response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        text = getattr(response, "text", "").strip()
        match = re.search(r'\{.*?\}', text, re.DOTALL)
        if match:
            name = json.loads(match.group()).get("place_name")
            if name:
                return name
    except Exception:
        pass

    # Gemini 실패 시 키워드 매칭으로 폴백
    return keyword_match(question)


# ── OSRM 경로 API (무료, API 키 불필요) ──────────────────────────────────────
def get_osrm_route(origin_lat, origin_lng, dest_lat, dest_lng):
    url = (
        f"http://router.project-osrm.org/route/v1/foot/"
        f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
        f"?geometries=geojson&overview=full"
    )
    resp = http.get(url, timeout=10)
    data = resp.json()

    if data.get("code") != "Ok" or not data.get("routes"):
        return []

    coords = data["routes"][0]["geometry"]["coordinates"]
    return [{"lat": c[1], "lng": c[0]} for c in coords]


# ── /navigate 엔드포인트 ──────────────────────────────────────────────────────
class NavigateRequest(BaseModel):
    question: str
    lat: float
    lng: float

@app.post("/navigate")
def navigate(req: NavigateRequest):
    try:
        place_name  = extract_destination(req.question)
        destination = next((p for p in CAMPUS_PLACES if p["place_name"] == place_name), None)
        if not destination:
            return {"error": f"'{place_name}' 장소를 찾을 수 없습니다."}

        route = get_osrm_route(req.lat, req.lng, destination["lat"], destination["lng"])
        return {
            "destination": destination,
            "route":       route,
            "answer":      f"{destination['place_name']}으로 안내를 시작합니다.",
        }
    except Exception as e:
        return {"error": str(e)}


# ── 기존 챗봇 ─────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    question: str

with open("faq_data.json", "r", encoding="utf-8") as f:
    faq_data = json.load(f)

def classify_question(question: str) -> str:
    q = question.lower()
    for category, data in faq_data.items():
        if category == "general":
            continue
        for keyword in data["keywords"]:
            if keyword.lower() in q:
                return category
    return "general"

def get_answer_by_category(category: str) -> str:
    return faq_data.get(category, faq_data["general"])["answer"]

def generate_gemini_answer(question: str, category: str, base_answer: str) -> str:
    client = genai.Client(api_key=GEMINI_API_KEY)
    prompt = f"""
사용자 질문: {question}
분류 카테고리: {category}
기본 안내 정보: {base_answer}

위 정보를 바탕으로 대학생이 이해하기 쉽게
한국어로 2~3문장 이내로 자연스럽게 답변해줘.
제공된 정보 범위를 벗어나서 추측하지 말고,
모르면 모른다고 답해.
"""
    response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
    return getattr(response, "text", str(response))

@app.get("/")
def read_root():
    return {"message": "FastAPI 연결 성공"}

@app.get("/faq")
def get_faq():
    return faq_data

@app.post("/chat")
def chat(req: ChatRequest):
    try:
        category     = classify_question(req.question)
        base_answer  = get_answer_by_category(category)
        final_answer = generate_gemini_answer(req.question, category, base_answer)
        return {"question": req.question, "category": category, "base_answer": base_answer, "answer": final_answer}
    except Exception as e:
        return {"error": str(e)}
