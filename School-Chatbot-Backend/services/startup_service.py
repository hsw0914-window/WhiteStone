import json
import os

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

import runtime
from config import BASE_DIR
from db import init_db


async def initialize_app() -> None:
    init_db()
    print("AI 챗봇 엔진 초기화 중...")

    runtime.dataset = []
    runtime.building_places = []
    runtime.roadmap_courses = []
    runtime.response_cache = {}

    runtime.model = SentenceTransformer("jhgan/ko-sroberta-multitask", device="cpu")

    dataset_path = os.path.join(BASE_DIR, "dataset.json")
    with open(dataset_path, "r", encoding="utf-8") as file:
        for line in file:
            if line.strip():
                runtime.dataset.append(json.loads(line))

    docs_to_embed = [item["instruction"] + " " + item["output"] for item in runtime.dataset]
    embeddings = runtime.model.encode(docs_to_embed)
    embeddings = np.array(embeddings).astype("float32")

    dimension = embeddings.shape[1]
    runtime.index = faiss.IndexFlatL2(dimension)
    runtime.index.add(embeddings)

    runtime.building_places = [
        item for item in runtime.dataset
        if item.get("label") == "건물주소" and item.get("lat") is not None
    ]

    runtime.roadmap_courses = runtime.build_roadmap_courses_from_dataset()

    print(
        f"초기화 완료: {len(runtime.dataset)}개 데이터, "
        f"{len(runtime.building_places)}개 건물, "
        f"{len(runtime.roadmap_courses)}개 로드맵 과목"
    )
