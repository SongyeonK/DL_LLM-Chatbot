const express = require('express');
const router = express.Router();
const oracledb = require('oracledb');
const dbConfig = require('../dbconfig_chat.js');
const path = require('path');
const { spawn } = require('child_process');
const CircularJSON = require('circular-json');
const { uploadFileToDBServer, convertCLOBtoString } = require('../utils/utils');


// (봇과 연결된) 특정 사용자 정보 조회 API 
router.get('/selectUserInfo', async (req, res) => {
  const { bot_name } = req.query;
  if (!bot_name) {
    return res.status(400).send({ error: 'bot_name is required' });
  }

  let conn;
  try {
    conn = await oracledb.getConnection(dbConfig);

    // 사용자 정보 조회 쿼리
    const userInfoQuery = `
      SELECT c.*, r.*
      FROM aivs_chatbots a
      LEFT JOIN aivs_continfo b ON a.cont_id = b.cont_id
      LEFT JOIN aivs_userinfo c ON b.user_id = c.user_id
      LEFT JOIN aivs_user_risk_profile r ON c.user_id = r.user_id
      WHERE a.bot_name = :bot_name
    `;

    const userInfoResult = await conn.execute(
      userInfoQuery,
      { bot_name },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const userInfo = userInfoResult.rows;

    // 사용자 정보만 반환
    res.status(200).send(userInfo);
  } catch (err) {
    console.error('Error loading user info:', err);
    res.status(500).send({ error: 'Failed to load user info' });
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

// 브라우저에 보여주기 위한 PDF 파일명을 가져옴
router.get('/getPdfFile', async (req, res) => {
  let conn;
  const { docClass } = req.query; // 요청 쿼리에서 docName을 가져옴

  try {
    conn = await oracledb.getConnection(dbConfig);

    // doc_name을 기준으로 doc_filepath를 가져옴
    const result = await conn.execute(
      `SELECT doc_filename FROM aivs_documents WHERE doc_class = :docClass`,
      { docClass },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(404).send({ error: 'Document not found' });
    }
    res.status(200).send(result.rows);
  } catch (err) {
    console.error('Error fetching PDF file:', err);
    res.status(500).send({ error: 'Failed to load PDF file' });
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

// 이력 데이터 저장 API
router.post('/saveReview', async (req, res) => {
  const { document_id, type, user_id, content } = req.body;

  let conn;
  try {
    conn = await oracledb.getConnection(dbConfig);
    await conn.execute(
      `INSERT INTO AIVS_REVIEW_HISTORIES (document_id, type, user_id, content) 
       VALUES (:document_id, :type, :user_id, :content)`,
      { document_id, type, user_id, content },
      { autoCommit: true }
    );
    res.status(200).send({ message: 'Review saved successfully' });
  } catch (err) {
    console.error('Error saving review:', err);
    res.status(500).send({ error: 'Failed to save review' });
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

// SQL 검수이력 내역 조회 API
router.get('/loadSQLReviewHistories', async (req, res) => {
  let conn;
  const { reviewType } = req.query;

  try {
    conn = await oracledb.getConnection(dbConfig);

    // 기본 쿼리 구성
    let query = `SELECT content FROM AIVS_REVIEW_HISTORIES WHERE type = :reviewType`;

    // 쿼리에 사용될 파라미터 설정
    const params = { reviewType };

    // 쿼리 실행
    const result = await conn.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    // CLOB 처리
    const rows = result.rows;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].CONTENT && rows[i].CONTENT.constructor.name === 'Lob') {
        rows[i].CONTENT = await convertCLOBtoString(rows[i].CONTENT);
      }
      // // JSON 문자열을 다시 객체로 파싱
      // try {
      //   rows[i].CONTENT = JSON.parse(rows[i].CONTENT);
      // } catch (error) {
      //   console.error('Error parsing JSON content:', error);
      //   res.status(500).send({ error: 'Failed to parse JSON content' });
      //   return;
      // }
    }

    // JSON으로 변환된 데이터를 응답
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error loading histories:', err);
    res.status(500).send({ error: 'Failed to load histories' });
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

// LLM 설정 정보 불러오기 API
router.get('/getLLMConfig', async (req, res) => {
  let conn;
  try {
    conn = await oracledb.getConnection(dbConfig);
    const modelsResult = await conn.execute(
      `SELECT model_id, model_name, description, default_model_YN FROM conf_llm_models`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    const optionsResult = await conn.execute(
      `SELECT option_id, model_id, option_name, option_value FROM conf_llm_options`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    const data = {
      models: modelsResult.rows,
      options: optionsResult.rows
    };
    
    res.status(200).send(data);
  } catch (err) {
    console.error('Error loading LLM config:', err);
    res.status(500).send({ error: 'Failed to load LLM config' });
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

// LLM 모델 정보 업데이트 API
router.post('/updateLLMModel', async (req, res) => {
  const { model_id } = req.body;
  if (!model_id) {
    return res.status(400).send({ error: 'model_id is required' });
  }

  let conn;
  try {
    conn = await oracledb.getConnection(dbConfig);

    // 다른 모델들의 default_model_YN을 'N'으로 설정
    const resetDefaultSql = `
      UPDATE conf_llm_models
      SET default_model_YN = 'N'
      WHERE default_model_YN = 'Y'
    `;
    await conn.execute(resetDefaultSql);
    await conn.commit();

    // 선택된 모델의 default_model_YN을 'Y'로 업데이트
    const updateModelSql = `
      UPDATE conf_llm_models
      SET default_model_YN = 'Y'
      WHERE model_id = :model_id
    `;
    await conn.execute(updateModelSql, {
      model_id
    });

    await conn.commit();

    res.status(200).send({ message: 'LLM model updated successfully' });
  } catch (err) {
    console.error('Error updating LLM model:', err);
    res.status(500).send({ error: 'Failed to update LLM model' });
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
