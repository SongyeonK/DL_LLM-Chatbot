import axios from 'axios';
// import { HumanMessage } from "@langchain/core/messages";
import OpenAI from "openai";
// import { ChatOpenAI } from '@langchain/openai';
import { HfInference } from '@huggingface/inference';

// API 클라이언트를 생성하는 팩토리 함수
export const createApiClient = async (modelId) => {
  if (!modelId) {
    throw new Error("Model ID is not defined");
  }
  const models = await fetchModelsFromDatabase();  
  const model = models.find(m => m.MODEL_ID === modelId);

  if (!model || !model.MODEL_NAME) {
    throw new Error(`Model with ID ${modelId} not found or MODEL_NAME is undefined`);
  }

  const configuration = {
    openaiApiKey: process.env.VUE_APP_OPENAI_API_KEY,
    huggingfaceApiKey: process.env.VUE_APP_HUGGINGFACE_API_KEY,
    anthropicApiKey: process.env.VUE_APP_ANTHROPIC_API_KEY,
    cohereApiKey: process.env.VUE_APP_COHERE_API_KEY,
    modelName: model.MODEL_NAME,
  };

  switch (model.MODEL_NAME.toLowerCase()) {
    case 'gpt-4o-mini':
    case 'gpt-4o':
    case 'gpt-3.5-turbo': {
      const openaiClient = new OpenAI({
        apiKey: configuration.openaiApiKey,
        dangerouslyAllowBrowser: true,  // 브라우저 환경에서 사용을 허용
      });
      // const openaiClient = new ChatOpenAI({
      //   apiKey: configuration.openaiApiKey,
      //   model: configuration.modelName
      // });
      return { client: openaiClient, modelName: configuration.modelName };
    }
    case 'meta-llama/meta-llama-3-70b-instruct': 
    case 'meta-llama/meta-llama-3-8b-instruct': 
    case 'mistralai/mistral-7b-instruct-v0.3': 
    case 'mistralai/mistral-7b-instruct-v0.2': 
    case 'upstage/solar-10.7b-instruct-v1.0': 
    {
      const hfClient = new HfInference(configuration.huggingfaceApiKey);
      return { client: hfClient, modelName: configuration.modelName };
    }
    default:
      throw new Error('Unsupported API provider');
  }
};

// LLM별로 chat하는 메소드
export const createChatCompletion = async (client, modelName, messages, options = {}) => {
  // options 기본값 설정
  const { temperature = 0.7, top_p = 0.9 } = options;

  if (client instanceof OpenAI) {
    let response = '';
    const completion = await client.chat.completions.create({
      model: modelName,
      messages: messages,
      temperature: temperature,
      top_p: top_p,
      stream: true,
    });
    for await (const chunk of completion) {
      response += chunk.choices[0]?.delta?.content || "";
    }
    return response;
  } else if (client instanceof HfInference) {
    let response = '';
    console.log('messages : ', messages);
    for await (const chunk of client.chatCompletionStream({
      model: modelName,
      messages: messages,
      temperature: temperature,
      max_tokens: options.max_tokens || 500,
    })) {
      response += chunk.choices[0]?.delta?.content || "";
    }
    return response;
  }  
};

// 모델 목록을 가져오는 함수
export const fetchModelsFromDatabase = async () => {
  try {
    const response = await axios.get('/api/config/getLLMConfig');
    return response.data.models;
  } catch (error) {
    console.error('Error fetching models from database:', error);
    throw error;
  }
};

// 특정 모델의 옵션을 가져오는 함수
export const fetchOptionsFromDatabase = async (modelId) => {
  try {
    const response = await axios.get('/api/config/getLLMConfig');
    return response.data.options.filter(option => option.MODEL_ID === modelId);
  } catch (error) {
    console.error('Error fetching options from database:', error);
    throw error;
  }
};

// LLM 구성 데이터(모델목록과 옵션 모두)를 가져오는 함수
export const getLLMConfig = async () => {
  try {
    // LLM config 데이터를 서버에서 가져옴
    const response = await axios.get('/api/config/getLLMConfig');
    // localStorage에서 embeddingModel 값을 읽어옴
    let embeddingModel = localStorage.getItem('embeddingModel');
    // 만약 localStorage에 값이 없다면 기본값을 설정
    if (!embeddingModel) {
      embeddingModel = 'doc_model_han';
      localStorage.setItem('embeddingModel', embeddingModel);  // 기본값을 localStorage에 저장
    }
    // embedding_model을 response.data에 추가
    response.data.embedding_model = embeddingModel;
    return response.data;
  } catch (error) {
    console.error('Error loading LLM config:', error);
    throw error;
  }
};

export const loadLLMConfig = async () => {
  try {
    const data = await getLLMConfig();
    const embedding_model = data.embedding_model;
    const models = data.models.filter(model => 
      model.MODEL_NAME === 'gpt-4o-mini' || model.MODEL_NAME === 'gpt-4o' || model.MODEL_NAME === 'gpt-3.5-turbo'
    );
    const defaultModel = data.models.find(model => model.DEFAULT_MODEL_YN === 'Y');
    
    if (defaultModel) {
      return {
        selectedModelId: defaultModel.MODEL_ID,
        selectedModelName: defaultModel.MODEL_NAME,
        embedding_model,
        models
      };
    } else {
      console.error('No default model found');
      return null;
    }
  } catch (error) {
    console.error('Error loading LLM config:', error);
    throw error;
  }
};

export const setDefaultModel = async (modelId) =>  {
  try {
    const response = await axios.post('/api/config/updateLLMModel', { model_id: modelId });
    if (response.status === 200) {
      // console.log('Default model updated successfully : ', modelId);
    }
  } catch (error) {
    console.error('Error setting default model:', error);
  }
};

// 채팅 방을 저장하는 함수
export const saveChatRoom = async () => {
  try {
    const historyResponse = await axios.post('/api/chatbot/saveHistory', { chat_room_id: 'room' + Date.now(), title: '' });
    return {
      chatId: historyResponse.data.chat_id,
      chatRoomId: historyResponse.data.chat_room_id
    };
  } catch (error) {
    console.error('Error saving chat room:', error);
    throw new Error('채팅 방 저장에 실패했습니다.');
  }
};

// 채팅 메시지를 저장하는 함수
export const saveChatMessage = async (chatId, userId, content, role) => {
  try {
    await axios.post('/api/chatbot/saveChat', { chat_id: chatId, user_id: userId, content, role });
  } catch (error) {
    console.error('Error saving message:', error);
    throw new Error(`${role === 'user' ? '사용자' : '봇'} 메시지 저장에 실패했습니다.`);
  }
};

// Gabage Chat 삭제 확인 및 실행
export const deleteNullChat = async () => {
  try {
    const response = await axios.delete('/api/chatbot/deleteNullChat');
    if (response.status === 200) {
      // console.log('Unfinished Null chat room and messages deleted');
    }
  } catch (error) {
    console.error('Error deleting Null chat room and messages:', error);
  }
};

// 입력 filename의 바이트 크기 계산
export const calculateByteLength = async (fileName) => {
  // NFD 포맷 여부 확인
  const isNFD = fileName !== fileName.normalize('NFC');
  let byteLength = 0;

  for (let char of fileName) {
    const codePoint = char.codePointAt(0);
    // 한글 여부 확인 (유니코드 범위: U+AC00 ~ U+D7A3)
    if (codePoint >= 0xAC00 && codePoint <= 0xD7A3) {
      // NFD 포맷인 경우
      if (isNFD) {
        // 받침 문자가 있는지 확인 (자음, 모음으로만 구성된 경우는 2바이트, 받침 있는 경우는 3바이트)
        const jamo = char.normalize('NFD');
        byteLength += jamo.length === 3 ? 3 : 2;
      } else {
        // NFC 포맷인 경우 한글은 3바이트
        byteLength += 3;
      }
    } else {
      // 한글이 아닌 문자의 경우 기본 바이트 길이 계산
      byteLength += new TextEncoder().encode(char).length;
    }
  }
  return byteLength;
};

export const formatMessage = (text, isUser) => {
  const escapeHtml = (text) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const escapedText = escapeHtml(text);
  // SQL 들여쓰기를 위한 로직 추가
  const indent = ' '.repeat(10);  // "SQL" : " 의 길이에 해당하는 공백 생성

  let formattedText = escapedText
    .replace(/\\n/g, `<br>${indent}`)  // '\n' 문자열을 <br>로 변환
    .replace(/\n/g, '<br>')  // 줄바꿈 문자를 <br>로 변환
    .replace(/(^|<br>)(\s+)/g, (match, p1, p2) => p1 + p2.replace(/ /g, '&nbsp;'));
  
  // 특정 키워드에 색상 적용
  formattedText = formattedText
    .replace(/GEN_SQL/g, '<span style="color: var(--text-highlight2-color); font-weight: bold;">GEN_SQL</span>')

    .replace(/요약/g, '<span style="color: var(--text-highlight3-color); font-weight: bold;">요약</span>')
    .replace(/시사점/g, '<span style="color: var(--text-highlight3-color); font-weight: bold;">시사점</span>')
    .replace(/QueryResult/g, '<span style="color: var(--text-highlight3-color); font-weight: bold;">QueryResult</span>')

    .replace(/SQL자연어/g, '<span style="color: var(--text-highlight3-color); font-weight: bold;">SQL자연어</span>')
    .replace(/Input SQL/g, '<span style="font-weight: bold;">Input SQL</span>')
    .replace(/Reviewed SQL/g, '<span style="color: var(--text-highlight2-color); font-weight: bold;">Reviewed SQL</span>')
    .replace(/수정 근거/g, '<span style="color: var(--text-highlight3-color); font-weight: bold;">수정 근거</span>')

    .replace(/최종 SQL/g, '<span style="color: var(--text-highlight3-color); font-weight: bold;">최종 SQL</span>')

    .replace(/수정 제안/g, '<span style="color: var(--text-highlight2-color); font-weight: bold;">수정 제안</span>')
    .replace(/수정 후/g, '<span style="color: var(--text-highlight3-color); font-weight: bold;">수정 후</span>')

    .replace(/번역문/g, '<span style="font-weight: bold;">번역문</span>')
    .replace(/IT용어 사전 활용/g, '<span style="color: var(--text-highlight3-color); font-weight: bold;">IT용어 사전 활용</span>');


  if (isUser) {
    return `<span style="font-size: 1.2em;">🕵🏽</span> ${formattedText}`;
  } else {
    return `<span style="font-size: 1.2em;">🤖</span> ${formattedText}`;
  }
};

// 🙆🏽‍♂️ 🧑🏽‍🚀 🧑🏽‍💻 🕵🏽

// formatJSON 현재 사용하지 않으나, 나중에....
export const formatJSON = (text) => {
  const jsonString = text;
  try {
    // 이미 객체인 경우 처리하지 않고 바로 반환
    if (typeof jsonString === 'object') {
      return JSON.stringify(jsonString, null, 2).replace(/\n/g, '<br>').replace(/\s/g, '&nbsp;');
    }
    const jsonObject = JSON.parse(jsonString);
    return JSON.stringify(jsonObject, null, 2).replace(/\n/g, '<br>').replace(/\s/g, '&nbsp;');
  } catch (error) {
    console.error('Invalid JSON string:', error);
    return jsonString; // JSON 포맷이 잘못된 경우 원본 문자열 반환
  }
};

export const formatTimestamp = (timestamp) => {
  // 파라미터가 없으면 현재 시간을 사용
  const date = timestamp ? new Date(timestamp) : new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const scrollToBottom = (ref) => {
  if (ref) {
    setTimeout(() => {
      ref.scrollTop = ref.scrollHeight;
    }, 100); // 100ms 지연 시간을 추가하여 DOM이 준비되었는지 확인
  } else {
    console.error('Reference is undefined');
  }
};