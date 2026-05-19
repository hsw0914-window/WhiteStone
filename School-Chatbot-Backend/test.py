import json
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

# 1. 한국어 임베딩 모델 로드
# GPU(RTX 2060 SUPER)가 있으므로 '모델' 연산 자체는 'cuda'를 써서 초고속으로 처리합니다.
model = SentenceTransformer('jhgan/ko-sroberta-multitask', device='cpu')

# 2. 데이터셋 로드 (한 줄씩 읽기)
dataset = []
with open('dataset.json', 'r', encoding='utf-8') as f: # 파일명 .jsonl 로 수정된 상태
    for line in f:
        if line.strip(): # 빈 줄 제외
            dataset.append(json.loads(line))

# ==========================================
# 🛠️ 수정한 부분: 질문과 답변을 합쳐서 검색 기준으로 만듭니다!
# ==========================================
docs_to_embed = [data['instruction'] + " " + data['output'] for data in dataset]

# 3. 텍스트를 벡터로 변환 (Embedding)
print("임베딩 생성 중...")
embeddings = model.encode(docs_to_embed) # 수정됨: instructions 대신 docs_to_embed 사용
embeddings = np.array(embeddings).astype('float32') # FAISS는 float32를 요구합니다.
# ==========================================

# 4. FAISS CPU 인덱스 생성
dimension = embeddings.shape[1]      # 벡터 차원 (보통 768차원)
index = faiss.IndexFlatL2(dimension) # 유클리디안 거리 기반 인덱스

# 5. 벡터 데이터를 FAISS에 추가 (CPU 메모리에 저장)
index.add(embeddings)
print(f"FAISS에 {index.ntotal}개의 데이터가 성공적으로 저장되었습니다!")

# =====================================================================
# 챗봇 테스트 (사용자 질의응답)
# =====================================================================

user_query = "백석대학교 기숙사 통금 시간이 언제야?"
print(f"\n사용자 질문: {user_query}")

# 질문을 동일한 모델로 임베딩
query_embedding = model.encode([user_query])
query_embedding = np.array(query_embedding).astype('float32')

# FAISS에서 유사도가 가장 높은 데이터 Top 3 검색
k = 3 
distances, indices = index.search(query_embedding, k)

print("--- 검색된 상위 3개 결과 ---")
for i in range(k):
    match_idx = indices[0][i]
    score = distances[0][i]
    print(f"{i+1}위 점수({score:.4f}): {dataset[match_idx]['instruction']}")

# 검색 결과 가져오기
best_match_index = indices[0][0]
distance_score = distances[0][0]
matched_data = dataset[best_match_index]

print(f"\n최종 매칭된 질문(Instruction): {matched_data['instruction']} (거리 점수: {distance_score:.4f})")
print(f"챗봇 답변(Output):\n{matched_data['output']}")