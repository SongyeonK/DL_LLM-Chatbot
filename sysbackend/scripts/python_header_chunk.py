import fitz  # PyMuPDF
import sys
import json
import re

# 1. PDF 텍스트 추출 및 분석 (페이지별로 텍스트를 추출)
def extract_text_by_page(pdf_path):
    doc = fitz.open(pdf_path)
    text_per_page = []
    for page_num in range(doc.page_count):
        page = doc.load_page(page_num)
        text = page.get_text("text")
        text_per_page.append(text)
    return text_per_page

# 2. 목차 페이지 식별
def find_toc_pages(text_per_page):
    toc_pages = []
    toc_keywords = ["Table of Contents", "Contents", "목차"]
    toc_pattern_found = False  # 목차 패턴이 시작되었는지 여부

    for i, text in enumerate(text_per_page):
        # '목차'라는 키워드가 있는 페이지 확인
        for keyword in toc_keywords:
            if keyword.lower() in text.lower():
                if i not in toc_pages:  # 중복 방지
                    toc_pages.append(i)
                toc_pattern_found = True
                break

        # 키워드가 없더라도 목차 패턴을 탐지
        if not toc_pages and detect_toc_pattern(text):
            if i not in toc_pages:  # 중복 방지
                toc_pages.append(i)
                toc_pattern_found = True
        elif toc_pattern_found and detect_toc_pattern(text):
            if i not in toc_pages:  # 중복 방지
                toc_pages.append(i)
        elif toc_pattern_found and not detect_toc_pattern(text):
            break

    if not toc_pages:
        print("TOC pages not found.", file=sys.stderr)
        return []

    return toc_pages

# 2-1. 목차 패턴을 감지하는 함수
def detect_toc_pattern(text):
    # 텍스트의 각 줄을 나눔
    lines = text.splitlines()

    # 숫자 또는 번호로 끝나는 패턴을 정의
    toc_pattern = re.compile(r'\b\d+[-–]?\d*$')  # 줄 끝에 숫자 또는 '7-1', '7' 등의 번호가 있는 패턴

    pattern_count = 0  # 패턴이 발견된 줄의 개수
    for line in lines:
        if line.strip() and toc_pattern.search(line.strip()):
            pattern_count += 1
        else:
            if pattern_count >= 5:  # 최소 5개 이상의 패턴이 연속으로 나타나면 목차로 간주
                return True
            else:
                pattern_count = 0

    return pattern_count >= 3  # 최종적으로 3개 이상의 패턴이 있으면 True 반환

# 3. 목차의 레벨 구분 및 섹션-페이지 매핑
def extract_toc_levels(pdf_path):
    doc = fitz.open(pdf_path)
    toc_info = []

    # 목차 페이지들을 찾음
    toc_pages = find_toc_pages(extract_text_by_page(pdf_path))
    if not toc_pages:
        print("No Table of Contents found.", file=sys.stderr)
        return []

    # 모든 목차 페이지에서 들여쓰기 정보 수집 (X 좌표값)
    indentations = []  # 들여쓰기 정도를 담을 리스트

    # 각 목차 페이지에서 텍스트 블록의 X 좌표값을 수집
    for toc_page in toc_pages:
        page = doc.load_page(toc_page)
        blocks = page.get_text("dict")["blocks"]

        for block in blocks:
            for line in block["lines"]:
                # 라인의 시작 좌표 X 값을 가져옴
                x0 = line["bbox"][0]
                indentations.append(x0)

    # 중복된 들여쓰기 값을 제거하고 정렬
    unique_indentations = sorted(set(indentations))

    # 들여쓰기 단계 설정
    level_thresholds = {}
    for idx, indent in enumerate(unique_indentations):
        level_thresholds[idx + 1] = indent

    # 다시 각 목차 페이지에서 레벨을 동적으로 구분하여 수집
    previous_line = None
    toc_entries = []
    for toc_page in toc_pages:
        page = doc.load_page(toc_page)
        blocks = page.get_text("dict")["blocks"]

        for block in blocks:
            for line in block["lines"]:
                bbox = line["bbox"]  # 라인의 위치 정보
                text = " ".join([span["text"] for span in line["spans"]]).strip()  # 텍스트 내용

                # 빈 라인은 건너뜀
                if not text:
                    continue

                x_indent = bbox[0]

                # 동적으로 레벨 구분 (X 좌표 값 기반)
                level = 1
                for lvl, indent in level_thresholds.items():
                    if abs(x_indent - indent) < 2:  # 약간의 오차 허용
                        level = lvl
                        break

                # 페이지 번호 패턴 검사
                page_number = extract_page_number(text)
                if page_number:
                    # 페이지 번호와 점선을 제거한 제목 추출
                    title = re.sub(r"\s*\.+\s*\S+\s*$", "", text).strip()

                    # 이전 라인과 결합 필요 여부 확인
                    if previous_line and is_number_line(previous_line['text']):
                        # 번호와 제목 결합
                        title = previous_line['text'] + ' ' + title
                        level = previous_line['level']

                    toc_entries.append({
                        "level": level,
                        "title": title,
                        "page_num": page_number
                    })

                    previous_line = None  # 이전 라인 초기화
                else:
                    # 번호만 있는 라인인지 확인
                    if is_number_line(text):
                        previous_line = {'text': text, 'level': level}
                    else:
                        # 제목만 있는 라인인지 확인
                        if previous_line and is_number_line(previous_line['text']):
                            # 번호와 제목 결합
                            previous_line['text'] += ' ' + text
                        else:
                            previous_line = {'text': text, 'level': level}

    # 섹션 제목과 첫 번째 하위 섹션의 페이지 번호 매핑
    toc_info = []
    for idx, entry in enumerate(toc_entries):
        if idx + 1 < len(toc_entries):
            next_entry = toc_entries[idx + 1]
            if entry['level'] == 1 and next_entry['level'] > 1:
                # 섹션 제목의 페이지 번호를 다음 하위 섹션의 페이지 번호로 설정
                entry['page_num'] = next_entry['page_num']
        toc_info.append(entry)

    return toc_info

def is_number_line(text):
    # 번호만 있는 라인인지 확인
    return re.match(r'^\d+(\.\d+)*$', text.strip()) is not None

# 4. 실제 본문 페이지 번호 추출
def extract_page_number(text):
    # 텍스트 끝의 페이지 번호 패턴을 찾음
    page_number_match = re.search(r'\b\S+\s*$', text)
    if page_number_match:
        page_number = page_number_match.group(0).strip()
        # 페이지 번호에 문자나 숫자가 포함되어 있는지 확인
        if re.match(r'\d+[-–]?\d*$', page_number):
            return page_number
    return None

# 5. 페이지 라벨 매핑 함수
def build_page_label_mapping(pdf_path):
    doc = fitz.open(pdf_path)
    page_labels = doc.get_page_labels()  # 페이지 라벨 가져오기
    label_to_page_num = {}
    for page_num, label in enumerate(page_labels):
        actual_label = None
        if label:
            if isinstance(label, dict):
                # 딕셔너리에서 'label' 키의 값을 가져옴
                actual_label = label.get('label')
            elif isinstance(label, str):
                actual_label = label
            else:
                # 예상치 못한 타입의 라벨 처리
                actual_label = str(label)
        else:
            # 라벨이 없을 경우 물리적 페이지 번호를 문자열로 사용
            actual_label = str(page_num + 1)

        # 실제 라벨을 딕셔너리의 키로 사용
        if actual_label:
            label_to_page_num[actual_label] = page_num
    return label_to_page_num


# 6. 페이지 이동 및 청킹
def go_to_page(toc_info, pdf_path):
    """
    목차 정보를 바탕으로 각 페이지로 이동하여 해당 페이지의 텍스트를 청킹
    여러 목차 항목을 하나의 청크 배열로 묶어서 반환
    """
    doc = fitz.open(pdf_path)
    all_chunks = []  # 최종 청크를 담을 리스트 (배열)

    # 논리적 페이지 번호와 물리적 페이지 번호를 매핑
    label_to_page_num = build_page_label_mapping(pdf_path)

    for toc_entry in toc_info:
        title = toc_entry["title"]
        logical_page_num = toc_entry["page_num"]  # 논리적 페이지 번호 (예: '1-1' 또는 '5')

        # 논리적 페이지 번호를 물리적 페이지 번호로 변환
        page_num = label_to_page_num.get(logical_page_num)
        if page_num is None:
            # 페이지 라벨 매핑에서 찾을 수 없을 경우 논리적 페이지 번호를 정수로 변환하여 사용
            try:
                page_num = int(logical_page_num.split('-')[0]) - 1  # 인덱스 보정
            except ValueError:
                print(f"Logical page number '{logical_page_num}' not found in page labels.", file=sys.stderr)
                continue  # 해당 페이지를 찾을 수 없으면 건너뜀

            # 페이지 번호가 범위를 벗어나는지 확인
            if page_num < 0 or page_num >= doc.page_count:
                print(f"Page number {page_num + 1} is out of range.", file=sys.stderr)
                continue

        # 해당 페이지에서 텍스트 청킹
        chunks = extract_chunks_from_page(pdf_path, page_num)
        all_chunks.append({
            "title": title,
            "page_num": logical_page_num,  # 논리적 페이지 번호 사용
            "chunks": chunks
        })

    return all_chunks  # 최종적으로 배열로 반환

# 7. 페이지에서 텍스트 청킹
def extract_chunks_from_page(pdf_path, page_num, chunk_size=512):
    """
    지정된 페이지에서 텍스트를 청킹하는 함수
    문장 단위로 텍스트를 분리하여 반환
    """
    doc = fitz.open(pdf_path)
    page = doc.load_page(page_num)
    text = page.get_text("text")

    # 줄바꿈 문자를 공백으로 치환
    text = text.replace("\n", " ")

    # 문장 단위로 텍스트를 분리
    sentences = re.split(r'(?<=[.!?])\s+', text)  # 문장 분리

    chunks = []
    current_chunk = ""

    # 문장들을 묶어서 청크로 나누기
    for sentence in sentences:
        if len(current_chunk) + len(sentence) <= chunk_size:
            current_chunk += sentence + " "
        else:
            chunks.append(current_chunk.strip())  # 청크로 추가
            current_chunk = sentence + " "  # 새로운 청크 시작

    if current_chunk:  # 마지막 남은 청크가 있으면 추가
        chunks.append(current_chunk.strip())

    return chunks

# 8. 메인 함수 - 헤더 기반 청킹 작업 수행
def main():
    pdf_path = sys.argv[1]  # PDF 파일 경로

    # 목차 추출 및 레벨 구분
    toc_info = extract_toc_levels(pdf_path)

    if not toc_info:
        print(json.dumps({"error": "목차를 찾을 수 없습니다."}), file=sys.stderr)
        return

    # 각 타이틀에 대해 페이지로 이동하여 텍스트 청킹
    chunks = go_to_page(toc_info, pdf_path)

    # 청킹된 결과를 JSON으로 출력
    print(json.dumps(chunks, ensure_ascii=False))

if __name__ == '__main__':
    main()
