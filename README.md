# Assistant Chatbot for Investment Guide

## 프로젝트 개요
이 프로젝트는 **투자가이드**와 **LLM(Large Language Model)**을 활용한 **맞춤형 어시스턴트 챗봇** 개발에 중점을 두고 있으며, 다음과 같은 목표를 달성하고자 함:
1. 자연어 기반의 SQL 생성을 통해 **RDBMS 데이터 활용**.
2. **PDF 임베딩** 및 **벡터 유사도 검색**을 통해 신뢰성 있는 투자가이드 제공.
3. LLM의 할루시네이션 문제를 줄이고 실질적인 비즈니스 데이터를 활용한 정확한 조언 제공.
![image](https://github.com/user-attachments/assets/75e26a9f-75da-4601-9a65-9e1899bf893f)

---

## 주요 기능
### 1. 사용자 맞춤형 질문-응답
- **프롬프트 엔지니어링**을 통해 자연어 입력을 SQL 쿼리로 변환.
- RDBMS에서 투자 데이터 및 사용자 정보를 활용하여 **구체적이고 신뢰도 높은 답변** 생성.

### 2. 투자가이드 문서 활용
- ONNX 기반 임베딩 모델을 사용하여 PDF 문서를 벡터화.
- **벡터 유사도 검색**으로 사용자의 질문과 가장 관련 있는 문서를 찾아 응답.

### 3. 실시간 데이터 연동
- 사용자 맞춤형 질의응답 외에도 실시간 데이터베이스 연동을 통해 투자가이드와 고객 정보를 결합한 **맞춤형 추천** 제공.

---

## 개발 스택
- **LLM(OpenAI API)**: 자연어 → SQL 변환 및 사용자 맞춤형 답변 제공.
- **RDBMS(Oracle)**: 고객 데이터와 투자 데이터를 활용하여 정교한 데이터 분석.
- **PDF 문서 임베딩**: ONNX 포맷을 활용해 PDF를 벡터화하고 검색 가능하도록 처리.
- **벡터 유사도 검색**: Oracle DB의 `VECTOR_DISTANCE` 함수를 활용한 벡터 검색 구현.
- **Vue.js**: 직관적인 사용자 인터페이스(UI)와 UX 설계.
- **Python**: 백엔드 API와 데이터 처리.

---

## 애플리케이션 플로우
1. **사용자 입력**: 웹 브라우저에서 투자 관련 질문 입력.
2. **AP 서버**: 
   - PDF 투자가이드 문서 업로드 및 벡터 임베딩 수행.
   - Augmented 프롬프트를 생성하여 LLM 요청.
3. **DB 서버**:
   - 고객 정보와 벡터 유사도 검색을 통해 사용자 질문에 맞는 데이터 제공.
4. **결과 출력**: Chatbot 인터페이스를 통해 사용자 맞춤형 답변 제공.
![image](https://github.com/user-attachments/assets/d55942aa-0e35-4ee5-9a13-1fa32da4a6fa)

---

## 데이터 처리 방식
- **고객 데이터베이스 스키마**:
  - 사용자 ID, 이름, 나이, 투자 성향, 과거 투자 내역 등 다양한 정보를 포함.
- **PDF 투자가이드**:
  - 임베딩된 PDF 문서를 통해 투자 가이드의 핵심 내용을 검색 가능.
 

## 기대 효과
- **업무 효율성 향상**:
자연어로 SQL을 생성하여 데이터 활용 접근성 대폭 강화.
- **정확성 및 신뢰성 강화**:
투자가이드 문서와 사용자 데이터를 결합하여 맞춤형 결과 제공.
벡터 임베딩으로 LLM의 할루시네이션 문제 최소화.
- **확장 가능성**:
금융 외에도 교육, 의료, 법률 등 다양한 도메인에 적용 가능.
실시간 데이터 연동으로 더욱 확장 가능한 플랫폼 구축.
