from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import json, os, re, requests as http
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
import sqlite3, secrets, uuid
from datetime import datetime, timedelta

from ai_client import generate_ai_text, has_ai_key
from config import (
    BASE_DIR,
    DB_PATH,
    DISTANCE_THRESHOLD,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_WEB_CLIENT_ID,
    GRADE_MAX,
    GRADE_MIN,
    KAKAO_JS_KEY,
    KAKAO_REST_KEY,
    SCOPE_DISTANCE_THRESHOLD,
    TOP_K,
    VALID_MAJORS,
)
from db import get_current_user, get_db, hash_password, init_db
from schemas import (
    ChatRequest,
    GoogleAuthRequest,
    GoogleCodeRequest,
    LoginRequest,
    MessageCreate,
    NavigateRequest,
    ProfileUpdateRequest,
    RecommendRequest,
    SessionCreate,
    SignupRequest,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 전역 변수 (startup 시 초기화) ────────────────────────────────────────────
model           = None
index           = None
dataset         = []
building_places = []
roadmap_courses = []
response_cache  = {}

SCHOOL_SCOPE_KEYWORDS = [
    "백석", "백석대", "백석대학교", "학교", "대학교", "대학", "캠퍼스",
    "학사", "학기", "수강", "수업", "강의", "교과", "과목", "전공",
    "성적", "졸업", "학점", "등록금", "장학", "장학금", "기숙사",
    "생활관", "도서관", "학술정보관", "셔틀", "버스", "통학",
    "건물", "위치", "식당", "학생식당", "채플", "증명서", "발급",
    "비교과", "동아리", "교수", "학부", "학과", "사무실", "부서",
    "와이파이", "wifi", "wi-fi", "bu-wlan", "로드맵", "진로",
    "카피킬러", "교내", "학번", "학생", "입학", "복학", "휴학",
    "인쇄", "프린트", "복사", "복사기", "프린터",
]

def user_to_dict(user) -> dict:
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "major": user["major"] if "major" in user.keys() and user["major"] else "",
        "grade": int(user["grade"] or 0) if "grade" in user.keys() else 0,
    }


def normalize_major(value: str) -> str:
    text = (value or "").strip()
    aliases = {
        "bigdata": "빅데이터",
        "빅데이터전공": "빅데이터",
        "fintech": "핀테크",
        "핀테크전공": "핀테크",
        "iot": "IoT",
        "IOT": "IoT",
        "IoT전공": "IoT",
        "arvr": "AR·VR",
        "ARVR": "AR·VR",
        "AR/VR": "AR·VR",
        "AR·VR전공": "AR·VR",
        "ARㆍVR": "AR·VR",
    }
    return aliases.get(text, text)


def validate_profile_values(major: str, grade: int):
    normalized_major = normalize_major(major)
    try:
        normalized_grade = int(grade)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="학년은 1~4 사이 숫자여야 합니다.")
    if normalized_major not in VALID_MAJORS:
        raise HTTPException(status_code=400, detail="지원하지 않는 전공입니다.")
    if normalized_grade < GRADE_MIN or normalized_grade > GRADE_MAX:
        raise HTTPException(status_code=400, detail="학년은 1~4 사이여야 합니다.")
    return normalized_major, normalized_grade


# ── 서버 시작 시 한 번만 로드 ─────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    global model, index, dataset, building_places, roadmap_courses, response_cache

    init_db()
    print("AI 챗봇 엔진 초기화 중...")

    dataset = []
    building_places = []
    roadmap_courses = []
    response_cache = {}

    model = SentenceTransformer("jhgan/ko-sroberta-multitask", device="cpu")

    dataset_path = os.path.join(BASE_DIR, "dataset.json")
    with open(dataset_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                dataset.append(json.loads(line))

    docs_to_embed = [d["instruction"] + " " + d["output"] for d in dataset]
    embeddings = model.encode(docs_to_embed)
    embeddings = np.array(embeddings).astype("float32")

    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings)

    building_places = [
        d for d in dataset
        if d.get("label") == "건물주소" and d.get("lat") is not None
    ]

    roadmap_courses = build_roadmap_courses_from_dataset()

    print(f"초기화 완료: {len(dataset)}개 데이터, {len(building_places)}개 건물, {len(roadmap_courses)}개 로드맵 과목")


# ── FAISS 검색 (top-K) ───────────────────────────────────────────────────────
def faiss_search(question: str):
    query_embedding = model.encode([question])
    query_embedding = np.array(query_embedding).astype("float32")
    distances, indices = index.search(query_embedding, TOP_K)
    return indices[0], distances[0]


# ── 서비스 키워드 기반 건물 필터링 ──────────────────────────────────────────────
SERVICE_MAP = {
    "인쇄":  "인쇄",  "프린트": "인쇄",  "출력":  "인쇄",
    "복사":  "복사",
    "식당":  "식당",  "밥":    "식당",   "먹":   "식당",  "구내식당": "식당",
    "편의점": "편의점",
    "컴퓨터": "컴퓨터", "pc":   "컴퓨터",
    "보건실": "보건실", "아파":  "보건실", "병원": "보건실",
    "우체국": "우체국", "택배":  "우체국",
    "서점":  "서점",  "책":   "서점",
    "체육관": "체육관", "헬스":  "체육관", "운동": "체육관",
    "도서관": "열람",  "열람실": "열람",
    "주차":  "주차",
    "상담":  "상담",
    "행정":  "행정",  "증명서": "증명서", "등록": "등록",
}

def filter_buildings_by_keyword(question: str) -> list:
    question_lower = question.lower()
    matched_services = set()
    for keyword, service in SERVICE_MAP.items():
        if keyword in question_lower:
            matched_services.add(service)

    if not matched_services:
        return []

    seen = set()
    result = []
    for p in building_places:
        if any(s in p.get("services", []) for s in matched_services):
            if p["place_name"] not in seen:
                seen.add(p["place_name"])
                result.append(p)
    return result


# ── 신뢰도 계산 ───────────────────────────────────────────────────────────────
def calc_confidence(distance: float) -> float:
    return round(max(0.0, 1.0 - distance / DISTANCE_THRESHOLD), 3)


def is_school_related_question(question: str, best_distance: float | None = None) -> bool:
    text = (question or "").strip().lower()
    if not text:
        return False
    if any(keyword.lower() in text for keyword in SCHOOL_SCOPE_KEYWORDS):
        return True
    return best_distance is not None and best_distance <= SCOPE_DISTANCE_THRESHOLD


def out_of_scope_response(question: str) -> dict:
    return {
        "question": question,
        "category": "범위밖",
        "matched_question": None,
        "confidence": 0.0,
        "answer": (
            "저는 백석대학교 학교생활 안내를 도와주는 챗봇이에요. "
            "학사일정, 수강신청, 장학금, 기숙사, 교통, 도서관, 캠퍼스 시설 같은 "
            "학교 관련 질문을 해주세요."
        ),
        "source": "scope_guard",
    }


# ── 카카오맵 HTML ──────────────────────────────────────────────────────────────
@app.get("/map", response_class=HTMLResponse)
def get_map():
    places_json = json.dumps(building_places, ensure_ascii=False)
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
      padding:5px 8px; font-size:11px; font-weight:800;
      color:#1d4ed8; background:#eff6ff;
      border:1px solid #bfdbfe; border-radius:8px; white-space:nowrap;
      box-shadow:0 4px 12px rgba(15,23,42,0.14);
    }}
    #sheet {{
      display:none; position:fixed; left:0; right:0; bottom:0;
      background:#fff; border-radius:8px 8px 0 0;
      border-top:1px solid #e5ebf4;
      box-shadow:0 -8px 24px rgba(15,23,42,0.16);
      z-index:999; max-height:54%; flex-direction:column;
    }}
    #sheet-handle {{
      width:36px; height:4px; background:#d8dfeb; border-radius:999px;
      margin:9px auto 6px; flex-shrink:0;
    }}
    #sheet-header {{
      color:#0f172a; padding:6px 14px 12px; flex-shrink:0;
      border-bottom:1px solid #eef2fa;
    }}
    #sheet-dest {{ font-size:15px; font-weight:900; letter-spacing:0; }}
    #sheet-summary {{
      display:inline-block; font-size:11px; margin-top:6px; font-weight:800;
      color:#2563eb; background:#eff6ff; border-radius:999px;
      padding:4px 8px;
    }}
    #steps-list {{ overflow-y:auto; flex:1; padding:8px 10px 12px; }}
    .step-item {{
      display:flex; align-items:center;
      padding:10px; margin-bottom:6px; border:1px solid #eef2fa;
      border-radius:8px; background:#f8fafc;
      transition: background 0.3s;
    }}
    .step-item.done {{ opacity:0.4; }}
    .step-item.current {{ background:#eff6ff; border-color:#bfdbfe; }}
    .step-icon {{
      width:30px; height:30px; border-radius:8px;
      background:#e6eefe; display:flex; align-items:center;
      justify-content:center; font-size:14px; flex-shrink:0; color:#2563eb;
    }}
    .step-item.current .step-icon {{ background:#2563eb; color:#fff; }}
    .step-info {{ margin-left:10px; }}
    .step-dir {{ font-size:13px; font-weight:800; color:#0f172a; }}
    .step-dist {{ font-size:11px; color:#5b6479; margin-top:2px; font-weight:700; }}
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
    var lastUserPosition = null;
    var destMarker     = null;
    var stepOverlays   = [];
    var routeSteps     = [];
    var routeDuration  = 0;
    var followUser     = true;
    var routeActive    = false;
    var hasFitRoute    = false;

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
      }});
    }});

    kakao.maps.event.addListener(map, 'dragstart', function() {{
      followUser = false;
      if (window.ReactNativeWebView) {{
        window.ReactNativeWebView.postMessage(JSON.stringify({{ type: 'USER_DRAGGED_MAP' }}));
      }}
    }});

    function updateUserLocation(lat, lng, shouldFollow) {{
      var pos = new kakao.maps.LatLng(lat, lng);
      lastUserPosition = pos;
      var dot = '<div style="width:16px;height:16px;background:#1B76FF;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(27,118,255,0.5);"></div>';
      if (!userOverlay) {{
        userOverlay = new kakao.maps.CustomOverlay({{ content: dot, position: pos, zIndex: 10 }});
        userOverlay.setMap(map);
      }} else {{
        userOverlay.setPosition(pos);
      }}
      if (shouldFollow || followUser) {{
        map.panTo(pos);
      }}
    }}

    function stepMarkerHtml(label, active) {{
      var bg = active ? '#2563EB' : '#fff';
      var fg = active ? '#fff' : '#2563EB';
      var border = active ? '#2563EB' : '#bfdbfe';
      return '<div style="width:24px;height:24px;border-radius:8px;background:' + bg + ';border:2px solid ' + border + ';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:' + fg + ';box-shadow:0 4px 12px rgba(15,23,42,0.22);">' + label + '</div>';
    }}

    function setStepVisibility(activeStepIndex) {{
      stepOverlays.forEach(function(overlay, i) {{
        if (i < activeStepIndex) {{
          overlay.setMap(null);
        }} else {{
          overlay.setContent(stepMarkerHtml(i + 1, i === activeStepIndex));
          overlay.setMap(map);
        }}
      }});
    }}

    function renderSteps(activeStepIndex) {{
      var list = document.getElementById('steps-list');
      list.innerHTML = '';
      var remaining = routeSteps.slice(activeStepIndex);
      if (!remaining.length) {{
        var done = document.createElement('div');
        done.className = 'step-item current';
        done.innerHTML =
          '<div class="step-icon">✓</div>' +
          '<div class="step-info">' +
            '<div class="step-dir">도착지 근처에 도착했습니다</div>' +
            '<div class="step-dist">안내를 종료합니다</div>' +
          '</div>';
        list.appendChild(done);
        return;
      }}

      remaining.forEach(function(s, offset) {{
        var item = document.createElement('div');
        item.className = 'step-item' + (offset === 0 ? ' current' : '');
        item.innerHTML =
          '<div class="step-icon">' + dirIcon(s.direction) + '</div>' +
          '<div class="step-info">' +
            '<div class="step-dir">' + s.direction + '</div>' +
            '<div class="step-dist">' + (s.distance >= 1000 ? (s.distance/1000).toFixed(1)+'km' : s.distance+'m') + ' 이동</div>' +
          '</div>';
        list.appendChild(item);
      }});
    }}

    function updateProgress(activeStepIndex, remainingDistance) {{
      var safeIndex = Math.max(0, Math.min(activeStepIndex || 0, routeSteps.length));
      renderSteps(safeIndex);
      setStepVisibility(safeIndex);
      if (remainingDistance != null) {{
        document.getElementById('sheet-summary').textContent =
          '남은 거리 ' + (remainingDistance >= 1000 ? (remainingDistance/1000).toFixed(1) + 'km' : remainingDistance + 'm');
      }}
    }}

    function dirIcon(dir) {{
      if (dir.includes('오른쪽')) return '↱';
      if (dir.includes('왼쪽'))  return '↰';
      if (dir.includes('직진') || dir.includes('계속')) return '↑';
      if (dir.includes('출발')) return '🚶';
      if (dir.includes('도착')) return '📍';
      return '↑';
    }}

    function drawRoute(routePoints, dest, steps, distance, duration) {{
      if (routePolyline) routePolyline.setMap(null);
      if (destMarker)    destMarker.setMap(null);

      var path = routePoints.map(function(p) {{
        return new kakao.maps.LatLng(p.lat, p.lng);
      }});

      routePolyline = new kakao.maps.Polyline({{
        path: path, strokeWeight: 6,
        strokeColor: '#1B76FF', strokeOpacity: 0.9, strokeStyle: 'solid'
      }});
      routePolyline.setMap(map);

      destMarker = new kakao.maps.Marker({{
        position: new kakao.maps.LatLng(dest.lat, dest.lng), map: map,
      }});
      new kakao.maps.InfoWindow({{
        content: '<div class="place-label">목적지 · ' + dest.place_name + '</div>',
      }}).open(map, destMarker);

      var bounds = new kakao.maps.LatLngBounds();
      path.forEach(function(p) {{ bounds.extend(p); }});
      map.setBounds(bounds, 60);

      stepOverlays.forEach(function(o) {{ o.setMap(null); }});
      stepOverlays = [];

      (steps || []).forEach(function(s, i) {{
        if (s.lat == null || s.lng == null) return;
        var content =
          '<div style="width:24px;height:24px;border-radius:8px;background:#fff;border:2px solid #2563EB;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#2563EB;box-shadow:0 4px 12px rgba(15,23,42,0.22);">' + (i + 1) + '</div>';
        var overlay = new kakao.maps.CustomOverlay({{
          position: new kakao.maps.LatLng(s.lat, s.lng), content: content, zIndex: 5,
        }});
        overlay.setMap(map);
        stepOverlays.push(overlay);
      }});

      document.getElementById('sheet-dest').textContent = dest.place_name + '까지 안내';
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

    function highlightStep(index) {{
      var items = document.querySelectorAll('.step-item');
      items.forEach(function(item, i) {{
        item.classList.remove('current', 'done');
        if (i < index)        item.classList.add('done');
        else if (i === index) item.classList.add('current');
      }});
      if (items[index]) items[index].scrollIntoView({{ behavior: 'smooth', block: 'center' }});

      stepOverlays.forEach(function(overlay, i) {{
        var num = i + 1; var done = i < index; var curr = i === index;
        var bg = curr ? '#1B76FF' : (done ? '#ccc' : '#fff');
        var fg = curr ? '#fff'    : (done ? '#fff' : '#1B76FF');
        var border = done ? '#ccc' : '#1B76FF';
        var label  = done ? '✓' : num;
        overlay.setContent(
          '<div style="width:24px;height:24px;border-radius:50%;background:' + bg + ';border:2px solid ' + border + ';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:' + fg + ';box-shadow:0 1px 4px rgba(0,0,0,0.25);">' + label + '</div>'
        );
      }});
    }}

    function clearRoute() {{
      if (routePolyline) routePolyline.setMap(null);
      if (destMarker)    destMarker.setMap(null);
      stepOverlays.forEach(function(o) {{ o.setMap(null); }});
      routePolyline = null; destMarker = null; stepOverlays = [];
      routeSteps = []; routeActive = false; hasFitRoute = false;
      document.getElementById('sheet').style.display = 'none';
    }}

    function drawRoute(routePoints, dest, steps, distance, duration, activeStepIndex, remainingDistance) {{
      if (routePolyline) routePolyline.setMap(null);
      if (destMarker)    destMarker.setMap(null);
      stepOverlays.forEach(function(o) {{ o.setMap(null); }});

      routeSteps = steps || [];
      routeDuration = duration || 0;
      routeActive = true;
      hasFitRoute = false;
      stepOverlays = [];

      var path = (routePoints || []).map(function(p) {{
        return new kakao.maps.LatLng(p.lat, p.lng);
      }});

      routePolyline = new kakao.maps.Polyline({{
        path: path, strokeWeight: 6,
        strokeColor: '#2563EB', strokeOpacity: 0.9, strokeStyle: 'solid'
      }});
      routePolyline.setMap(map);

      destMarker = new kakao.maps.Marker({{
        position: new kakao.maps.LatLng(dest.lat, dest.lng), map: map,
      }});
      new kakao.maps.InfoWindow({{
        content: '<div class="place-label">목적지 · ' + dest.place_name + '</div>',
      }}).open(map, destMarker);

      if (path.length) {{
        var bounds = new kakao.maps.LatLngBounds();
        path.forEach(function(p) {{ bounds.extend(p); }});
        if (lastUserPosition) bounds.extend(lastUserPosition);
        map.setBounds(bounds, 60);
        hasFitRoute = true;
      }}

      routeSteps.forEach(function(s, i) {{
        if (s.lat == null || s.lng == null) return;
        var overlay = new kakao.maps.CustomOverlay({{
          position: new kakao.maps.LatLng(s.lat, s.lng),
          content: stepMarkerHtml(i + 1, false),
          zIndex: 5,
        }});
        overlay.setMap(map);
        stepOverlays.push(overlay);
      }});

      document.getElementById('sheet-dest').textContent = dest.place_name + '까지 안내';
      document.getElementById('sheet-summary').textContent =
        (duration || '?') + '분 · ' + (distance >= 1000 ? (distance/1000).toFixed(1) + 'km' : distance + 'm');
      document.getElementById('sheet').style.display = 'flex';
      updateProgress(activeStepIndex || 0, remainingDistance);
    }}

    function highlightStep(index) {{
      updateProgress(index, null);
    }}

    function arriveDestination() {{
      routeActive = false;
      updateProgress(routeSteps.length, 0);
      stepOverlays.forEach(function(o) {{ o.setMap(null); }});
      stepOverlays = [];
      document.getElementById('sheet-dest').textContent = '도착했습니다';
      document.getElementById('sheet-summary').textContent = '안내가 자동으로 종료되었습니다';
    }}

    function handleMessage(event) {{
      try {{
        var data = JSON.parse(event.data);
        if (data.type === 'UPDATE_LOCATION') updateUserLocation(data.lat, data.lng, data.follow);
        if (data.type === 'DRAW_ROUTE')      drawRoute(data.route, data.destination, data.steps, data.distance, data.duration, data.activeStepIndex, data.remainingDistance);
        if (data.type === 'NAV_PROGRESS')    updateProgress(data.activeStepIndex, data.remainingDistance);
        if (data.type === 'ARRIVE_DESTINATION') arriveDestination();
        if (data.type === 'FOLLOW_USER') {{
          followUser = !!data.enabled;
          if (data.recenter && userOverlay) map.panTo(userOverlay.getPosition());
        }}
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


# ── OSRM 경로 API ─────────────────────────────────────────────────────────────
MANEUVER_KO = {
    ("depart",   "straight"):     "출발 후 직진",
    ("depart",   None):           "출발",
    ("arrive",   None):           "목적지 도착",
    ("turn",     "right"):        "오른쪽 방향",
    ("turn",     "left"):         "왼쪽 방향",
    ("turn",     "slight right"): "오른쪽으로 살짝",
    ("turn",     "slight left"):  "왼쪽으로 살짝",
    ("turn",     "sharp right"):  "오른쪽으로 크게",
    ("turn",     "sharp left"):   "왼쪽으로 크게",
    ("turn",     "straight"):     "직진",
    ("continue", "straight"):     "직진",
    ("continue", None):           "계속 직진",
    ("new name", "straight"):     "직진",
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

    route_data     = data["routes"][0]
    coords         = route_data["geometry"]["coordinates"]
    points         = [{"lat": c[1], "lng": c[0]} for c in coords]
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


def compact_match_text(value: str) -> str:
    return re.sub(r"[\s·ㆍ/\\\-_()]+", "", (value or "").lower())


def find_destination_by_text(question: str):
    compact_question = compact_match_text(question)
    if not compact_question:
        return None

    for place in building_places:
        place_name = place.get("place_name", "")
        if compact_match_text(place_name) and compact_match_text(place_name) in compact_question:
            return place

    for place in building_places:
        for service in place.get("services", []) or []:
            service_text = compact_match_text(str(service))
            if service_text and len(service_text) >= 2 and service_text in compact_question:
                return place

    return None


@app.post("/navigate")
def navigate(req: NavigateRequest):
    try:
        place_name = None
        place_list = [
            {"name": p["place_name"], "services": p.get("services", [])}
            for p in building_places
        ]
        prompt = f"""사용자 입력: "{req.question}"

캠퍼스 장소 목록:
{json.dumps(place_list, ensure_ascii=False)}

위 장소 중 사용자가 가고 싶은 곳을 찾아서 JSON만 출력해. 설명 없이 JSON만:
{{"place_name": "장소명"}}

찾을 수 없으면: {{"place_name": null}}"""

        if has_ai_key():
            try:
                text     = generate_ai_text(prompt, max_tokens=300).strip()
                match    = re.search(r'\{.*?\}', text, re.DOTALL)
                if match:
                    place_name = json.loads(match.group()).get("place_name")
            except Exception:
                place_name = None

        destination = next(
            (p for p in building_places if p.get("place_name") == place_name), None
        ) if place_name else None
        if not destination:
            destination = find_destination_by_text(req.question)
        if not destination:
            return {"error": "요청한 장소를 찾을 수 없습니다. 건물명이나 주요 시설명을 조금 더 구체적으로 입력해주세요."}

        route, steps, distance, duration = get_osrm_route(
            req.lat, req.lng, destination["lat"], destination["lng"]
        )
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


# ── 채팅 핵심 로직 (재사용 가능) ─────────────────────────────────────────────
def normalize_question_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def find_exact_dataset_match(question: str):
    normalized_question = normalize_question_text(question)
    for item in dataset:
        if normalize_question_text(item.get("instruction", "")) == normalized_question:
            return item
    return None


def build_dataset_fallback_answer(matches: list[dict]) -> str:
    outputs = []
    seen = set()
    for item in matches[:3]:
        output = (item.get("output") or "").strip()
        if not output or output in seen:
            continue
        seen.add(output)
        outputs.append(output)

    if outputs:
        return "\n\n".join(outputs)
    return (
        "해당 질문과 정확히 일치하는 학교 데이터가 부족해요. "
        "학사일정, 수강신청, 장학금, 기숙사, 교통, 도서관처럼 학교 관련 키워드를 조금 더 구체적으로 적어주세요."
    )


def build_facility_fallback_answer(question: str, places: list[dict]) -> str:
    destination = find_destination_by_text(question)
    if destination:
        services = destination.get("services") or []
        service_text = f" 주요 시설은 {', '.join(services[:5])}입니다." if services else ""
        return f"{destination['place_name']} 정보를 확인했어요.{service_text} 지도 탭에서 건물명을 입력하면 경로 안내도 받을 수 있어요."

    if places:
        names = ", ".join(p.get("place_name", "") for p in places[:5] if p.get("place_name"))
        return f"관련될 수 있는 교내 장소는 {names} 등이 있어요. 찾는 시설명이나 건물명을 더 구체적으로 입력해 주세요."

    return "해당 시설 정보를 찾지 못했어요. 건물명이나 시설명을 조금 더 구체적으로 입력해 주세요."


def process_chat_question(question: str, current_user: dict | None = None) -> dict:
    question = question.strip()

    if is_roadmap_question(question):
        return process_roadmap_chat_question(question, current_user)

    if question in response_cache:
        return response_cache[question]

    exact_match = find_exact_dataset_match(question)
    if exact_match:
        result = {
            "question":         question,
            "category":         exact_match.get("label", ""),
            "matched_question": exact_match.get("instruction", ""),
            "confidence":       1.0,
            "answer":           exact_match.get("output", ""),
            "source":           "백석대학교 데이터셋",
        }
        response_cache[question] = result
        return result

    indices, distances = faiss_search(question)
    best_distance = float(distances[0])
    confidence    = calc_confidence(best_distance)

    if not is_school_related_question(question, best_distance):
        result = out_of_scope_response(question)
        response_cache[question] = result
        return result

    if best_distance > DISTANCE_THRESHOLD:
        filtered = filter_buildings_by_keyword(question)
        source   = filtered if filtered else building_places

        building_info = json.dumps([{
            "place_name": p["place_name"],
            "services":   p.get("services", []),
        } for p in source], ensure_ascii=False)

        prompt = f"""너는 백석대학교 안내 챗봇이야.

[캠퍼스 건물 및 시설 정보]
{building_info}

[학생 질문]
{question}

규칙:
1. 반드시 위 [캠퍼스 건물 및 시설 정보]에 있는 내용만 사용해서 답해
2. 데이터에 없는 내용은 절대 추측하거나 지어내지 마
3. 정보가 없으면 "해당 정보는 제공되지 않았습니다. 학교 홈페이지(www.bu.ac.kr)를 확인해주세요"라고 정확히 답해
4. 대학생이 이해하기 쉽게 한국어로 자연스럽게 2~3문장 이내로 답해"""

        final_answer = build_facility_fallback_answer(question, source)
        answer_source = "백석대학교 데이터셋"
        if has_ai_key():
            try:
                final_answer = generate_ai_text(prompt, max_tokens=700) or final_answer
                answer_source = "백석대학교 AI 챗봇"
            except Exception:
                pass

        result = {
            "question":         question,
            "category":         "편의시설",
            "matched_question": None,
            "confidence":       0.3,
            "answer":           final_answer,
            "source":           answer_source,
        }

    else:
        top_matches  = [dataset[i] for i in indices]
        matches_text = "\n\n".join([
            f"[참고자료 {i+1}]\n질문: {m['instruction']}\n내용: {m['output']}"
            for i, m in enumerate(top_matches)
        ])

        prompt = f"""너는 백석대학교 안내 챗봇이야.

[참고자료 목록]
{matches_text}

[학생 질문]
{question}

규칙:
1. 위 참고자료 중 학생 질문과 가장 관련 있는 내용만 골라서 답해
2. 참고자료에 없는 내용은 절대 추측하거나 지어내지 마
3. 정보가 없으면 "해당 정보는 제공되지 않았습니다. 학교 홈페이지(www.bu.ac.kr)를 확인해주세요"라고 정확히 답해
4. 대학생이 이해하기 쉽게 한국어로 자연스럽게 2~3문장 이내로 답해"""

        final_answer = build_dataset_fallback_answer(top_matches)
        answer_source = "백석대학교 데이터셋"
        if has_ai_key():
            try:
                final_answer = generate_ai_text(prompt, max_tokens=700) or final_answer
                answer_source = "백석대학교 AI 챗봇"
            except Exception:
                pass

        matched = top_matches[0]
        result  = {
            "question":         question,
            "category":         matched.get("label", ""),
            "matched_question": matched.get("instruction", ""),
            "confidence":       confidence,
            "answer":           final_answer,
            "source":           answer_source,
        }

    response_cache[question] = result
    return result


# ── /chat ─────────────────────────────────────────────────────────────────────
INSIGHT_RECOMMENDATIONS = {
    "학사일정": {
        "blurb": "최근 학사일정 관련 질문이 많아요. 마감일과 처리 기준을 먼저 확인하면 놓치는 일을 줄일 수 있어요.",
        "questions": [
            "이번 학기 주요 학사일정을 알려줘",
            "성적 처리와 정정 기간은 언제야?",
            "휴학이나 복학 신청 기간을 알려줘",
        ],
    },
    "수강신청": {
        "blurb": "수강신청은 일정, 제한 조건, 변경 기간을 함께 확인하는 게 좋아요.",
        "questions": [
            "수강신청 변경 기간은 언제야?",
            "수강신청할 때 유의해야 할 점을 알려줘",
            "전공 과목 신청 기준을 알려줘",
        ],
    },
    "장학금": {
        "blurb": "장학금은 신청 조건과 제출 서류를 놓치기 쉬워서 미리 정리해두면 좋아요.",
        "questions": [
            "신청 가능한 장학금 종류를 알려줘",
            "장학금 신청 기간과 제출 서류를 알려줘",
            "성적 장학금 기준을 알려줘",
        ],
    },
    "기숙사": {
        "blurb": "기숙사 관련 질문이 반복되고 있어요. 신청, 외박, 식단처럼 자주 쓰는 정보를 바로 확인해보세요.",
        "questions": [
            "기숙사 입사 신청 방법을 알려줘",
            "기숙사 외박 신청은 어디서 해?",
            "오늘 기숙사 식단을 알려줘",
        ],
    },
    "교통/버스": {
        "blurb": "통학이나 셔틀 이용 정보는 시간표와 노선을 같이 확인하는 게 좋아요.",
        "questions": [
            "셔틀버스 시간표를 알려줘",
            "천안역에서 학교까지 가는 방법을 알려줘",
            "캠퍼스 순환버스 노선을 알려줘",
        ],
    },
    "도서관": {
        "blurb": "도서관 이용 시간, 대출, 열람실 정보를 자주 확인하면 공부 동선이 편해져요.",
        "questions": [
            "도서관 운영 시간을 알려줘",
            "도서 대출 기간은 며칠이야?",
            "열람실 이용 방법을 알려줘",
        ],
    },
    "등록금": {
        "blurb": "등록금은 납부 기간과 고지서 확인 방법을 먼저 보는 게 좋아요.",
        "questions": [
            "등록금 납부 기간을 알려줘",
            "등록금 고지서는 어디서 확인해?",
            "등록금 분할 납부가 가능한지 알려줘",
        ],
    },
    "캠퍼스맵": {
        "blurb": "건물 위치나 이동 경로를 자주 찾고 있어요. 목적지와 가까운 시설도 함께 확인해보세요.",
        "questions": [
            "도서관 위치를 알려줘",
            "가장 가까운 편의시설을 찾아줘",
            "현재 위치에서 본부동까지 길을 알려줘",
        ],
    },
}

DEFAULT_INSIGHT_RECOMMENDATION = {
    "blurb": "최근 질문 패턴을 기준으로 다음에 확인하면 좋을 내용을 추천했어요.",
    "questions": [
        "이 주제에서 꼭 알아야 할 내용을 정리해줘",
        "관련해서 자주 묻는 질문을 알려줘",
        "내가 놓치기 쉬운 부분을 알려줘",
    ],
}

INSIGHT_CATEGORIES = [
    "학사일정", "수강신청", "장학금", "기숙사", "교통/버스", "도서관",
    "등록금", "캠퍼스맵", "성적", "졸업", "생활편의", "수강추천",
    "미지원 질문", "기타", "범위밖",
]


def normalize_insight_category(category: str | None) -> str:
    value = (category or "").strip()
    if not value:
        return "기타"
    if value in INSIGHT_CATEGORIES:
        return value
    return value


def infer_question_category(question: str) -> tuple[str, float]:
    text = (question or "").strip()
    if not text:
        return "기타", 0.0

    try:
        indices, distances = faiss_search(text)
        best_distance = float(distances[0])
        if best_distance <= DISTANCE_THRESHOLD and len(indices) > 0:
            matched = dataset[indices[0]]
            return normalize_insight_category(matched.get("label")), calc_confidence(best_distance)
    except Exception:
        pass

    keyword_map = [
        ("학사일정", ["일정", "학사", "방학", "개강", "종강", "휴학", "복학"]),
        ("수강신청", ["수강", "강의", "시간표", "전공", "교양"]),
        ("수강추천", ["로드맵", "추천 과목", "교과군", "커리큘럼", "캡스톤디자인", "뭐 들어야"]),
        ("장학금", ["장학", "국가장학", "학자금"]),
        ("기숙사", ["기숙사", "외박", "식단", "생활관"]),
        ("교통/버스", ["버스", "셔틀", "통학", "천안역", "교통"]),
        ("도서관", ["도서관", "열람실", "대출", "반납"]),
        ("등록금", ["등록금", "납부", "고지서"]),
        ("생활편의", ["인쇄", "프린트", "복사", "복사기", "프린터"]),
        ("캠퍼스맵", ["위치", "어디", "길", "건물", "지도"]),
    ]
    for category, keywords in keyword_map:
        if any(keyword in text for keyword in keywords):
            return category, 0.5
    return "기타", 0.2


def split_question_intents(text: str) -> list[str]:
    raw = (text or "").strip()
    if not raw:
        return []

    exact_match = find_exact_dataset_match(raw)
    if exact_match:
        return [raw]

    normalized = re.sub(r"\s+", " ", raw)
    separators = r"(?:\?|？|,|，|그리고|또한|또|랑|하고|및|되고|고\s+|이며|하면서|와\s|과\s)"
    parts = [part.strip(" .!?？,，") for part in re.split(separators, normalized)]
    intents = []
    for part in parts:
        if len(part) < 3:
            continue
        if part not in intents:
            intents.append(part)
        if len(intents) >= 5:
            break
    return intents or [normalized]


def classify_single_intent(intent_text: str) -> dict:
    text = (intent_text or "").strip()
    if not text:
        return {
            "intent_text": "",
            "category": "기타",
            "confidence": 0.0,
            "source": "empty",
        }

    if is_roadmap_question(text):
        return {
            "intent_text": text,
            "category": "수강추천",
            "confidence": 0.76,
            "source": "roadmap_intent",
        }

    exact_match = find_exact_dataset_match(text)
    if exact_match:
        return {
            "intent_text": text,
            "category": normalize_insight_category(exact_match.get("label")),
            "confidence": 1.0,
            "source": "dataset_exact",
        }

    try:
        indices, distances = faiss_search(text)
        best_distance = float(distances[0])
        if not is_school_related_question(text, best_distance):
            return {
                "intent_text": text,
                "category": "범위밖",
                "confidence": 0.0,
                "source": "scope_guard",
            }
        if len(indices) > 0 and best_distance <= DISTANCE_THRESHOLD:
            matched = dataset[indices[0]]
            return {
                "intent_text": text,
                "category": normalize_insight_category(matched.get("label")),
                "confidence": calc_confidence(best_distance),
                "source": "embedding",
            }
    except Exception:
        pass

    category, confidence = infer_question_category(text)
    return {
        "intent_text": text,
        "category": normalize_insight_category(category),
        "confidence": confidence,
        "source": "keyword",
    }


def should_use_ai_intent_classifier(question: str, local_items: list[dict]) -> bool:
    if not has_ai_key() or not local_items:
        return False
    if all(item.get("category") == "범위밖" for item in local_items):
        return False
    if len(split_question_intents(question)) >= 2:
        return True
    return any(
        item.get("category") in ("기타", "미지원 질문")
        or float(item.get("confidence") or 0.0) < 0.62
        for item in local_items
    )


def parse_ai_intent_classification(text: str) -> list[dict]:
    raw = (text or "").strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw).strip()
    match = re.search(r"\[[\s\S]*\]", raw)
    if match:
        raw = match.group(0)
    data = json.loads(raw)
    if not isinstance(data, list):
        raise ValueError("AI intent response is not a JSON array")

    results = []
    for item in data[:5]:
        if not isinstance(item, dict):
            continue
        intent_text = str(item.get("intent_text") or "").strip()
        category = normalize_insight_category(str(item.get("category") or "기타").strip())
        if category not in INSIGHT_CATEGORIES:
            category = "기타"
        try:
            confidence = float(item.get("confidence") or 0.0)
        except (TypeError, ValueError):
            confidence = 0.7
        confidence = max(0.0, min(1.0, confidence))
        if intent_text:
            results.append({
                "intent_text": intent_text,
                "category": category,
                "confidence": confidence,
                "source": "ai",
            })
    return results


def classify_question_intents_with_ai(question: str, local_items: list[dict]) -> list[dict]:
    local_text = json.dumps(local_items, ensure_ascii=False)
    categories_text = ", ".join(INSIGHT_CATEGORIES)
    prompt = f"""너는 백석대학교 AI 챗봇의 질문 의도 분류기야.

[사용자 질문]
{question}

[로컬 1차 분류 결과]
{local_text}

[사용 가능한 카테고리]
{categories_text}

규칙:
1. 질문 안에 여러 의도가 있으면 의미 단위로 나눠서 각각 분류해.
2. 백석대학교 학교생활, 학사, 수강, 시설, 장학, 교통, 도서관, 기숙사, 전공 로드맵 범위 안에서 판단해.
3. 학교와 관련 없는 의도는 범위밖으로 분류해.
4. 카테고리는 반드시 [사용 가능한 카테고리] 중 하나만 사용해.
5. 설명 없이 JSON 배열만 반환해.

출력 예:
[
  {{"intent_text":"장학금은 언제 들어와","category":"장학금","confidence":0.9}},
  {{"intent_text":"인쇄는 어디서 해","category":"생활편의","confidence":0.82}}
]"""
    try:
        ai_items = parse_ai_intent_classification(generate_ai_text(prompt, max_tokens=700))
        return ai_items or local_items
    except Exception:
        return local_items


def classify_question_intents(question: str) -> list[dict]:
    classifications = []
    for intent in split_question_intents(question):
        item = classify_single_intent(intent)
        if item["intent_text"]:
            classifications.append(item)
    classifications = classifications or [classify_single_intent(question)]
    if should_use_ai_intent_classifier(question, classifications):
        return classify_question_intents_with_ai(question, classifications)
    return classifications


def save_message_categories(conn, message_id: int, classifications: list[dict]):
    conn.execute("DELETE FROM message_categories WHERE message_id = ?", (message_id,))
    for item in classifications:
        category = normalize_insight_category(item.get("category"))
        conn.execute(
            """
            INSERT INTO message_categories
                (message_id, category, confidence, intent_text, source)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                message_id,
                category,
                float(item.get("confidence") or 0.0),
                item.get("intent_text") or "",
                item.get("source") or "local",
            ),
        )


def build_insight_recommendation(category: str) -> dict:
    recommendation = INSIGHT_RECOMMENDATIONS.get(category, DEFAULT_INSIGHT_RECOMMENDATION)
    return {
        "topic": category,
        "blurb": recommendation["blurb"],
        "questions": recommendation["questions"],
        "source": "fallback",
        "reason": "fallback",
    }


def parse_json_array_text(text: str) -> list[str]:
    raw = (text or "").strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw).strip()
    match = re.search(r"\[[\s\S]*\]", raw)
    if match:
        raw = match.group(0)
    data = json.loads(raw)
    if not isinstance(data, list):
        raise ValueError("AI response is not a JSON array")
    questions = []
    for item in data:
        if isinstance(item, str) and item.strip():
            questions.append(item.strip())
    return questions[:3]


def parse_json_object_text(text: str) -> dict:
    raw = (text or "").strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw).strip()
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        raw = match.group(0)
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("AI response is not a JSON object")
    return data


def generate_insight_recommendation(category: str, user_questions: list[str]) -> dict:
    fallback = build_insight_recommendation(category)
    recent_questions = [q.strip() for q in user_questions if q and q.strip()][-12:]
    if not recent_questions:
        return {**fallback, "reason": "no_user_questions"}
    if not has_ai_key():
        return {**fallback, "reason": "missing_anthropic_api_key"}

    questions_text = "\n".join(f"- {question}" for question in recent_questions)
    prompt = f"""너는 백석대학교 AI 챗봇의 인사이트 추천 질문 생성기야.

[가장 많이 물어본 카테고리]
{category}

[사용자가 최근 실제로 물어본 질문]
{questions_text}

규칙:
1. 사용자가 반복해서 궁금해한 흐름을 보고 다음에 물어보면 좋을 질문 3개를 만들어줘.
2. 백석대학교 학교생활, 학사, 수강, 시설, 장학, 교통, 도서관, 기숙사 범위 안에서만 만들어줘.
3. 사용자가 이미 물어본 질문과 완전히 같은 문장은 피하고, 한 단계 더 구체적인 질문으로 만들어줘.
4. 각 질문은 학생이 챗봇에 바로 입력할 수 있는 자연스러운 한국어 문장으로 작성해줘.
5. 설명 없이 JSON 배열만 반환해줘.

출력 예:
["이번 학기 수강신청 변경 기간은 언제야?", "전공필수 과목을 못 들으면 어떻게 해야 해?", "성적 정정 신청은 어디서 해?"]"""

    try:
        generated = parse_json_array_text(generate_ai_text(prompt, max_tokens=500))
        if len(generated) < 3:
            return {**fallback, "reason": "ai_returned_less_than_3_questions"}
        blurb = f"최근 {category} 관련 질문 흐름을 바탕으로 다음 질문을 추천해요."
        return {
            "topic": category,
            "blurb": blurb,
            "questions": generated,
            "source": "ai",
            "reason": "generated",
        }
    except Exception as exc:
        return {**fallback, "reason": f"ai_error: {type(exc).__name__}"}


COURSE_GROUPS = {
    "기초": "전공 학습의 토대를 다지는 과목",
    "핵심": "전공의 중심 역량을 만드는 과목",
    "심화": "전문성을 깊게 확장하는 과목",
    "응용": "프로젝트와 실무로 연결하는 과목",
}

ROADMAP_INTENT_KEYWORDS = [
    "로드맵", "전공 과목", "추천 과목", "수강 추천", "수강추천", "교과군",
    "기초교과군", "핵심교과군", "심화교과군", "응용교과군",
    "학년별 과목", "들어야 하는 과목", "커리큘럼", "캡스톤디자인",
    "뭐 들어야", "무슨 과목", "권장 교과목", "추천 교과군",
]


def major_search_terms(major: str) -> list[str]:
    normalized = normalize_major(major)
    terms = [normalized, f"{normalized}전공"]
    if normalized == "AR·VR":
        terms.extend(["ARVR", "AR/VR", "ARㆍVR"])
    if normalized == "IoT":
        terms.extend(["IOT", "IoT전공"])
    return list(dict.fromkeys(terms))


def item_matches_major(item: dict, major: str) -> bool:
    text = f"{item.get('instruction', '')}\n{item.get('output', '')}"
    return any(term in text for term in major_search_terms(major))


def extract_item_major(item: dict) -> str | None:
    instruction = item.get("instruction", "")
    output = item.get("output", "")
    ordered_majors = ["빅데이터", "핀테크", "IoT", "AR·VR"]
    for major in ordered_majors:
        if any(term in instruction for term in major_search_terms(major)):
            return major
    for major in ordered_majors:
        if f"{major}전공" in output:
            return major
    return None


def item_group(item: dict) -> str | None:
    text = f"{item.get('instruction', '')}\n{item.get('output', '')}"
    for group in COURSE_GROUPS:
        if group in text:
            return group
    return None


def extract_semester_from_text(text: str) -> int | None:
    match = re.search(r"([12])\s*학기", text or "")
    return int(match.group(1)) if match else None


def extract_grade_from_text(text: str) -> int | None:
    match = re.search(r"([1-4])\s*학년", text or "")
    return int(match.group(1)) if match else None


def parse_capacity(text: str) -> int | None:
    match = re.search(r"정원\s*:\s*(\d+)\s*명", text or "")
    return int(match.group(1)) if match else None


def parse_prerequisite(text: str) -> str:
    match = re.search(r"선이수권장\s*:\s*([^/)]+)", text or "")
    return match.group(1).strip() if match else ""


def parse_replacement_limit(text: str) -> str:
    match = re.search(r"대체제한\s*:\s*([^/)]+)", text or "")
    return match.group(1).strip() if match else ""


NON_COURSE_PREFIXES = {
    "주의사항", "안내사항", "참고", "비고", "유의사항", "설명", "추천", "권장",
    "기초", "핵심", "심화", "응용", "기초교과군", "핵심교과군", "심화교과군", "응용교과군",
    "1학년", "2학년", "3학년", "4학년",
}

NON_COURSE_KEYWORDS = (
    "교과군", "주의사항", "안내사항", "유의", "공지", "로드맵", "수강 정원",
    "선수과목", "개설 학기", "변동", "확인", "추천합니다", "설명", "학년별",
)


def stable_course_id(major: str | None, group: str | None, name: str, grade: int | None, semester: int | None) -> str:
    raw = f"{major or ''}|{group or ''}|{name}|{grade or ''}|{semester or ''}"
    return re.sub(r"[^0-9A-Za-z가-힣._|-]+", "_", raw).strip("_")


def normalize_course_name(text: str) -> str:
    name = re.split(r"\s*[\(（]", text, maxsplit=1)[0].strip()
    name = re.sub(r"^\d+\.\s*", "", name)
    for prefix in ("필수 교과목", "선택 교과목", "전공필수", "전공선택", "추천 과목", "권장 과목"):
        if name.startswith(f"{prefix}:"):
            name = name.split(":", 1)[1].strip()
    name = re.sub(r"^[가-힣A-Za-z]+\s*:\s*", "", name).strip()
    return name


def is_probably_course_line(text: str, name: str) -> bool:
    if not text or not name:
        return False
    heading = text.split(":", 1)[0].strip()
    if heading in NON_COURSE_PREFIXES:
        return False
    if name in NON_COURSE_PREFIXES:
        return False
    if len(name) < 2 or len(name) > 38:
        return False
    if any(keyword in name for keyword in NON_COURSE_KEYWORDS):
        return False
    if any(keyword in text for keyword in ("다음과 같이", "확인해주세요", "문의", "홈페이지")):
        return False
    return True


def parse_courses_from_output(
    output: str,
    source_group: str | None,
    *,
    major: str | None = None,
    semester: int | None = None,
    grade: int | None = None,
    source_label: str = "",
    source_instruction: str = "",
) -> list[dict]:
    courses = []
    for line in (output or "").splitlines():
        text = line.strip()
        if not text.startswith("-"):
            continue
        text = text.lstrip("-").strip()
        if not text:
            continue
        name = normalize_course_name(text)
        if not is_probably_course_line(text, name):
            continue
        if "필수" in text or "캡스톤디자인" in name:
            type_name = "전공필수"
        elif "선택" in text:
            type_name = "전공선택"
        else:
            type_name = "구분미상"
        credit_match = re.search(r"(\d+)\s*학점", text)
        credit = int(credit_match.group(1)) if credit_match else 3
        courses.append({
            "major": major or "",
            "id": stable_course_id(major, source_group, name, grade, semester),
            "name": name,
            "credit": credit,
            "type": type_name,
            "group": source_group or "기타",
            "semester": semester,
            "grade": grade,
            "capacity": parse_capacity(text),
            "prerequisite": parse_prerequisite(text),
            "replacement_limit": parse_replacement_limit(text),
            "source_label": source_label,
            "source_instruction": source_instruction,
            "note": text,
        })
    return courses


def build_roadmap_courses_from_dataset() -> list[dict]:
    courses = []
    seen = set()
    for item in dataset:
        if item.get("label") not in ("수강신청", "수강추천", "학업 로드맵", "진로 가이드", "수강신청 유의사항"):
            continue
        instruction = item.get("instruction", "")
        output = item.get("output", "")
        text = f"{instruction}\n{output}"
        major = extract_item_major(item)
        if not major:
            continue
        group = item_group(item)
        if group not in COURSE_GROUPS:
            continue
        semester = extract_semester_from_text(instruction)
        grade = extract_grade_from_text(instruction)
        for course in parse_courses_from_output(
            output,
            group,
            major=major,
            semester=semester,
            grade=grade,
            source_label=item.get("label", ""),
            source_instruction=instruction,
        ):
            key = (course["major"], course["group"], course["name"], course.get("semester"), course.get("grade"))
            if key in seen:
                continue
            seen.add(key)
            if not course.get("grade"):
                course["grade"] = extract_grade_from_text(text)
            courses.append(course)
    return courses


def get_roadmap_courses(major: str) -> list[dict]:
    normalized = normalize_major(major)
    return [course for course in roadmap_courses if course.get("major") == normalized]


def course_priority(course: dict, grade: int) -> tuple[int, int, str]:
    focus_groups = recommend_focus_groups(grade)
    group = course.get("group", "")
    grade_value = int(course.get("grade") or 0)
    focus_rank = focus_groups.index(group) if group in focus_groups else len(focus_groups) + 1
    grade_rank = abs(grade_value - grade) if grade_value else 2
    return (focus_rank, grade_rank, course.get("name", ""))


def build_recommendation_sections(major: str, filtered_items: list[dict], grade: int | None = None) -> list[dict]:
    grouped = {name: [] for name in COURSE_GROUPS}
    seen = set()
    structured = get_roadmap_courses(major)
    if structured:
        source_courses = sorted(
            structured,
            key=lambda course: course_priority(course, grade or 0)
        )
        for course in source_courses:
            group = course.get("group")
            if group not in grouped:
                continue
            key = (group, course["name"])
            if key in seen:
                continue
            seen.add(key)
            grouped[group].append(course)
    else:
        for item in filtered_items:
            group = item_group(item)
            if group not in grouped:
                continue
            semester = extract_semester_from_text(item.get("instruction", ""))
            item_grade = extract_grade_from_text(item.get("instruction", ""))
            for course in parse_courses_from_output(
                item.get("output", ""),
                group,
                major=major,
                semester=semester,
                grade=item_grade,
                source_label=item.get("label", ""),
                source_instruction=item.get("instruction", ""),
            ):
                key = (group, course["name"])
                if key in seen:
                    continue
                seen.add(key)
                grouped[group].append(course)

    sections = []
    for group, desc in COURSE_GROUPS.items():
        courses = grouped[group][:8]
        if courses:
            sections.append({"name": group, "description": desc, "courses": courses})
    return sections


def recommend_focus_groups(grade: int) -> list[str]:
    if grade == 1:
        return ["기초"]
    if grade in (2, 3):
        return ["핵심", "심화"]
    return ["심화", "응용"]


def fallback_recommend_answer(major: str, grade: int, sections: list[dict]) -> str:
    if not sections:
        return "추천에 필요한 로드맵 데이터가 아직 부족합니다. 첨단IT학부 로드맵 데이터를 먼저 확인해주세요."
    focus = ", ".join(recommend_focus_groups(grade))
    lines = [
        f"{grade}학년 {major}전공 학생은 {focus} 교과군을 우선 확인하는 것을 추천합니다.",
        "아래 과목은 현재 등록된 로드맵 데이터를 기준으로 정리한 내용입니다.",
    ]
    for section in sections:
        names = ", ".join(course["name"] for course in section["courses"][:4])
        lines.append(f"- {section['name']}: {names}")
    lines.append("수강 정원, 선수과목, 개설 학기는 변동될 수 있으니 최종 신청 전 학부 공지와 수업계획서를 확인해주세요.")
    return "\n".join(lines)


def compact_course_for_ai(course: dict) -> dict:
    return {
        "id": course.get("id") or stable_course_id(
            course.get("major"),
            course.get("group"),
            course.get("name", ""),
            course.get("grade"),
            course.get("semester"),
        ),
        "name": course.get("name", ""),
        "group": course.get("group", ""),
        "credit": course.get("credit") or 3,
        "grade": course.get("grade") or "",
        "semester": course.get("semester") or "",
        "note": course.get("note", "")[:120],
    }


def build_ai_course_sections(major: str, grade: int, sections: list[dict], question: str | None = None) -> tuple[list[dict], str] | None:
    prompt_candidates = []
    by_id = {}
    for section in sections:
        for course in section.get("courses", []):
            course_id = course.get("id") or stable_course_id(
                course.get("major"),
                course.get("group"),
                course.get("name", ""),
                course.get("grade"),
                course.get("semester"),
            )
            if not course_id or course_id in by_id:
                continue
            full_course = dict(course)
            full_course["id"] = course_id
            by_id[course_id] = full_course
            prompt_candidates.append(compact_course_for_ai(full_course))
    if not prompt_candidates or not has_ai_key():
        return None

    if not by_id:
        return None

    candidate_text = json.dumps(prompt_candidates[:48], ensure_ascii=False, indent=2)
    focus = ", ".join(recommend_focus_groups(grade))
    prompt = f"""너는 백석대학교 첨단IT학부 로드맵 과목 추천 엔진이야.

아래 후보 과목 목록에 있는 과목만 사용해서 {grade}학년 {major}전공 학생에게 맞는 과목을 골라줘.

[사용자 질문]
{question or f"{grade}학년 {major}전공 학생에게 맞는 과목을 추천해줘"}

[우선 교과군]
{focus}

[후보 과목 JSON]
{candidate_text}

규칙:
1. 후보 목록에 없는 과목은 절대 만들지 마.
2. 학생의 전공, 학년, 우선 교과군을 보고 실제로 확인하면 좋은 과목만 골라.
3. 각 교과군별 최대 5개만 골라.
4. reason은 한 문장의 자연스러운 한국어로만 짧게 써.
5. 설명문 없이 아래 JSON 객체만 반환해.

출력 형식:
{{
  "summary": "추천 요약 한두 문장",
  "sections": [
    {{
      "name": "기초",
      "courses": [
        {{ "id": "후보 id", "reason": "추천 이유" }}
      ]
    }}
  ]
}}"""

    data = parse_json_object_text(generate_ai_text(prompt, max_tokens=1100, timeout=35))
    raw_sections = data.get("sections")
    if not isinstance(raw_sections, list):
        return None

    grouped = {name: [] for name in COURSE_GROUPS}
    used_ids = set()
    for raw_section in raw_sections:
        if not isinstance(raw_section, dict):
            continue
        for raw_course in raw_section.get("courses", []):
            if not isinstance(raw_course, dict):
                continue
            course_id = str(raw_course.get("id") or "").strip()
            if not course_id or course_id in used_ids or course_id not in by_id:
                continue
            course = dict(by_id[course_id])
            group = course.get("group")
            if group not in grouped or len(grouped[group]) >= 5:
                continue
            reason = str(raw_course.get("reason") or "").strip()
            if reason:
                course["reason"] = reason[:90]
            grouped[group].append(course)
            used_ids.add(course_id)

    result_sections = []
    for group, desc in COURSE_GROUPS.items():
        if grouped[group]:
            result_sections.append({"name": group, "description": desc, "courses": grouped[group]})

    if not result_sections:
        return None

    summary = str(data.get("summary") or "").strip()
    if not summary:
        summary = fallback_recommend_answer(major, grade, result_sections)
    return result_sections, summary


def is_roadmap_question(question: str) -> bool:
    text = normalize_question_text(question).lower()
    if not text:
        return False
    if any(keyword.lower() in text for keyword in ROADMAP_INTENT_KEYWORDS):
        return True
    has_major = extract_major_from_question(question) is not None
    has_grade = extract_grade_from_question(question) is not None
    course_words = ["과목", "수강", "전공", "교과", "학년"]
    return has_major and (has_grade or any(word in text for word in course_words))


def extract_major_from_question(question: str) -> str | None:
    text = normalize_question_text(question)
    candidates = [
        ("빅데이터", ["빅데이터", "bigdata", "big data"]),
        ("핀테크", ["핀테크", "fintech"]),
        ("IoT", ["IoT", "IOT", "iot", "사물인터넷"]),
        ("AR·VR", ["AR·VR", "ARㆍVR", "AR/VR", "ARVR", "arvr", "에이알", "브이알"]),
    ]
    lower_text = text.lower()
    for major, aliases in candidates:
        if any(alias.lower() in lower_text for alias in aliases):
            return major
    return None


def extract_grade_from_question(question: str) -> int | None:
    text = normalize_question_text(question)
    match = re.search(r"([1-4])\s*학년", text)
    if match:
        return int(match.group(1))
    match = re.search(r"\b([1-4])\s*학기", text)
    if match and "학년" in text:
        return None
    return None


def resolve_roadmap_profile(question: str, current_user: dict | None = None):
    major = extract_major_from_question(question)
    grade = extract_grade_from_question(question)
    if not major and current_user:
        major = current_user.get("major") or ""
    if not grade and current_user:
        grade = int(current_user.get("grade") or 0)
    if major and grade:
        return validate_profile_values(major, grade)
    return major or "", int(grade or 0)


def build_course_recommendation(major: str, grade: int, question: str | None = None) -> dict:
    major, grade = validate_profile_values(major, grade)

    guide_items = [
        item for item in dataset
        if item.get("label") == "수강추천" and item_matches_major(item, major)
    ]
    course_items = [
        item for item in dataset
        if item.get("label") == "수강신청" and item_matches_major(item, major)
    ][:16]
    roadmap_items = [
        item for item in dataset
        if item.get("label") in ("학업 로드맵", "진로 가이드", "수강신청 유의사항")
        and item_matches_major(item, major)
    ][:8]
    filtered_items = guide_items + course_items + roadmap_items

    sections = build_recommendation_sections(major, filtered_items, grade)
    if not filtered_items:
        return {
            "major": major,
            "grade": grade,
            "answer": "추천에 필요한 로드맵 데이터가 아직 부족합니다. 2024~2026 첨단IT학부 로드맵 데이터를 먼저 추가해주세요.",
            "sections": [],
            "source_count": 0,
        }

    answer = fallback_recommend_answer(major, grade, sections)
    source = "fallback"
    if has_ai_key():
        try:
            ai_result = build_ai_course_sections(major, grade, sections, question)
            if ai_result:
                sections, answer = ai_result
                source = "ai"
        except Exception:
            pass

    return {
        "major": major,
        "grade": grade,
        "answer": answer,
        "sections": sections,
        "source_count": len(filtered_items),
        "structured_course_count": len(get_roadmap_courses(major)),
        "source": source,
    }


def process_roadmap_chat_question(question: str, current_user: dict | None = None) -> dict:
    major, grade = resolve_roadmap_profile(question, current_user)
    if not major or not grade:
        return {
            "question": question,
            "category": "수강추천",
            "matched_question": None,
            "confidence": 0.82,
            "answer": (
                "전공 로드맵을 맞춤으로 추천하려면 전공과 학년 정보가 필요해요. "
                "상단 프로필 메뉴의 마이페이지에서 전공과 학년을 설정하거나, "
                "\"빅데이터 2학년 추천 과목 알려줘\"처럼 질문에 전공과 학년을 함께 적어주세요."
            ),
            "source": "roadmap_profile_required",
        }

    recommendation = build_course_recommendation(major, grade, question)
    return {
        "question": question,
        "category": "수강추천",
        "matched_question": f"{major} {grade}학년 로드맵",
        "confidence": 0.92,
        "answer": recommendation["answer"],
        "source": f"roadmap_{recommendation.get('source', 'fallback')}",
        "roadmap": recommendation,
    }

@app.post("/chat")
def chat(req: ChatRequest):
    try:
        return process_chat_question(req.question)
    except Exception as e:
        return {"error": str(e)}

# ── 인증 엔드포인트 ───────────────────────────────────────────────────────────
@app.get("/auth/me")
def me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}


@app.post("/auth/signup")
def signup(req: SignupRequest):
    if not req.name.strip() or not req.email.strip() or not req.password:
        raise HTTPException(status_code=400, detail="모든 필드를 입력해주세요")
    major, grade = ("", 0)
    if req.major or req.grade:
        major, grade = validate_profile_values(req.major, req.grade)
    salt          = secrets.token_hex(16)
    password_hash = hash_password(req.password, salt)
    token         = secrets.token_urlsafe(32)
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (name, email, password_hash, salt, major, grade) VALUES (?, ?, ?, ?, ?, ?)",
            (req.name.strip(), req.email.strip().lower(), password_hash, salt, major, grade)
        )
        conn.commit()
        user = conn.execute(
            "SELECT * FROM users WHERE email = ?", (req.email.strip().lower(),)
        ).fetchone()
        conn.execute(
            "INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)", (token, user["id"])
        )
        conn.commit()
        return {
            "token": token,
            "user":  user_to_dict(user),
        }
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다")
    finally:
        conn.close()


@app.post("/auth/login")
def login(req: LoginRequest):
    conn = get_db()
    try:
        user = conn.execute(
            "SELECT * FROM users WHERE email = ?", (req.email.strip().lower(),)
        ).fetchone()
        if not user or hash_password(req.password, user["salt"]) != user["password_hash"]:
            raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")
        token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)", (token, user["id"])
        )
        conn.commit()
        return {
            "token": token,
            "user":  user_to_dict(user),
        }
    finally:
        conn.close()


# ── Google OAuth ─────────────────────────────────────────────────────────────
@app.patch("/auth/profile")
def update_profile(req: ProfileUpdateRequest, current_user: dict = Depends(get_current_user)):
    updates = {}
    if req.major is not None:
        updates["major"] = normalize_major(req.major)
    if req.grade is not None:
        updates["grade"] = int(req.grade)

    if not updates:
        return {"user": current_user}

    major = updates.get("major", current_user.get("major", ""))
    grade = updates.get("grade", current_user.get("grade", 0))
    major, grade = validate_profile_values(major, grade)

    conn = get_db()
    try:
        conn.execute(
            "UPDATE users SET major = ?, grade = ? WHERE id = ?",
            (major, grade, current_user["id"]),
        )
        conn.commit()
        user = conn.execute("SELECT * FROM users WHERE id = ?", (current_user["id"],)).fetchone()
        return {"user": user_to_dict(user)}
    finally:
        conn.close()


def google_error_detail(resp, fallback: str) -> str:
    try:
        data = resp.json()
    except ValueError:
        return fallback
    return data.get("error_description") or data.get("error") or fallback


def google_user_from_access_token(access_token: str):
    resp = http.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    if not resp.ok:
        detail = google_error_detail(resp, "Google userinfo request failed.")
        raise HTTPException(status_code=401, detail=f"Google userinfo request failed: {detail}")

    info = resp.json()
    email = info.get("email", "").strip().lower()
    name = info.get("name") or email.split("@")[0]
    if not email:
        raise HTTPException(status_code=400, detail="Google account email is missing.")
    return email, name


def issue_google_login(email: str, name: str):
    conn = get_db()
    try:
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not user:
            salt = secrets.token_hex(16)
            password_hash = hash_password(secrets.token_urlsafe(32), salt)
            conn.execute(
                "INSERT INTO users (name, email, password_hash, salt) VALUES (?, ?, ?, ?)",
                (name, email, password_hash, salt),
            )
            conn.commit()
            user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

        token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)", (token, user["id"])
        )
        conn.commit()
        return {
            "token": token,
            "user": user_to_dict(user),
        }
    finally:
        conn.close()


@app.post("/auth/google/legacy")
def google_auth(req: GoogleAuthRequest):
    resp = http.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {req.access_token}"},
        timeout=10,
    )
    if not resp.ok:
        raise HTTPException(status_code=401, detail="구글 인증에 실패했습니다")

    info  = resp.json()
    email = info.get("email", "").strip().lower()
    name  = info.get("name") or email.split("@")[0]
    if not email:
        raise HTTPException(status_code=400, detail="구글 계정에서 이메일을 가져올 수 없습니다")

    conn = get_db()
    try:
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not user:
            salt          = secrets.token_hex(16)
            password_hash = hash_password(secrets.token_urlsafe(32), salt)
            conn.execute(
                "INSERT INTO users (name, email, password_hash, salt) VALUES (?, ?, ?, ?)",
                (name, email, password_hash, salt),
            )
            conn.commit()
            user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

        token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)", (token, user["id"])
        )
        conn.commit()
        return {
            "token": token,
            "user":  user_to_dict(user),
        }
    finally:
        conn.close()


# ── 세션 엔드포인트 ───────────────────────────────────────────────────────────
@app.post("/auth/google")
def google_auth(req: GoogleAuthRequest):
    email, name = google_user_from_access_token(req.access_token)
    return issue_google_login(email, name)


@app.post("/auth/google/code")
def google_code_auth(req: GoogleCodeRequest):
    payload = {
        "code": req.code,
        "client_id": req.client_id or GOOGLE_WEB_CLIENT_ID,
        "redirect_uri": req.redirect_uri,
        "grant_type": "authorization_code",
    }
    if not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="백엔드 .env에 GOOGLE_CLIENT_SECRET을 설정해 주세요.",
        )
    payload["client_secret"] = GOOGLE_CLIENT_SECRET
    if req.code_verifier:
        payload["code_verifier"] = req.code_verifier

    resp = http.post("https://oauth2.googleapis.com/token", data=payload, timeout=10)
    if not resp.ok:
        detail = google_error_detail(resp, "Google login token exchange failed.")
        raise HTTPException(status_code=401, detail=f"Google login token exchange failed: {detail}")

    access_token = resp.json().get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Google access token is missing.")

    email, name = google_user_from_access_token(access_token)
    return issue_google_login(email, name)


@app.post("/recommend")
def recommend_courses(req: RecommendRequest, current_user: dict = Depends(get_current_user)):
    return build_course_recommendation(req.major, req.grade)


@app.get("/roadmap/courses")
def list_roadmap_courses(major: str | None = None, current_user: dict = Depends(get_current_user)):
    selected_major = normalize_major(major or current_user.get("major", ""))
    if selected_major and selected_major not in VALID_MAJORS:
        raise HTTPException(status_code=400, detail="지원하지 않는 전공입니다.")
    courses = get_roadmap_courses(selected_major) if selected_major else roadmap_courses
    return {
        "major": selected_major,
        "count": len(courses),
        "courses": courses,
    }


@app.get("/sessions")
def list_sessions(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC",
            (current_user["id"],)
        ).fetchall()
        result = []
        for s in rows:
            last_msg = conn.execute(
                "SELECT text FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT 1",
                (s["id"],)
            ).fetchone()
            result.append({
                "id":      s["id"],
                "title":   s["title"],
                "preview": last_msg["text"] if last_msg else "대화를 시작해 보세요",
                "time":    s["updated_at"],
                "unread":  0,
            })
        return result
    finally:
        conn.close()


@app.post("/sessions")
def create_session(req: SessionCreate, current_user: dict = Depends(get_current_user)):
    session_id   = str(uuid.uuid4())
    bot_greeting = "안녕하세요! 흰돌이입니다. 백석대학교에 대해 무엇이든 물어보세요."
    now          = datetime.now().isoformat()
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (session_id, current_user["id"], req.title, now, now)
        )
        conn.execute(
            "INSERT INTO messages (session_id, role, text, created_at) VALUES (?, 'bot', ?, ?)",
            (session_id, bot_greeting, now)
        )
        conn.commit()
        return {
            "id":       session_id,
            "title":    req.title,
            "messages": [{"role": "bot", "text": bot_greeting, "time": now}],
        }
    finally:
        conn.close()


@app.patch("/sessions/{session_id}")
def rename_session(session_id: str, req: SessionCreate, current_user: dict = Depends(get_current_user)):
    if not req.title.strip():
        raise HTTPException(status_code=400, detail="제목을 입력해주세요")
    conn = get_db()
    try:
        result = conn.execute(
            "UPDATE chat_sessions SET title = ? WHERE id = ? AND user_id = ?",
            (req.title.strip(), session_id, current_user["id"])
        )
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
        return {"ok": True}
    finally:
        conn.close()


@app.delete("/sessions/{session_id}")
def delete_session(session_id: str, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        conn.execute(
            """
            DELETE FROM message_categories
            WHERE message_id IN (SELECT id FROM messages WHERE session_id = ?)
            """,
            (session_id,),
        )
        conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
        result = conn.execute(
            "DELETE FROM chat_sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user["id"])
        )
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
        return {"ok": True}
    finally:
        conn.close()


@app.get("/sessions/{session_id}/messages")
def get_session_messages(session_id: str, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        session = conn.execute(
            "SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user["id"])
        ).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
        rows = conn.execute(
            "SELECT role, text, created_at FROM messages WHERE session_id = ? ORDER BY id ASC",
            (session_id,)
        ).fetchall()
        return [{"role": r["role"], "text": r["text"], "time": r["created_at"]} for r in rows]
    finally:
        conn.close()


@app.post("/sessions/{session_id}/messages")
def send_session_message(
    session_id: str,
    req: MessageCreate,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db()
    try:
        session = conn.execute(
            "SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user["id"])
        ).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

        now = datetime.now().isoformat()
        user_insert = conn.execute(
            "INSERT INTO messages (session_id, role, text, created_at) VALUES (?, 'user', ?, ?)",
            (session_id, req.text, now)
        )

        category, confidence = "기타", 0.0
        try:
            chat_result = process_chat_question(req.text, current_user)
            category = normalize_insight_category(chat_result.get("category"))
            confidence = float(chat_result.get("confidence") or 0.0)
            bot_text    = chat_result.get("answer", "죄송합니다, 답변을 생성할 수 없습니다.")
        except Exception:
            category, confidence = infer_question_category(req.text)
            bot_text = "죄송합니다, 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."

        intent_categories = classify_question_intents(req.text)
        if intent_categories:
            primary = next(
                (item for item in intent_categories if item.get("category") != "범위밖"),
                intent_categories[0],
            )
            category = normalize_insight_category(primary.get("category"))
            confidence = float(primary.get("confidence") or confidence or 0.0)

        conn.execute(
            "UPDATE messages SET category = ?, confidence = ? WHERE id = ?",
            (category, confidence, user_insert.lastrowid)
        )
        save_message_categories(conn, user_insert.lastrowid, intent_categories)

        bot_now = datetime.now().isoformat()
        conn.execute(
            "INSERT INTO messages (session_id, role, text, created_at) VALUES (?, 'bot', ?, ?)",
            (session_id, bot_text, bot_now)
        )

        if session["title"] == "새로운 대화":
            title = req.text[:25] + ("..." if len(req.text) > 25 else "")
            conn.execute(
                "UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?",
                (title, bot_now, session_id)
            )
        else:
            conn.execute(
                "UPDATE chat_sessions SET updated_at = ? WHERE id = ?",
                (bot_now, session_id)
            )

        conn.commit()
        return {
            "messages":  [{"role": "bot", "text": bot_text, "time": bot_now}],
            "bot_reply": bot_text,
        }
    finally:
        conn.close()


# ── 루트 ─────────────────────────────────────────────────────────────────────
@app.get("/insights")
def get_insights(days: int = 30, current_user: dict = Depends(get_current_user)):
    period_days = max(1, min(days, 365))
    cutoff = (datetime.now() - timedelta(days=period_days)).isoformat()
    conn = get_db()
    try:
        message_rows = conn.execute(
            """
            SELECT m.id, m.text, m.category, m.confidence
            FROM messages m
            JOIN chat_sessions s ON s.id = m.session_id
            WHERE s.user_id = ?
              AND m.role = 'user'
              AND m.created_at >= ?
            ORDER BY m.id ASC
            """,
            (current_user["id"], cutoff),
        ).fetchall()

        for row in message_rows:
            existing = conn.execute(
                "SELECT COUNT(*) AS count FROM message_categories WHERE message_id = ?",
                (row["id"],),
            ).fetchone()
            if not existing or int(existing["count"] or 0) == 0:
                classifications = classify_question_intents(row["text"])
                save_message_categories(conn, row["id"], classifications)
                primary = next(
                    (item for item in classifications if item.get("category") != "범위밖"),
                    classifications[0] if classifications else None,
                )
                if primary:
                    conn.execute(
                        "UPDATE messages SET category = ?, confidence = ? WHERE id = ?",
                        (
                            normalize_insight_category(primary.get("category")),
                            float(primary.get("confidence") or 0.0),
                            row["id"],
                        ),
                    )

        rows = conn.execute(
            """
            SELECT mc.category, mc.confidence, mc.intent_text, m.text
            FROM message_categories mc
            JOIN messages m ON m.id = mc.message_id
            JOIN chat_sessions s ON s.id = m.session_id
            WHERE s.user_id = ?
              AND m.role = 'user'
              AND m.created_at >= ?
            ORDER BY mc.id ASC
            """,
            (current_user["id"], cutoff),
        ).fetchall()

        counts = {}
        confidence_sum = {}
        questions_by_category = {}
        for row in rows:
            category = normalize_insight_category(row["category"])
            confidence = row["confidence"]

            if category == "범위밖":
                continue

            counts[category] = counts.get(category, 0) + 1
            confidence_sum[category] = confidence_sum.get(category, 0.0) + float(confidence or 0.0)
            questions_by_category.setdefault(category, []).append(row["intent_text"] or row["text"])

        if message_rows:
            conn.commit()

        total = sum(counts.values())
        categories = []
        for category, count in sorted(counts.items(), key=lambda item: item[1], reverse=True):
            percent = round((count / total) * 100) if total else 0
            avg_confidence = round(confidence_sum.get(category, 0.0) / count, 2) if count else 0.0
            categories.append({
                "name": category,
                "count": count,
                "percent": percent,
                "confidence": avg_confidence,
            })

        top_category = categories[0] if categories else None
        top_name = top_category["name"] if top_category else "기타"

        return {
            "period_days": period_days,
            "total": total,
            "daily_average": round(total / period_days, 1),
            "topic_count": len(categories),
            "categories": categories,
            "top_category": top_category,
            "recommendation": build_insight_recommendation(top_name),
        }
    finally:
        conn.close()


@app.get("/insights/recommendation")
def get_insight_recommendation(days: int = 30, current_user: dict = Depends(get_current_user)):
    period_days = max(1, min(days, 365))
    cutoff = (datetime.now() - timedelta(days=period_days)).isoformat()
    conn = get_db()
    try:
        rows = conn.execute(
            """
            SELECT mc.category, mc.intent_text, m.text
            FROM message_categories mc
            JOIN messages m ON m.id = mc.message_id
            JOIN chat_sessions s ON s.id = m.session_id
            WHERE s.user_id = ?
              AND m.role = 'user'
              AND m.created_at >= ?
              AND mc.category != '범위밖'
            ORDER BY mc.id ASC
            """,
            (current_user["id"], cutoff),
        ).fetchall()

        if not rows:
            message_rows = conn.execute(
                """
                SELECT m.id, m.text
                FROM messages m
                JOIN chat_sessions s ON s.id = m.session_id
                WHERE s.user_id = ?
                  AND m.role = 'user'
                  AND m.created_at >= ?
                ORDER BY m.id ASC
                """,
                (current_user["id"], cutoff),
            ).fetchall()
            for row in message_rows:
                classifications = classify_question_intents(row["text"])
                save_message_categories(conn, row["id"], classifications)
            if message_rows:
                conn.commit()
            rows = conn.execute(
                """
                SELECT mc.category, mc.intent_text, m.text
                FROM message_categories mc
                JOIN messages m ON m.id = mc.message_id
                JOIN chat_sessions s ON s.id = m.session_id
                WHERE s.user_id = ?
                  AND m.role = 'user'
                  AND m.created_at >= ?
                  AND mc.category != '범위밖'
                ORDER BY mc.id ASC
                """,
                (current_user["id"], cutoff),
            ).fetchall()

        counts = {}
        questions_by_category = {}
        for row in rows:
            category = normalize_insight_category(row["category"])
            counts[category] = counts.get(category, 0) + 1
            questions_by_category.setdefault(category, []).append(row["intent_text"] or row["text"])

        top_name = max(counts.items(), key=lambda item: item[1])[0] if counts else "기타"
        recommendation = generate_insight_recommendation(
            top_name,
            questions_by_category.get(top_name, []),
        )
        return {
            "period_days": period_days,
            "topic": recommendation.get("topic", top_name),
            "blurb": recommendation.get("blurb", ""),
            "questions": recommendation.get("questions", []),
            "source": recommendation.get("source", "fallback"),
            "reason": recommendation.get("reason", ""),
        }
    finally:
        conn.close()


@app.get("/")
def read_root():
    return {"message": "FastAPI 연결 성공"}
