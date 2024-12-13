import sys
import json
import oracledb

def embed_documents(file_name, doc_name, doc_class, file_path, chunks):
  """
  주어진 텍스트 청크를 오라클 데이터베이스에 임베딩 벡터로 저장하는 함수
  (VECTOR_ARRAY_T 타입을 사용하여 처리)
  Args:
    texts: 텍스트 청크 리스트
    file_name: 파일 이름(확장자 포함)
    doc_name: 도큐먼트 이름(확장자 없음)
    doc_class: 문서 종류
    file_path: 문서 경로
  Returns:
    성공 메시지 또는 에러 메시지를 포함한 JSON 데이터
  """
  try:
    # 오라클 데이터베이스 연결 설정
    conn = oracledb.connect(user="docchat", password="docchat", dsn="PDB1")
    cursor = conn.cursor()

    # # file_path가 있는 경우 폴더명을 추출하여 doc_directory로 사용
    # if file_path:
    #   split_path = file_path.split('/')
    #   if len(split_path) > 0:
    #     doc_directory = split_path[0]
    #   else:
    #     return json.dumps({"error": "file_path split resulted in empty list"})
    # else:
    #   doc_directory = doc_class

    # `aivs_documents` 테이블에 문서를 삽입
    try:
      cursor.execute(
        """
        INSERT INTO aivs_documents (doc_name, doc_filename, doc_class, make_date, doc_filepath)
        VALUES (:doc_name, :file_name, :doc_class, SYSDATE, :file_path)
        """,
        doc_name=doc_name,
        file_name=file_name,
        doc_class=doc_class,
        file_path=file_path
      )
    except Exception as ex:
      return json.dumps({"error": f"Error inserting document: {str(ex)}"})

    # 청크 데이터를 VECTOR_ARRAY_T 타입 객체에 추가
    # max_chunk_length = 2302
    objects = []
    try:
      for i, chunk in enumerate(chunks, start=1):
        # # 청크 길이 제한
        # if len(chunk) > max_chunk_length:
        #   chunk = chunk[:max_chunk_length]
        object = {"chunk_id": i, "chunk_data": chunk}
        objects.append(json.dumps(object))
        # print(f"objects : {objects}")
    except Exception as ex:
      return json.dumps({"error": f"Error adding chunks to VECTOR_ARRAY_T object: {str(ex)}"})

    # VECTOR_ARRAY_T 타입 데이터 생성
    vector_array_type = conn.gettype("SYS.VECTOR_ARRAY_T")
    inputs = vector_array_type.newobject(objects)

    # aivs_docvectors 테이블에 임베딩 결과를 삽입하는 SQL 쿼리
    try:

      cursor.setinputsizes(content=oracledb.CLOB)
      
      cursor.execute(
        """
        INSERT INTO aivs_docvectors
        SELECT dt.doc_id, COALESCE(et.chunk_id, ROW_NUMBER() OVER (ORDER BY NULL)) AS chunk_id, 
          et.embed_data, to_vector(et.embed_vector) embed_vector
        FROM (
        SELECT doc_id, bfilename('CTX_WORK_DIR', doc_filename) AS doc_data 
        FROM aivs_documents 
        WHERE doc_filename = :file_name
        ) dt,
        dbms_vector_chain.utl_to_embeddings(:content, json(:params)) t,
        json_table(t.column_value, '$' 
          columns (chunk_id number, embed_data CLOB, embed_vector CLOB)
        ) et
        """,
        file_name=file_name,
        content=inputs,  # VECTOR_ARRAY_T 타입 객체를 SQL 쿼리에 전달
        params=json.dumps({"provider": "database", "model": "st_all_minilm_l6_v2"})
      )
    except Exception as ex:
      return json.dumps({"error": f"Error executing UTL_TO_EMBEDDINGS: {str(ex)}"})

    # 변경사항 커밋
    conn.commit()
    return json.dumps({"message": "Embedding process completed successfully"})
  except Exception as ex:
    return json.dumps({"error": f"An unexpected exception occurred: {str(ex)}"})
  finally:
    if cursor is not None and cursor.connection is not None:
      cursor.close()
    if conn is not None:
      conn.close()

if __name__ == "__main__":
  try:
    # print("Received arguments:", sys.argv)  # 인수 출력
    file_name = sys.argv[1]
    doc_name = sys.argv[2]  # Node.js에서 전달된 문서 이름
    doc_class = sys.argv[3] 
    file_path = sys.argv[4] 
    texts = json.loads(sys.argv[5])

    result = embed_documents(file_name, doc_name, doc_class, file_path, texts)
    print(result)
  except Exception as e:
    print(json.dumps({"error": str(e)}))
