import json
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

print("⚙️ 챗봇 엔진을 준비하는 중입니다. (약 5~10초 소요)...")

# 1. 모델 로드
model = SentenceTransformer('jhgan/ko-sroberta-multitask', device='cpu')

# 2. 데이터셋 로드
dataset = []
with open('dataset.json', 'r', encoding='utf-8') as f:
    for line in f:
        if line.strip():
            dataset.append(json.loads(line))

# 3. 질문+답변 합쳐서 임베딩
docs_to_embed = [data['instruction'] + " " + data['output'] for data in dataset]
embeddings = model.encode(docs_to_embed)
embeddings = np.array(embeddings).astype('float32')

# 4. FAISS 인덱스 생성 및 데이터 추가
dimension = embeddings.shape[1]
index = faiss.IndexFlatL2(dimension)
index.add(embeddings)

print("\n" + "="*50)
print("🤖 백석대학교 AI 챗봇이 준비되었습니다!")
print("종료하시려면 '종료', 'exit', 'q' 중 하나를 입력해주세요.")
print("="*50)

# ==========================================
# 5. 대화형(Interactive) 무한 루프 시작
# ==========================================
while True:
    # 사용자로부터 질문 입력받기
    user_query = input("\n👤 질문을 입력하세요: ")
    
    # 종료 명령어 처리
    if user_query.strip().lower() in ['종료', 'exit', 'q', 'quit']:
        print("🤖 챗봇: 대화를 종료합니다. 좋은 하루 보내세요!")
        break
        
    # 빈 입력 방지
    if not user_query.strip():
        continue

    # 질문 임베딩 및 검색
    query_embedding = model.encode([user_query])
    query_embedding = np.array(query_embedding).astype('float32')
    
    # 가장 유사한 데이터 1개 찾기
    distances, indices = index.search(query_embedding, 1)
    
    best_match_index = indices[0][0]
    distance_score = distances[0][0]
    matched_data = dataset[best_match_index]
    
    # 결과 출력
    print("-" * 50)
    print(f"🤖 챗봇 답변:\n{matched_data['output']}")
    print("-" * 50)
    
    # (개발자 확인용) 어떤 데이터를 찾았는지, 점수는 몇 점인지 아래에 작게 표시
    print(f" 💡 [참고] 검색된 원본 질문: {matched_data['instruction']} (거리: {distance_score:.2f})")