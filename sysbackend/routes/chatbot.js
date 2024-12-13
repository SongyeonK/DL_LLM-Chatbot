const express = require('express');
const router = express.Router();
const oracledb = require('oracledb');
const CircularJSON = require('circular-json');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const dbConfig = require('../dbconfig_chat.js');
const { deleteRemoteFile, convertCLOBtoString } = require('../utils/utils');


// 채팅 메시지 저장 API
router.post('/saveChat', async (req, res) => {
  const { chat_id, user_id, content, role } = req.body;
  if (!chat_id) {
    return res.status(400).send({ error: 'chat_id is required' });
  }

  let conn;
  try {
    conn = await oracledb.getConnection(dbConfig);
    await conn.execute(
      `INSERT INTO aivs_chat_messages (chat_id, user_id, content, role) VALUES (:chat_id, :user_id, :content, :role)`,
      { chat_id, user_id, content, role },
      { autoCommit: true }
    );
    res.status(200).send({ message: 'Message saved successfully' });
  } catch (err) {
    console.error('Error saving message:', err);
    res.status(500).send({ error: 'Failed to save message' });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// 채팅 이력 저장 API
router.post('/saveHistory', async (req, res) => {
  const { chat_room_id, title } = req.body;
  let conn;

  try {
    conn = await oracledb.getConnection(dbConfig);
    const result = await conn.execute(
      `INSERT INTO aivs_chat_histories (chat_room_id, title) VALUES (:chat_room_id, :title) RETURNING chat_id INTO :chat_id`,
      {
        chat_room_id,
        title,
        chat_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );
    const chat_id = result.outBinds.chat_id[0];

    // for (const message of messages) {
    //   await conn.execute(
    //     `INSERT INTO aivs_chat_messages (chat_id, user_id, content, role) VALUES (:chat_id, :user_id, :content, :role)`,
    //     { chat_id, user_id: message.user_id, content: message.content, role: message.role },
    //     { autoCommit: true }
    //   );
    // }
    res.status(200).send({ message: 'Chat history saved successfully', chat_id, chat_room_id });
  } catch (err) {
    console.error('Error saving chat history:', err);
    res.status(500).send({ error: 'Failed to save chat history' });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// 채팅 이력 제목 업데이트 API
router.post('/updateHistoryTitle', async (req, res) => {
  const { chat_id, title } = req.body;
  let conn;

  try {
    conn = await oracledb.getConnection(dbConfig);
    // console.log(title);
    await conn.execute(
      `UPDATE aivs_chat_histories SET title = :title WHERE chat_id = :chat_id`,
      { title, chat_id },
      { autoCommit: true }
    );
    res.status(200).send({ message: 'Chat history title updated successfully' });
  } catch (err) {
    console.error('Error updating chat history title:', err);
    res.status(500).send({ error: 'Failed to update chat history title' });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// 선택된 채팅방에 해당하는 채팅 메시지 불러오기 API
router.get('/loadChat', async (req, res) => {
  const { chat_room_id } = req.query;
  console.log('Requested chat_room_id:', chat_room_id);

  if (!chat_room_id) {
    return res.status(400).send({ error: 'chat_room_id is required' });
  }
  let conn;

  try {
    conn = await oracledb.getConnection(dbConfig);
    const result = await conn.execute(
      `SELECT m.* FROM aivs_chat_messages m JOIN aivs_chat_histories h ON m.chat_id = h.chat_id WHERE h.chat_room_id = :chat_room_id ORDER BY m.timestamp`,
      { chat_room_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const rows = result.rows;
    for (let i = 0; i < rows.length; i++) {
      for (const column in rows[i]) {
        if (rows[i][column] && rows[i][column].constructor.name === 'Lob') {
          rows[i][column] = await convertCLOBtoString(rows[i][column]);
        }
      }
    }
    res.status(200).send(CircularJSON.stringify(rows));
  } catch (err) {
    console.error('Error loading messages:', err);
    res.status(500).send({ error: 'Failed to load messages' });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// 채팅 방(이력) 목록 불러오기 API
router.get('/loadHistories', async (req, res) => {
  let conn;
  
  try {
    conn = await oracledb.getConnection(dbConfig);
    const result = await conn.execute(
      `SELECT chat_id, chat_room_id, title FROM aivs_chat_histories WHERE title IS NOT NULL ORDER BY timestamp DESC`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    // console.log('Load histories result:', result.rows);
    res.status(200).send(result.rows);
  } catch (err) {
    console.error('Error loading chat histories:', err);
    res.status(500).send({ error: 'Failed to load chat histories' });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// 채팅 데이터 내용 및 채팅방 삭제 API (네비게이션 메뉴에서 호출)
router.delete('/deleteChat', async (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res.status(400).send({ error: 'title is required' });
  }

  let conn;
  try {
    conn = await oracledb.getConnection(dbConfig);

    // aivs_chat_messages 테이블에서 title에 해당하는 데이터 삭제
    await conn.execute(
      `DELETE FROM aivs_chat_messages WHERE chat_id IN (SELECT chat_id FROM aivs_chat_histories WHERE title = :title)`,
      { title },
      { autoCommit: false }
    );

    // aivs_chat_histories 테이블에서 title에 해당하는 데이터 삭제
    await conn.execute(
      `DELETE FROM aivs_chat_histories WHERE title = :title`,
      { title },
      { autoCommit: false }
    );

    // 모든 작업이 성공하면 커밋
    await conn.commit();
    res.status(200).send({ message: 'Chat data deleted successfully' });
  } catch (err) {
    console.error('Error deleting chat data:', err);
    try {
      // 오류 발생 시 롤백
      await conn.rollback();
    } catch (rollbackErr) {
      console.error('Error rolling back transaction:', rollbackErr);
    }
    res.status(500).send({ error: 'Failed to delete chat data' });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// 채팅 데이터 내용 및 채팅방 삭제 API (저장되지 않은 채팅방 메시지 삭제)
router.delete('/deleteNullChat', async (req, res) => {
  let conn;
  try {
    conn = await oracledb.getConnection(dbConfig);

    // aivs_chat_messages 테이블에서 chat_id에 해당하는 데이터 삭제
    await conn.execute(
      `DELETE FROM aivs_chat_messages WHERE chat_id IN ( SELECT chat_id FROM aivs_chat_histories WHERE title IS NULL)`
    );

    // aivs_chat_histories 테이블에서 chat_room_id에 해당하는 데이터 삭제
    await conn.execute(
      `DELETE FROM aivs_chat_histories WHERE title IS NULL`
    );

    // 모든 작업이 성공하면 커밋
    await conn.commit();
    res.status(200).send({ message: 'Null Chat room and messages deleted successfully' });
  } catch (err) {
    console.error('Error deleting Null chat room and messages:', err);
    try {
      // 오류 발생 시 롤백
      await conn.rollback();
    } catch (rollbackErr) {
      console.error('Error rolling back transaction:', rollbackErr);
    }
    res.status(500).send({ error: 'Failed to Null delete chat room and messages' });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// AI Vertor Search 일반 유사도 검색 API
router.post('/vsearch', async (req, res) => {
  const { file_name, embedding_model, question, top_row } = req.body;
  if (!file_name || !embedding_model || !question || !top_row) {
    return res.status(400).send({ error: 'file_name, embedding_model, question and top_row are required' });
  }

  const vectorSearchSql = `
    SELECT embed_data
    FROM (
      SELECT embed_data 
      FROM aivs_documents a, aivs_docvectors b
      WHERE a.doc_filename = :1 
      AND a.doc_id = b.doc_id
      ORDER BY vector_distance(embed_vector, vector_embedding(:embedding_model USING :3 AS data), COSINE)
      FETCH FIRST :4 ROWS ONLY
    )
  `;

  let conn;
  try {
    conn = await oracledb.getConnection(dbConfig);

    const modifiedSql = vectorSearchSql.replace(':embedding_model', embedding_model);
    const result = await conn.execute(
      modifiedSql, 
      [file_name, question, top_row],
      { fetchInfo: { "EMBED_DATA": { type: oracledb.STRING }} }
    );

    res.status(200).send(result.rows);
  } catch (err) {
    console.error('Error performing vector search:', err);
    res.status(500).send({ error: 'Failed to perform vector search' });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// AI Vertor Search 멀티벡터 유사도 검색 API
router.post('/mvsearch', async (req, res) => {
  const { file_name, embedding_model, question, top_row } = req.body;
  if (!file_name || !embedding_model || !question || !top_row) {
    return res.status(400).send({ error: 'file_name, embedding_model, question and top_row are required' });
  }
  let getCountSql = '';
  let multivectorSearchSql ='';

  // 파일 확장자가 .pdf, .ppt, .pptx로 끝나지 않는 경우 (문서검색, SQL검수 등의 경우 폴더명 등이 file_name 파라미터 값으로 들어옴)
  // 문서검색, 파일정리를 위한 임베딩 작업 시, 폴더명 또는 '파일리스트'가 aivs_documents의 doc_class에 저장됨
  const isGeneralSearch = !file_name.endsWith('.pdf') && !file_name.endsWith('.ppt') && !file_name.endsWith('.pptx');
  
  
  if (isGeneralSearch) {
    getCountSql = `SELECT COUNT(*) FROM aivs_documents WHERE doc_class = :1`;
    multivectorSearchSql = `
      SELECT doc_filepath, embed_data
      FROM (
        SELECT a.doc_id, a.doc_filepath, b.chunk_id, b.embed_data
        FROM aivs_documents a, aivs_docvectors b
        WHERE a.doc_class = :1
        AND a.doc_id = b.doc_id
        ORDER BY vector_distance(embed_vector, vector_embedding(:embedding_model USING :3 AS data), COSINE)
        FETCH FIRST :4 PARTITIONS BY doc_id, :5 ROWS ONLY
      )
    `;
  } else {
    getCountSql = `
      SELECT COUNT(*) FROM aivs_documents
      WHERE doc_class = (SELECT doc_class FROM aivs_documents WHERE doc_filename = :1)
    `;
    multivectorSearchSql = `
      SELECT embed_data
      FROM (
        SELECT a.doc_id, b.chunk_id, b.embed_data
        FROM aivs_documents a, aivs_docvectors b
        WHERE a.doc_class = (
            SELECT doc_class 
            FROM aivs_documents 
            WHERE doc_filename = :1
        ) 
        AND a.doc_id = b.doc_id
        ORDER BY vector_distance(embed_vector, vector_embedding(:embedding_model USING :3 AS data), COSINE)
        FETCH FIRST :4 PARTITIONS BY doc_id, :5 ROWS ONLY
      )
    `;
  }

  let conn;
  try {
    conn = await oracledb.getConnection(dbConfig);

    // 먼저 doc_class를 동일하게 갖는 PDF 파일의 개수를 구함
    let countResult = '';
    let pdfCount = '';
    let result = '';

    const modifiedSql = multivectorSearchSql.replace(':embedding_model', embedding_model);
    // modifiedSql 쿼리를 실행
    countResult = await conn.execute(getCountSql, [file_name]);
    pdfCount = countResult.rows[0][0];
    // console.log('modifiedSql : ', modifiedSql, file_name, question, pdfCount, top_row);

    result = await conn.execute(
      modifiedSql, 
      [file_name, question, pdfCount, top_row],
      { fetchInfo: { "EMBED_DATA": { type: oracledb.STRING }} }
    );
    res.status(200).send(result.rows);
  } catch (err) {
    console.error('Error performing multi vector search:', err);
    res.status(500).send({ error: 'Failed to perform multi vector search' });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// AI Vertor Search 멀티벡터 유사도 검색 API
router.post('/mvsearchSummary', async (req, res) => {
  const { file_name, embedding_model, question, top_row } = req.body;
  if (!file_name || !embedding_model || !question || !top_row) {
    return res.status(400).send({ error: 'file_name, embedding_model, question and top_row are required' });
  }
  let getCountSql = '';
  let multivectorSearchSql ='';

  getCountSql = `
    SELECT COUNT(*) FROM aivs_documents
    WHERE doc_class = :1
  `;
  multivectorSearchSql = `
    SELECT doc_filepath, 
      dbms_vector_chain.utl_to_summary(
          embed_data, 
          json('{"provider":"database","glevel":"SENTENCE","numParagraphs":"1","maxPercent":"10","num_themes":"5","language":"korean"}')
      ) as embed_data
    FROM (
      SELECT a.doc_id, a.doc_filepath, b.chunk_id, b.embed_data
      FROM aivs_documents a, aivs_docvectors b
      WHERE a.doc_class = :1
      AND a.doc_id = b.doc_id
      ORDER BY vector_distance(embed_vector, vector_embedding(:embedding_model USING :3 AS data), COSINE)
      FETCH FIRST :4 PARTITIONS BY doc_id, :5 ROWS ONLY
    )
  `;

  let conn;
  try {
    conn = await oracledb.getConnection(dbConfig);

    // 먼저 doc_class를 동일하게 갖는 PDF 파일의 개수를 구함
    let countResult = '';
    let pdfCount = '';
    let result = '';

    const modifiedSql = multivectorSearchSql.replace(':embedding_model', embedding_model);

    // modifiedSql 쿼리를 실행
    countResult = await conn.execute(getCountSql, [file_name]);
    pdfCount = countResult.rows[0][0];

    result = await conn.execute(modifiedSql, [file_name, question, pdfCount, top_row]);
    const rows = result.rows;
    for (let i = 0; i < rows.length; i++) {
      for (const column in rows[i]) {
        if (rows[i][column] && rows[i][column].constructor.name === 'Lob') {
          rows[i][column] = await convertCLOBtoString(rows[i][column]);
        }
      }
    }
    res.status(200).send(CircularJSON.stringify(rows));
  } catch (err) {
    console.error('Error performing multi vector search:', err);
    res.status(500).send({ error: 'Failed to perform multi vector search' });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// 챗봇 목록과 관련 문서파일명을 불러오는 API
router.get('/loadBots', async (req, res) => {
  let conn;

  try {
    conn = await oracledb.getConnection(dbConfig);

    const result = await conn.execute(
      `SELECT b.bot_id, b.bot_name, b.doc_id, d.doc_filename, b.cont_id, b.biz_bot_YN, b.create_date
       FROM aivs_chatbots b LEFT JOIN aivs_documents d ON b.doc_id = d.doc_id ORDER BY b.bot_name`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.status(200).send(result.rows);
  } catch (err) {
    console.error('Error loading bots:', err);
    res.status(500).send({ error: 'Failed to load bots' });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

// 챗봇을 DB에서 삭제하는 API
router.delete('/deleteBot', async (req, res) => {
  const { bot_name } = req.body;

  if (!bot_name) {
    return res.status(400).send({ error: 'bot_name is required' });
  }

  let conn;
  try {
    conn = await oracledb.getConnection(dbConfig);

    // aivs_chatbots 테이블에서 bot_name에 해당하는 데이터 삭제
    await conn.execute(
      `DELETE FROM aivs_chatbots WHERE bot_name = :bot_name`,
      { bot_name },
      { autoCommit: true }
    );

    res.status(200).send({ message: 'Chatbot data deleted successfully' });
  } catch (err) {
    console.error('Error deleting chatbot data:', err);
    res.status(500).send({ error: 'Failed to delete chatbot data' });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

module.exports = router;
