const express = require('express');
const router = express.Router();
const oracledb = require('oracledb');
const CircularJSON = require('circular-json');
const dbConfig = require('../dbconfig_chat.js');
const { convertCLOBtoString } = require('../utils/utils');

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


module.exports = router;
