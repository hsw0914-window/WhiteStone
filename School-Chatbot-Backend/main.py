from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json, os, re, requests as http
from dotenv import load_dotenv
from google import genai
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
import sqlite3, hashlib, secrets, uuid
from datetime import datetime

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

KAKAO_JS_KEY   = os.getenv("KAKAO_JS_KEY", "")
KAKAO_REST_KEY = os.getenv("KAKAO_REST_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ── 전역 변수 (startup 시 초기화) ────────────────────────────────────────────
model           = None
index           = None
dataset         = []
building_places = []
response_cache  = {}

DISTANCE_THRESHOLD = 1.5
TOP_K = 3

# ── SQLite DB 설정 ────────────────────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chatbot.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT    NOT NULL,
            email         TEXT    UNIQUE NOT NULL,
            password_hash TEXT    NOT NULL,
            salt          TEXT    NOT NULL,
            created_at    TEXT    DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS auth_tokens (
            token      TEXT    PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            created_at TEXT    DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id         TEXT    PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            title      TEXT    NOT NULL DEFAULT '새로운 대화',
            created_at TEXT    DEFAULT (datetime('now')),
            updated_at TEXT    DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS messages (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT    NOT NULL,
            role       TEXT    NOT NULL,
            text       TEXT    NOT NULL,
            created_at TEXT    DEFAULT (datetime('now')),
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
        );
    """)
    conn.commit()
    conn.close()

def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        'sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000
    ).hex()

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    token = authorization[7:]
    conn = get_db()
    try:
        row = conn.execute(
            """SELECT u.id, u.name, u.email
               FROM users u
               JOIN auth_tokens t ON u.id = t.user_id
               WHERE t.token = ?""",
            (token,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")
        return dict(row)
    finally:
        conn.close()


# ── 서버 시작 시 한 번만 로드 ─────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    global model, index, dataset, building_places

    init_db()
    print("AI 챗봇 엔진 초기화 중...")

    model = SentenceTransformer("jhgan/ko-sroberta-multitask", device="cpu")

    base_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(base_dir, "dataset.json")
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

    print(f"초기화 완료: {len(dataset)}개 데이터, {len(building_places)}개 건물")


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
        content: '<div class="place-label">📍 ' + dest.place_name + '</div>',
      }}).open(map, destMarker);

      var bounds = new kakao.maps.LatLngBounds();
      path.forEach(function(p) {{ bounds.extend(p); }});
      map.setBounds(bounds, 60);

      stepOverlays.forEach(function(o) {{ o.setMap(null); }});
      stepOverlays = [];

      (steps || []).forEach(function(s, i) {{
        if (s.lat == null || s.lng == null) return;
        var content =
          '<div style="width:24px;height:24px;border-radius:50%;background:#fff;border:2px solid #1B76FF;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#1B76FF;box-shadow:0 1px 4px rgba(0,0,0,0.25);">' + (i + 1) + '</div>';
        var overlay = new kakao.maps.CustomOverlay({{
          position: new kakao.maps.LatLng(s.lat, s.lng), content: content, zIndex: 5,
        }});
        overlay.setMap(map);
        stepOverlays.push(overlay);
      }});

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
      document.getElementById('sheet').style.display = 'none';
    }}

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


# ── /navigate ─────────────────────────────────────────────────────────────────
class NavigateRequest(BaseModel):
    question: str
    lat: float
    lng: float

@app.post("/navigate")
def navigate(req: NavigateRequest):
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
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

        response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        text     = getattr(response, "text", "").strip()
        match    = re.search(r'\{.*?\}', text, re.DOTALL)

        place_name = None
        if match:
            place_name = json.loads(match.group()).get("place_name")

        destination = next(
            (p for p in building_places if p.get("place_name") == place_name), None
        )
        if not destination:
            return {"error": f"'{place_name}' 장소를 찾을 수 없습니다."}

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
def process_chat_question(question: str) -> dict:
    question = question.strip()

    if question in response_cache:
        return response_cache[question]

    indices, distances = faiss_search(question)
    best_distance = float(distances[0])
    confidence    = calc_confidence(best_distance)

    client = genai.Client(api_key=GEMINI_API_KEY)

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

        response     = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        final_answer = getattr(response, "text", str(response))

        result = {
            "question":         question,
            "category":         "편의시설",
            "matched_question": None,
            "confidence":       0.3,
            "answer":           final_answer,
            "source":           "백석대학교 AI 챗봇",
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

        response     = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        final_answer = getattr(response, "text", str(response))

        matched = top_matches[0]
        result  = {
            "question":         question,
            "category":         matched.get("label", ""),
            "matched_question": matched.get("instruction", ""),
            "confidence":       confidence,
            "answer":           final_answer,
            "source":           "백석대학교 AI 챗봇",
        }

    response_cache[question] = result
    return result


# ── /chat ─────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    question: str

@app.post("/chat")
def chat(req: ChatRequest):
    try:
        return process_chat_question(req.question)
    except Exception as e:
        return {"error": str(e)}


# ── 인증 스키마 ───────────────────────────────────────────────────────────────
class SignupRequest(BaseModel):
    name:     str
    email:    str
    password: str

class LoginRequest(BaseModel):
    email:    str
    password: str

class GoogleAuthRequest(BaseModel):
    access_token: str

class SessionCreate(BaseModel):
    title: str = "새로운 대화"

class MessageCreate(BaseModel):
    text: str


# ── 인증 엔드포인트 ───────────────────────────────────────────────────────────
@app.post("/auth/signup")
def signup(req: SignupRequest):
    if not req.name.strip() or not req.email.strip() or not req.password:
        raise HTTPException(status_code=400, detail="모든 필드를 입력해주세요")
    salt          = secrets.token_hex(16)
    password_hash = hash_password(req.password, salt)
    token         = secrets.token_urlsafe(32)
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (name, email, password_hash, salt) VALUES (?, ?, ?, ?)",
            (req.name.strip(), req.email.strip().lower(), password_hash, salt)
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
            "user":  {"id": user["id"], "name": user["name"], "email": user["email"]},
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
            "user":  {"id": user["id"], "name": user["name"], "email": user["email"]},
        }
    finally:
        conn.close()


@app.get("/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


# ── Google OAuth ─────────────────────────────────────────────────────────────
@app.post("/auth/google")
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
            "user":  {"id": user["id"], "name": user["name"], "email": user["email"]},
        }
    finally:
        conn.close()


# ── 세션 엔드포인트 ───────────────────────────────────────────────────────────
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
    bot_greeting = "안녕하세요! 백돌이입니다. 백석대학교에 대해 무엇이든 물어보세요."
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
        conn.execute(
            "INSERT INTO messages (session_id, role, text, created_at) VALUES (?, 'user', ?, ?)",
            (session_id, req.text, now)
        )

        try:
            chat_result = process_chat_question(req.text)
            bot_text    = chat_result.get("answer", "죄송합니다, 답변을 생성할 수 없습니다.")
        except Exception:
            bot_text = "죄송합니다, 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."

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
@app.get("/")
def read_root():
    return {"message": "FastAPI 연결 성공"}
