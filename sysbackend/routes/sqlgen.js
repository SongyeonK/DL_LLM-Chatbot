const express = require('express');
const router = express.Router();
const oracledb = require('oracledb');
const CircularJSON = require('circular-json');
const dbConfig = require('../dbconfig_chat.js');
const { convertCLOBtoString } = require('../utils/utils');


// SQL Gen에 사용할 DB스키마 정보 불러오기 API
router.get('/loadSchemas', async (req, res) => {
  let conn;
  
  try {
    conn = await oracledb.getConnection(dbConfig);
    const result = await conn.execute(
      `SELECT username FROM all_users WHERE oracle_maintained = 'N' AND username in ('CO', 'HR', 'SH', 'DOCCHAT', 'MHMC') ORDER BY username`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.status(200).send(result.rows);
  } catch (err) {
    console.error('Error loading schemas:', err);
    res.status(500).send({ error: 'Failed to load schemas' });
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

router.get('/schemaTables', async (req, res) => {
  const schema = req.query.schema;
  let conn;

  try {
    conn = await oracledb.getConnection(dbConfig);
    const result = await conn.execute(
      `SELECT table_name FROM all_tables 
       WHERE owner = :owner 
       AND table_name not like '%MV' 
       AND table_name not like '%IDX%' 
       AND table_name not like 'DM$%' 
       AND table_name not like 'DOC_%' 
       AND table_name not like 'LOGON%'
       ORDER BY table_name`,
      [schema],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const tables = result.rows.map(row => row.TABLE_NAME);
    res.status(200).send(tables);
  } catch (err) {
    console.error('Error loading tables:', err);
    res.status(500).send({ error: 'Failed to load tables' });
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

router.post('/setProfile', async (req, res) => {
  const { schema } = req.body;
  let conn;

  try {
    conn = await oracledb.getConnection(dbConfig);

    // 선택한 스키마의 테이블 목록 조회
    const tablesResult = await conn.execute(
      `SELECT table_name FROM all_tables 
       WHERE owner = :owner 
       AND table_name not like '%MV' 
       AND table_name not like '%IDX%' 
       AND table_name not like 'DM$%' 
       AND table_name not like 'DOC_%' 
       AND table_name not like 'LOGON%'`,
      [schema],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const tables = tablesResult.rows.map(row => ({ owner: schema, name: row.TABLE_NAME }));
    // console.log('Tables :', tables);

    // 프로필 데이터 생성
    const profileName = `${schema}사용자`;
    const objectList = JSON.stringify({ object_list: tables });

    // 프로필 중복 확인
    const checkProfile = await conn.execute(
      `SELECT COUNT(*) AS count FROM conf_ai_profile WHERE profile_name = :profile_name`,
      [profileName],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (checkProfile.rows[0].COUNT > 0) {
      res.status(200).send({ message: 'Profile already exists' });
      return;
    }

    // 프로필 삽입 (JSON 데이터 타입으로 삽입)
    await conn.execute(
      `INSERT INTO conf_ai_profile (profile_name, object_list) VALUES (:profile_name, :object_list)`,
      { profile_name: profileName, object_list: objectList },
      { autoCommit: true }
    );

    res.status(200).send({ message: 'Profile saved successfully' });
  } catch (err) {
    console.error('Error saving profile:', err);
    res.status(500).send({ error: 'Failed to save profile' });
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

router.get('/getTableInfo', async (req, res) => {
  const profile = req.query.profile + '사용자';
  let conn;

  try {
    conn = await oracledb.getConnection(dbConfig);
    const result = await conn.execute(
      `select to_clob(json_arrayagg(
              json_object(a.table_name, c.comments,
              'columns' is (
                select json_arrayagg(
                      json_object( a.owner, b.column_name, b.data_type, d.comments)
                      returning CLOB
                      )
                  from dba_tab_cols b, dba_col_comments d
                    where a.owner = b.owner
                      and  a.table_name = b.table_name 
                      and b.owner = d.owner
                      and b.table_name = d.table_name
                      and b.column_name = d.column_name
                      and b.hidden_column = 'NO'
                  ) returning CLOB
            ) returning CLOB))
      from dba_tables a, dba_tab_comments c 
      where (a.owner, a.table_name) in ( select t.owner, t.name from conf_ai_profile a 
          CROSS JOIN JSON_TABLE(
              a.object_list, 
              '$.object_list[*]' COLUMNS (
                  owner VARCHAR2(4000) PATH '$.owner',
                  name VARCHAR2(4000) PATH '$.name'
              )
      ) t
      where profile_name = :profile)
      and a.owner = c.owner
      and a.table_name = c.table_name`,
      [profile],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length > 0) {
      const lobKey = Object.keys(result.rows[0])[0];
      const lob = result.rows[0][lobKey];

      if (lob instanceof oracledb.Lob) {
        let jsonString = '';

        lob.setEncoding('utf8');  // Set the encoding so we get a string

        lob.on('data', chunk => {
          jsonString += chunk;
        });

        lob.on('end', async () => {
          // console.log('resultString : ', jsonString);
          res.status(200).send(jsonString);
          // 여기에서 연결을 닫습니다.
          try {
            await conn.close();
          } catch (err) {
            console.error('Error closing connection:', err);
          }
        });

        lob.on('error', async err => {
          console.error('Error reading LOB:', err);
          res.status(500).send({ error: 'Failed to fetch table info' });
          // 여기에서 연결을 닫습니다.
          try {
            await conn.close();
          } catch (err) {
            console.error('Error closing connection:', err);
          }
        });
      } else {
        res.status(404).send({ error: 'No data found' });
        // 여기에서 연결을 닫습니다.
        try {
          await conn.close();
        } catch (err) {
          console.error('Error closing connection:', err);
        }
      }
    } else {
      res.status(404).send({ error: 'No data found' });
      // 여기에서 연결을 닫습니다.
      try {
        await conn.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  } catch (err) {
    console.error('Error fetching table info:', err);
    res.status(500).send({ error: 'Failed to fetch table info' });
    // 여기에서 연결을 닫습니다.
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

router.get('/getConstInfo', async (req, res) => {
  const profile = req.query.profile + '사용자';
  let conn;

  try {
    conn = await oracledb.getConnection(dbConfig);
    const result = await conn.execute(
      `select json_arrayagg(
                json_object( 'key' is decode(a.constraint_type,'P','Primary keys : ','R','Foreign keys : '), 'column_list' is json_arrayagg(
                (b.owner||'.'||b.table_name||'.'||b.column_name)||
                (case when a.r_constraint_name is not null then '->'||(select d.owner||'.'||d.table_name||'.'||d.column_name from dba_constraints  c,  dba_cons_columns d
                 where a.r_owner = c.owner and a.r_constraint_name = c.constraint_name
                 and c.constraint_name = d.constraint_name
                 and c.owner = d.owner) else '' end))))
      from dba_constraints a , dba_cons_columns b
      where 1=1
      and   a.constraint_type IN ('P', 'R') 
      and  (a.owner, a.table_name) in (select t.owner, t.name from conf_ai_profile a 
          CROSS JOIN JSON_TABLE(
              a.object_list, 
              '$.object_list[*]' COLUMNS (
                  owner VARCHAR2(4000) PATH '$.owner',
                  name VARCHAR2(4000) PATH '$.name'
              )
       ) t
       where profile_name = :profile)
      and a.owner = b.owner and a.constraint_name = b.constraint_name
      group by a.constraint_type`,
      [profile],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const jsonString = result.rows[0][Object.keys(result.rows[0])[0]];
    // console.log('resultString : ', jsonString);
    res.status(200).send(jsonString);
  } catch (err) {
    console.error('Error fetching constraint info:', err);
    res.status(500).send({ error: 'Failed to fetch constraint info' });
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

// GET sqlQuery result
router.get('/execSqlQuery', async (req, res, next) => {
  let conn;
  try {
    // 주석구문 제거
    const sqlQuery = req.query['sql'].replace(/(\/\*[\s\S]*?\*\/)|(--[^\r\n]*)/g, "").trim();
    // 주석 제거 후 남은 SQL 쿼리가 비어있다면 종료
    if (!sqlQuery.trim()) {  // trim()으로 공백 및 줄바꿈 문자 제거 후 체크
      console.log('SQL Query is empty after removing comments.');
      return res.status(200).send({ message: "No valid SQL query found." });  // 200 OK with a message
    }
    // console.log('SQL Query:', sqlQuery); // SQL 쿼리 로깅

    conn = await oracledb.getConnection(dbConfig);

    let binds = {};
    const options = {
      outFormat: oracledb.OUT_FORMAT_OBJECT   // query result format
    };

    // Select 인지 DML인지 확인
    const firstWord = sqlQuery.split(' ')[0].toUpperCase();
    if (firstWord.trim() === 'SELECT') {
      let result = await conn.execute(sqlQuery, binds, options);
      
      // CLOB 처리
      const rows = result.rows;
      for (let i = 0; i < rows.length; i++) {
        for (const column in rows[i]) {
          if (rows[i][column] && rows[i][column].constructor.name === 'Lob') {
            rows[i][column] = await convertCLOBtoString(rows[i][column]);
          }
        }
      }

      res.send(CircularJSON.stringify(rows));
    } else {
      let result = await conn.execute(sqlQuery, binds, options);
      console.log('Result : ' + result.rowsAffected);
      if (result.rowsAffected > 0) {
        await conn.commit(); // DML 수행 후 commit 수행
        res.status(200).send([{ AffectedRows: result.rowsAffected, Message: 'Success' }]);
        console.log("Update/Delete/Insert query success");
      } else {
        await conn.rollback(); // DML 수행 후 rollback 수행
        res.status(200).send([{ AffectedRows: result.rowsAffected, Message: 'Fail' }]);
        console.log("Update/Delete/Insert failed or did not affect any row");
      }
    }
  } catch (error) {
    console.error('Error during SQL query execution:', error);
    // 에러 메시지를 클라이언트에 전달
    res.status(500).send({ message: error.message, stack: error.stack });
  } finally {
    if (conn) {
      try {
        await conn.close();
        // console.log('Connection closed'); // 연결 종료 로깅
      } catch (error) {
        console.error('Error closing the connection:', error);
      }
    }
  }
});


module.exports = router;
