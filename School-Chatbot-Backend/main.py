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
    html, body {{ width:100%; height:100%; overflow:hidden; }}
    #map {{ width:100%; height:100%; position:absolute; top:0; left:0; }}
    .place-label {{
      padding:3px 7px; font-size:11px; font-weight:700;
      color:#1d4ed8; background:#eff6ff;
      border:1px solid #bfdbfe; border-radius:5px; white-space:nowrap;
    }}
    #sheet {{
      display:none; position:fixed; left:0; right:0; bottom:0;
      background:#fff; border-radius:14px 14px 0 0;
      box-shadow:0 -3px 12px rgba(0,0,0,0.18);
      z-index:999; max-height:52%; flex-direction:column;
    }}
    #sheet-handle {{
      width:36px; height:4px; background:#ddd; border-radius:2px;
      margin:8px auto 4px; flex-shrink:0;
    }}
    #sheet-header {{
      background:#1B76FF; color:#fff;
      padding:10px 14px 10px; flex-shrink:0;
    }}
    #sheet-dest {{ font-size:15px; font-weight:700; }}
    #sheet-summary {{ font-size:12px; margin-top:3px; opacity:0.88; }}
    #steps-list {{ overflow-y:auto; flex:1; padding:4px 0 8px; }}
    .step-item {{
      display:flex; align-items:center;
      padding:9px 14px; border-bottom:1px solid #f3f3f3;
      transition: background 0.3s;
    }}
    .step-item.done {{ opacity:0.4; }}
    .step-item.current {{ background:#e8f0fe; }}
    .step-icon {{
      width:30px; height:30px; border-radius:50%;
      background:#e8f0fe; display:flex; align-items:center;
      justify-content:center; font-size:15px; flex-shrink:0;
    }}
    .step-item.current .step-icon {{ background:#1B76FF; color:#fff; }}
    .step-info {{ margin-left:10px; }}
    .step-dir {{ font-size:13px; font-weight:600; color:#1a1a1a; }}
    .step-dist {{ font-size:11px; color:#999; margin-top:1px; }}
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="sheet">
    <div id="sheet-handle"></div>
    <div id="sheet-header">
      <div id="sheet-dest">목적지</div>
      <div id="sheet-summary"></div>
    </div>
    <div id="steps-list"></div>
  </div>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey={KAKAO_JS_KEY}"></script>
  <script>
    var map = new kakao.maps.Map(document.getElementById('map'), {{
      center: new kakao.maps.LatLng(36.8397, 127.1840),
      level: 4
    }});

    var places        = {places_json};
    var openInfowindow = null;
    var routePolyline  = null;
    var userOverlay    = null;
    var destMarker     = null;
    var stepOverlays   = [];

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

    // ── 방향 아이콘 ──
    function dirIcon(dir) {{
      if (dir.includes('오른쪽')) return '↱';
      if (dir.includes('왼쪽'))  return '↰';
      if (dir.includes('직진') || dir.includes('계속')) return '↑';
      if (dir.includes('출발')) return '🚶';
      if (dir.includes('도착')) return '📍';
      return '↑';
    }}

    // ── 경로 그리기 ──
    function drawRoute(routePoints, dest, steps, distance, duration) {{
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

      // 기존 step 마커 제거
      stepOverlays.forEach(function(o) {{ o.setMap(null); }});
      stepOverlays = [];

      // step 번호 마커 추가
      (steps || []).forEach(function(s, i) {{
        if (s.lat == null || s.lng == null) return;
        var content =
          '<div style="' +
            'width:24px;height:24px;border-radius:50%;' +
            'background:#fff;border:2px solid #1B76FF;' +
            'display:flex;align-items:center;justify-content:center;' +
            'font-size:11px;font-weight:700;color:#1B76FF;' +
            'box-shadow:0 1px 4px rgba(0,0,0,0.25);' +
          '">' + (i + 1) + '</div>';
        var overlay = new kakao.maps.CustomOverlay({{
          position: new kakao.maps.LatLng(s.lat, s.lng),
          content: content,
          zIndex: 5,
        }});
        overlay.setMap(map);
        stepOverlays.push(overlay);
      }});

      // 하단 시트 표시
      document.getElementById('sheet-dest').textContent = '📍 ' + dest.place_name;
      document.getElementById('sheet-summary').textContent =
        (duration || '?') + '분  ·  ' + (distance >= 1000 ? (distance/1000).toFixed(1) + 'km' : distance + 'm');

      var list = document.getElementById('steps-list');
      list.innerHTML = '';
      (steps || []).forEach(function(s) {{
        var item = document.createElement('div');
        item.className = 'step-item';
        item.innerHTML =
          '<div class="step-icon">' + dirIcon(s.direction) + '</div>' +
          '<div class="step-info">' +
            '<div class="step-dir">' + s.direction + '</div>' +
            '<div class="step-dist">' + (s.distance >= 1000 ? (s.distance/1000).toFixed(1)+'km' : s.distance+'m') + ' 이동</div>' +
          '</div>';
        list.appendChild(item);
      }});

      document.getElementById('sheet').style.display = 'flex';
      setTimeout(function() {{ highlightStep(0); }}, 100);
    }}

    // ── step 하이라이트 ──
    function highlightStep(index) {{
      // 패널 항목 색상
      var items = document.querySelectorAll('.step-item');
      items.forEach(function(item, i) {{
        item.classList.remove('current', 'done');
        if (i < index)        item.classList.add('done');
        else if (i === index) item.classList.add('current');
      }});
      if (items[index]) {{
        items[index].scrollIntoView({{ behavior: 'smooth', block: 'center' }});
      }}

      // 지도 마커 색상
      stepOverlays.forEach(function(overlay, i) {{
        var num  = i + 1;
        var done = i < index;
        var curr = i === index;
        var bg   = curr ? '#1B76FF' : (done ? '#ccc' : '#fff');
        var fg   = curr ? '#fff'    : (done ? '#fff' : '#1B76FF');
        var border = done ? '#ccc' : '#1B76FF';
        var label  = done ? '✓' : num;
        overlay.setContent(
          '<div style="' +
            'width:24px;height:24px;border-radius:50%;' +
            'background:' + bg + ';border:2px solid ' + border + ';' +
            'display:flex;align-items:center;justify-content:center;' +
            'font-size:11px;font-weight:700;color:' + fg + ';' +
            'box-shadow:0 1px 4px rgba(0,0,0,0.25);' +
          '">' + label + '</div>'
        );
      }});
    }}

    // ── 안내 종료 ──
    function clearRoute() {{
      if (routePolyline) routePolyline.setMap(null);
      if (destMarker)    destMarker.setMap(null);
      stepOverlays.forEach(function(o) {{ o.setMap(null); }});
      routePolyline = null;
      destMarker    = null;
      stepOverlays  = [];
      document.getElementById('sheet').style.display = 'none';
    }}

    // ── React Native → WebView 메시지 ──
    function handleMessage(event) {{
      try {{
        var data = JSON.parse(event.data);
        if (data.type === 'UPDATE_LOCATION') updateUserLocation(data.lat, data.lng);
        if (data.type === 'DRAW_ROUTE')      drawRoute(data.route, data.destination, data.steps, data.distance, data.duration);
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
MANEUVER_KO = {
    ("depart",  "straight"):     "출발 후 직진",
    ("depart",  None):           "출발",
    ("arrive",  None):           "목적지 도착",
    ("turn",    "right"):        "오른쪽 방향",
    ("turn",    "left"):         "왼쪽 방향",
    ("turn",    "slight right"): "오른쪽으로 살짝",
    ("turn",    "slight left"):  "왼쪽으로 살짝",
    ("turn",    "sharp right"):  "오른쪽으로 크게",
    ("turn",    "sharp left"):   "왼쪽으로 크게",
    ("turn",    "straight"):     "직진",
    ("continue","straight"):     "직진",
    ("continue", None):          "계속 직진",
    ("new name","straight"):     "직진",
}

def get_osrm_route(origin_lat, origin_lng, dest_lat, dest_lng):
    url = (
        f"http://router.project-osrm.org/route/v1/foot/"
        f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
        f"?geometries=geojson&overview=full&steps=true"
    )
    resp = http.get(url, timeout=10)
    data = resp.json()

    if data.get("code") != "Ok" or not data.get("routes"):
        return [], [], 0, 0

    route_data = data["routes"][0]
    coords = route_data["geometry"]["coordinates"]
    points = [{"lat": c[1], "lng": c[0]} for c in coords]

    total_distance = round(route_data.get("distance", 0))
    total_duration = round(route_data.get("duration", 0) / 60)

    steps = []
    for leg in route_data.get("legs", []):
        for step in leg.get("steps", []):
            maneuver  = step.get("maneuver", {})
            m_type    = maneuver.get("type")
            m_mod     = maneuver.get("modifier")
            dist      = round(step.get("distance", 0))
            location  = maneuver.get("location", [])
            direction = (
                MANEUVER_KO.get((m_type, m_mod))
                or MANEUVER_KO.get((m_type, None))
                or m_type or "직진"
            )
            if dist < 2:
                continue
            steps.append({
                "direction": direction,
                "distance":  dist,
                "lng": location[0] if location else None,
                "lat": location[1] if location else None,
            })

    return points, steps, total_distance, total_duration


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

        route, steps, distance, duration = get_osrm_route(req.lat, req.lng, destination["lat"], destination["lng"])
        return {
            "destination": destination,
            "route":       route,
            "steps":       steps,
            "distance":    distance,
            "duration":    duration,
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
