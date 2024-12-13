const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { jsPDF } = require('jspdf');  // jsPDF 사용 가능
const officeParser = require('officeparser');
const PptxGenJS = require('pptxgenjs');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');

const pdfjsLib = require('pdfjs-dist');

const nlp = require('compromise');
// const SFTPClient = require('ssh2-sftp-client');
const iconv = require('iconv-lite'); 
const { spawn } = require('child_process');
const { uploadFileToDBServer, getTextFromPPT } = require('../utils/utils');
require('dotenv').config();

// Set up storage configuration for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.UPLOAD_DIRECTORY)
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

const upload = multer({ storage: storage })

// PDF 텍스트를 문장 단위로 나누는 함수
const splitTextBySentences = (text, maxChunkSize) => {
  const doc = nlp(text);
  const sentences = doc.sentences().out('array');
  let chunks = [];
  let chunk = '';

  for (let sentence of sentences) {
    if ((chunk + sentence).length <= maxChunkSize) {
      chunk += sentence + ' ';
    } else {
      chunks.push(chunk.trim());
      chunk = sentence;
    }
  }

  if (chunk) {
    chunks.push(chunk.trim());
  }

  return chunks;
}

// 텍스트를 문단 단위로 나누는 함수 (문단은 \n\n 으로 정의)
const splitTextByParagraphs = (text, insertPhrase = '') => {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs
    .map(paragraph => (insertPhrase ? '[' + insertPhrase + '] : ' + paragraph.trim() : paragraph.trim()))
    .filter(paragraph => paragraph.length > 0);
};

// 텍스트를 헤더 기반으로 나누는 함수 (Python 스크립트 호출)
const splitTextByHeaders = async (filePath) => {
  return new Promise((resolve, reject) => {
    const pyProcess = spawn('python3', ['scripts/python_header_chunk.py', filePath]);

    let result = '';
    
    // Python 스크립트의 stdout 데이터 출력 (주로 결과 처리용)
    pyProcess.stdout.on('data', (data) => {
      // console.log(`stdout data: ${data.toString()}`);  // Python 스크립트의 출력 데이터 확인
      result += data.toString();
    });

    // Python 스크립트의 stderr 데이터 출력 (주로 디버깅, 로그 용도)
    pyProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data.toString()}`);  // stderr 로그 출력
    });

    pyProcess.on('close', (code) => {
      if (code !== 0) {
        reject(`Python script exited with code ${code}`);
      } else {
        try {
          // console.log(`Final result: ${result}`);  // 결과 확인
          resolve(JSON.parse(result));  // 결과 처리
        } catch (error) {
          reject(`Error parsing JSON: ${error.message}`);
        }
      }
    });
  });
};

// PDF를 페이지 단위로 청킹하고 오버랩을 적용하는 함수
const splitTextByPagesWithOverlap = async (filePath, overlapSize) => {
  const data = await fs.readFile(filePath);
  const loadingTask = pdfjsLib.getDocument({
    data: data,
    disableWorker: true, // 워커 비활성화
  });
  const pdfDocument = await loadingTask.promise;

  const numPages = pdfDocument.numPages;
  const pageTexts = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    const text = strings.join(' ');

    pageTexts.push(text);
  }

  // 페이지별 텍스트 추출 후 오버랩 처리 및 청크 분할 로직
  const result = [];
  const maxChunkLength = 2000; // 최대 청크 길이 설정

  for (let i = 0; i < numPages; i++) {
    let overlapText = '';

    if (i > 0 && overlapSize > 0) {
      const previousText = pageTexts[i - 1];
      const previousSentences = nlp(previousText).sentences().out('array');
      const overlapSentences = previousSentences.slice(-overlapSize).join(' ');
      overlapText += overlapSentences + ' ';
    }

    const currentText = pageTexts[i];
    let chunkText = overlapText + currentText;
    const chunks = []; // 각 페이지의 청크들을 저장할 배열

    // 청크 길이가 최대 길이를 초과하는 경우 분할
    if (chunkText.length <= maxChunkLength) {
      chunks.push(chunkText.trim());
    } else {
      // 청크를 최대 길이 이하로 분할
      let start = 0;
      const chunkLength = chunkText.length;

      let isFirstChunk = true; // 첫 번째 청크 여부를 판단하는 변수

      while (start < chunkLength) {
        let end = start + maxChunkLength;
        if (end > chunkLength) end = chunkLength;

        let subChunk = chunkText.substring(start, end).trim();

        // 첫 번째 청크가 아닌 경우에만 페이지 번호 추가
        if (!isFirstChunk) {
          subChunk = `"page_num": "${i + 1}"\n` + subChunk;
        }

        chunks.push(subChunk);
        start = end;
        isFirstChunk = false; // 첫 번째 청크 이후로는 페이지 번호를 다시 추가하지 않음
      }
    }

    const fileName = filePath.split('/').pop();

    // 페이지 번호와 청크들을 JSON 형태로 저장
    result.push({
      "file": fileName,
      "page_num": `${i + 1}`,
      "chunks": chunks
    });
  }

  return result;
};


// 텍스트를 의미 단위로 나누는 함수 (Python 스크립트 호출)
const splitTextByMeaning = async (text, method) => {
  return new Promise((resolve, reject) => {
    const pyProcess = spawn('python3', ['scripts/python_meaning_chunk.py', method, text]);

    let result = '';
    pyProcess.stdout.on('data', (data) => {
      // console.log(`stdout data: ${data.toString()}`);  // Python 스크립트의 출력 데이터 확인
      result += data.toString();
    });

    pyProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data.toString()}`);  // stderr 로그 출력
    });

    pyProcess.on('close', (code) => {
      if (code !== 0) {
        reject(`Python script exited with code ${code}`);
      } else {
        resolve(JSON.parse(result));
      }
    });
  });
};

const logFilePath = path.join(__dirname, '../public', 'logs', 'log.json');

// Ensure logs directory exists
const ensureLogsDirectoryExists = async () => {
  console.log('logFilePath : ', logFilePath);
  try {
    await fs.mkdir(path.dirname(logFilePath), { recursive: true });
  } catch (error) {
    console.error('Error ensuring logs directory exists:', error);
  }
};

// Append log entry to JSON log file
const appendLogEntry = async (logEntry) => {
  try {
    let logs = [];
    const logFileExists = await fs.stat(logFilePath).catch(() => false);

    if (logFileExists) {
      const logFileContent = await fs.readFile(logFilePath, 'utf8');
      try {
        logs = JSON.parse(logFileContent);
      } catch (parseError) {
        console.error('Error parsing log file content:', parseError);
        // Handle or initialize an empty log file in case of JSON parse error
        logs = [];
      }
    }

    logs.push(logEntry);
    await fs.writeFile(logFilePath, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error appending log entry:', error);
  }
};

// PDF 청킹 엔드포인트
router.post('/apChunking', async (req, res) => {
  const chunkingMethod = req.body['chunking-method'];
  const maxChunkSize = parseInt(req.body['max-chunk-size'], 10);
  const additionalText = req.body['additional-text'];
  const pythonMethod = req.body['python-method'];
  const filePath = req.body['file-path']; // 수정: 파일 경로 인자 추가
  const overlapSize = parseInt(req.body['overlap-size'], 10) || 0; // 오버랩 사이즈 추가

  if (!filePath) {
    res.status(400).send('No file path provided.');
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const pdfData = await pdfParse(data);
    const text = pdfData.text;

    if (!text) {
      console.error("PDF 파일을 읽을 수 없습니다.");
      res.status(500).send("파일 변환 중 에러가 발생했습니다.");
      return;
    }

    let chunks;
    switch (chunkingMethod) {
      case 'Sentence':
        chunks = splitTextBySentences(text, maxChunkSize);
        break;
      case 'Paragraph':    // paragraph 청킹은 card종류별 약관 청킹시 사용, 청킹시 카드이름(additionalText)을 청킹시 삽입
        chunks = splitTextByParagraphs(text, additionalText);
        break;
      case 'Header':
        chunks = await splitTextByHeaders(filePath);
        break;
      case 'Page':
        chunks = await splitTextByPagesWithOverlap(filePath, overlapSize);
        break;
      case 'Meaning':
        chunks = await splitTextByMeaning(text, pythonMethod);
        break;
      default:
        res.status(400).send('Invalid chunking method.');
        return;
    }

    res.status(200).json({ chunks });
  } catch (err) {
    console.error(err.stack);
    res.status(500).send("파일 변환 중 에러가 발생했습니다.");
  } finally {
    // 업로드된 PDF 파일 삭제
    // await fs.unlink(filePath);
  }
});

// 크롤링 및 PDF 생성 엔드포인트
router.post('/webCrawling', async (req, res) => {
  const { url } = req.body;  // 클라이언트에서 URL을 전달받음

  if (!url) {
    return res.status(400).json({ error: 'No URL provided' });
  }

  try {
    // URL에서 페이지 내용 크롤링
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // 페이지의 모든 텍스트를 가져오기
    const pageText = $('body').text();

    // PDF 파일로 저장
    const pdf = new jsPDF();
    const pageHeight = pdf.internal.pageSize.height - 20; // 페이지의 높이 (여백을 제외한)
    let y = 10; // 첫 페이지에서 텍스트 시작 위치 Y좌표
    const lines = pdf.splitTextToSize(pageText, 180);

    lines.forEach(line => {
      if (y + 10 > pageHeight) { // 만약 현재 줄이 페이지 하단에 도달하면
        pdf.addPage(); // 새로운 페이지 추가
        y = 10; // Y 좌표를 다시 초기화 (새 페이지의 첫 줄 위치)
      }
      pdf.text(10, y, line); // 현재 페이지에 텍스트 추가
      y += 10; // 다음 줄로 이동 (줄 높이는 10)
    });

    const pdfFileName = `crawled_page_${Date.now()}.pdf`;
    const pdfFilePath = path.join(__dirname, '../public', 'uploads', pdfFileName);

    // PDF 파일을 서버에 저장
    await fs.writeFile(pdfFilePath, pdf.output());
    // 파일을 DB 서버로 업로드
    const remoteFilePath = path.join(process.env.DB_UPLOAD_DIRECTORY, pdfFileName);
    await uploadFileToDBServer(pdfFilePath, remoteFilePath);

    // 클라이언트에게 PDF 파일 경로 전달
    res.status(200).json({ pdfFileName: `${pdfFileName}` });

  } catch (error) {
    console.error('Error during crawling or PDF generation:', error);
    res.status(500).json({ error: 'Error occurred during crawling or PDF generation' });
  }
});

// POST Doc file upload
router.post('/fileUpload', upload.single('upload-file'), async (req, res) => {
  if (!req.file) {
    res.status(400).send('No file uploaded.');
    return;
  }

  const uploadedFile = req.file;
  // console.log('uploadedFile : ', uploadedFile);
  // console.log('uploadedFile.originalname : ', uploadedFile.originalname.length);
  
  // 파일명을 UTF-8로 디코딩
  const decodedFileName = iconv.decode(Buffer.from(uploadedFile.originalname, 'binary'), 'utf-8');

  const localFilePath = uploadedFile.path;
  const newLocalFilePath = path.join(uploadedFile.destination, decodedFileName);

  try {
    // 파일명을 rename
    fs.rename(localFilePath, newLocalFilePath);
    // console.log('Renamed file successfully:', newLocalFilePath);

    if (req.body.uploadToDB === 'true') {
      // 파일을 DB 서버로 업로드
      const remoteFilePath = path.join(process.env.DB_UPLOAD_DIRECTORY, decodedFileName);
      await uploadFileToDBServer(newLocalFilePath, remoteFilePath);
    }

    // 업로드된 파일의 새로운 경로와 파일명을 응답으로 반환
    res.send({ message: 'File uploaded successfully', filePath: newLocalFilePath });

  } catch (error) {
    console.error('Error processing file or uploading to DB server:', error);
    res.status(500).send('Error processing file or uploading to DB server.');
  }
});

// POST PPT file upload
router.post('/pptParsing', upload.single('upload-file'), async (req, res) => {
  if (!req.file) {
    res.status(400).send('No PPT file uploaded.');
    return;
  }

  const pptFilePath = req.file.path;

  try {
    const text = await officeParser.parseOfficeAsync(pptFilePath);
    if (!text) {
      console.error("PPT 파일을 읽을 수 없습니다.");
      res.status(500).send("파일 변환 중 에러가 발생했습니다.");
      return;
    }

    const maxChunkSize = 1024; // 최대 청크 크기 설정
    const chunks = splitTextBySentences(text, maxChunkSize);
    const txtFilePaths = [];

    for (let i = 0; i < chunks.length; i++) {
      const txtFilePath = `${pptFilePath.replace(/pptx?$/, "")}_part${i + 1}.txt`; // 청크별 파일 경로
      await fs.writeFile(txtFilePath, chunks[i]);
      txtFilePaths.push(txtFilePath);
      // console.log(`PPT 파일 청크가 성공적으로 변환되어 ${txtFilePath}에 저장되었습니다.`);
    }

    res.status(200).json({ txtFilePaths, chunks, originalFilePath: pptFilePath });
    // 클라이언트에 파일 경로와 청크별 텍스트 배열을 응답으로 전달
  } catch (err) {
    console.error(err.stack); // 에러 스택 트레이스 출력
    res.status(500).send("파일 변환 중 에러가 발생했습니다."); // 에러 응답
  }
});


// PPT 파일의 JSON텍스트를 슬라이드별로 추출하여 파일로 저장하는 엔드포인트
// router.post('/pptParsing2JSON', upload.single('upload-file'), async (req, res) => {
//   if (!req.file) {
//     res.status(400).send('No PPT file uploaded.');
//     return;
//   }

//   const pptFilePath = req.file.path;

//   try {
//     // pptx2json 인스턴스를 생성
//     const pptx2json = new PPTX2Json();
//     const jsonData = await pptx2json.toJson(pptFilePath);

//     if (!jsonData || jsonData.length === 0) {
//       console.error("PPT 파일을 읽을 수 없습니다.");
//       res.status(500).send("파일 변환 중 에러가 발생했습니다.");
//       return;
//     }

//     // console.log('jsonData : ', jsonData);
//     const slideTexts = [];
//     // 슬라이드 XML 데이터 탐색
//     for (const [key, value] of Object.entries(jsonData)) {
//       if (key.startsWith('ppt/slides/slide') && key.endsWith('.xml')) {
//         const slideData = value['p:sld'];
//         if (slideData && slideData[0] && slideData[0]['p:cSld']) {
//           const cSld = slideData[0]['p:cSld'][0];
//           if (cSld && cSld['p:spTree']) {
//             const spTree = cSld['p:spTree'][0];
//             if (spTree['p:sp']) {
//               const slideText = spTree['p:sp']
//                 .map(sp => {
//                   if (sp['p:txBody']) {
//                     return sp['p:txBody']
//                       .map(txBody => txBody['a:p']
//                         .map(p => p['a:r']
//                           .map(r => r['a:t'])
//                           .join(''))
//                         .join(''))
//                       .join('');
//                   }
//                   return '';
//                 })
//                 .join('');
//               slideTexts.push(slideText);
//             }
//           }
//         }
//       }
//     }

//     // 슬라이드별 텍스트를 JSON 형식으로 응답
//     res.status(200).json({ slideTexts });
//   } catch (err) {
//     console.error(err.stack);
//     res.status(500).send("파일 변환 중 에러가 발생했습니다.");
//   }
// });

// POST PDF file upload
router.post('/pdfParsing', upload.single('upload-file'), async (req, res) => {
  if (!req.file) {
    res.status(400).send('No PDF file uploaded.');
    return;
  }

  const pdfFile = req.file;
  const pdfFileName = pdfFile.originalname;
  const pdfFileExtension = path.extname(pdfFileName).toLowerCase();

  if (pdfFileExtension !== '.pdf') {
    res.status(400).send('Invalid file type. Only PDF files are allowed.');
    return;
  }

  const pdfFilePath = pdfFile.path;
  const txtFilePathPrefix = pdfFilePath.replace(/\.pdf$/, ''); // 변환된 텍스트 파일 경로 접두어

  try {
    const data = await fs.readFile(pdfFilePath);
    const pdfData = await pdfParse(data);
    const text = pdfData.text;

    if (!text) {
      console.error("PDF 파일을 읽을 수 없습니다.");
      res.status(500).send("파일 변환 중 에러가 발생했습니다.");
      return;
    }

    const maxChunkSize = 10240; // 최대 청크 크기 설정
    const chunks = splitTextBySentences(text, maxChunkSize);
    const txtFilePaths = [];

    for (let i = 0; i < chunks.length; i++) {
      const txtFilePath = `${txtFilePathPrefix}_part${i + 1}.txt`; // 청크별 파일 경로
      await fs.writeFile(txtFilePath, chunks[i]);
      txtFilePaths.push(txtFilePath);
      // console.log(`PDF 파일 청크가 성공적으로 변환되어 ${txtFilePath}에 저장되었습니다.`);
    }

    res.status(200).json({ txtFilePaths, chunks });
    // res.status(200).send(JSON.stringify(txtFilePaths)); 
  } catch (err) {
    console.error(err.stack);
    res.status(500).send("파일 변환 중 에러가 발생했습니다.");
  }
});

// Get PPT file download
router.get('/fileDownload/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  const uploadDirectory = '/home/eleblog/backend';
  // const uploadDirectory = process.env.UPLOAD_DIRECTORY;
  const fileUrl = path.join(uploadDirectory, fileName);
  console.log('fileUrl : ', fileUrl);
  
  res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
  res.sendFile(fileUrl, (sendFileErr) => {
    if (sendFileErr) {
      console.error('Error sending file:', sendFileErr);
      return res.status(404).send('File not found or is not readable.');
    } else {
      console.log('File sent successfully.');
    }
  });
});

// 파일 다운로드 엔드포인트 등록
router.get('/fileUrl/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  const uploadDirectory = process.env.UPLOAD_DIRECTORY;
  const baseUrl = process.env.BASE_URL;
  const filePath = path.join(uploadDirectory, fileName);
  const relativePath = path.relative(path.join(__dirname, '../public'), filePath);
  const downloadLink = `${baseUrl}/${relativePath.replace(/\\/g, '/')}`;
  console.log('downloadLink : ', downloadLink);
  res.json({ downloadLink });
});

// JSON 로깅 엔드포인트
router.post('/logging', async (req, res) => {
  const { timestamp, filePath, message, duration } = req.body;
  const logEntry = { timestamp, filePath, message, duration };

  try {
    await ensureLogsDirectoryExists();
    await appendLogEntry(logEntry);
    res.status(200).send('Log entry added successfully');
  } catch (error) {
    console.error('Error adding log entry:', error);
    res.status(500).send('Error adding log entry');
  }
});


//   router.post('/docfileUpload2', upload.single('upload-file'), (req, res) => {
//   if (!req.file) {
//     res.status(400).send('No file uploaded.');
//     return;
//   }

//   const uploadFile = req.file;
//   console.log('uploadFile : ', uploadFile);
//   const uploadFileName = uploadFile.originalname;
//   const uploadFileExtension = path.extname(uploadFileName).toLowerCase();

//   if (uploadFileExtension !== '.pdf') {
//     res.status(400).send('Invalid file type. Only PDF files are allowed.');
//     return;
//   }

//   const localFilePath = uploadFile.path;
//   const remoteFilePath = path.join(process.env.DB_UPLOAD_DIRECTORY, uploadFileName);

//   // Call the function to upload the file to the DB server
//   uploadFileToDBServer(localFilePath, remoteFilePath)
//     .then(() => {
//       res.send('File uploaded successfully.');
//     })
//     .catch((error) => {
//       res.status(500).send('Error uploading file to DB server.');
//     });
// });


module.exports = router;