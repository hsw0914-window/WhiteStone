import { CampusPlace } from '../types/place';

// DB 연결 시 이 배열 제거하고 API fetch로 교체
const mockPlaces: CampusPlace[] = [
  { id:  1, place_name: '진리관',          building_type: '강의동', services: ['인쇄', '복사'],             lat: 36.840163, lng: 127.184503, description: '1층에 인쇄·복사 기기 있음' },
  { id:  2, place_name: '도서관',           building_type: '도서관', services: ['열람', '학습', '자료검색'], lat: 36.8374,   lng: 127.1836,   description: '백석대 중앙도서관' },
  { id:  3, place_name: '학생복지관',       building_type: '복지동', services: ['학생지원', '장학', '상담'],  lat: 36.840621, lng: 127.182499, description: '장학 및 학생 지원 업무' },
  { id:  4, place_name: '학생식당',         building_type: '식당',   services: ['식당', '학생식당'],          lat: 36.840500, lng: 127.182600, description: '학생 대상 구내식당' },
  { id:  5, place_name: '지혜관',           building_type: '강의동', services: ['강의', '학습', '사회복지', '상담심리'],   lat: 36.838697, lng: 127.184373, description: '사회복지·상담심리 학부 강의동' },
  { id:  6, place_name: '인성관',           building_type: '강의동', services: ['강의', '학습', '신학', '기독교'],         lat: 36.839426, lng: 127.183537, description: '신학·기독교학부 강의동' },
  { id:  7, place_name: '본부동',           building_type: '행정동', services: ['행정', '학사', '등록', '증명서', '민원'], lat: 36.839646, lng: 127.185891, description: '학사행정·증명서 발급' },
  { id:  8, place_name: '글로벌외식산업관', building_type: '강의동', services: ['강의', '외식', '조리', '식품'],           lat: 36.837539, lng: 127.185102, description: '외식·조리학부 강의동' },
  { id:  9, place_name: '창조관',           building_type: '강의동', services: ['강의', '디자인', '영상', '방송'],         lat: 36.837398, lng: 127.182433, description: '디자인·영상방송학부 강의동' },
  { id: 10, place_name: '백석홀',           building_type: '강당',   services: ['강당', '행사', '공연', '채플'],           lat: 36.839395, lng: 127.182501, description: '채플 및 대형 행사장' },
  { id: 11, place_name: '교수회관',         building_type: '교수동', services: ['교수', '면담', '연구', '상담'],           lat: 36.839720, lng: 127.184766, description: '교수 연구실 및 면담실' },
  { id: 12, place_name: '승리관',           building_type: '강의동', services: ['강의', '경영', '경제', '무역'],           lat: 36.841776, lng: 127.185807, description: '경영·경제학부 강의동' },
  { id: 13, place_name: '조형관',           building_type: '강의동', services: ['강의', '조형', '미술', '회화'],           lat: 36.840871, lng: 127.188460, description: '조형·미술학부 강의동' },
  { id: 14, place_name: '예술대학동',       building_type: '강의동', services: ['강의', '예술', '음악', '실용음악'],       lat: 36.838872, lng: 127.187748, description: '음악·실용음악학부 강의동' },
  { id: 15, place_name: '체육관',           building_type: '체육관', services: ['체육', '운동', '스포츠', '헬스', '농구'], lat: 36.841338, lng: 127.187358, description: '체육 시설 및 헬스장' },
];

// DB 연결 시: return await fetch('http://YOUR_API/places').then(r => r.json())
export async function fetchCampusPlaces(): Promise<CampusPlace[]> {
  return mockPlaces;
}
