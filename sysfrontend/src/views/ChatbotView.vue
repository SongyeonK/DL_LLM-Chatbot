<template>
  <v-container fluid class="pa-0">
    <v-row justify="center" no-gutters>
      <v-col :cols="12" class="assistant-view">
        <v-card>
          <v-card-title class="assistant-view-title">
            <v-col :cols="9">
              <v-container class="pa-0">
                <v-row class="fixed-height-row">
                  <v-col :cols="4">
                    <v-icon class="mr-2">mdi-chat-plus</v-icon> {{ botnameRAG }}
                  </v-col>
                  <v-col :cols="4">
                    <v-tooltip location="top" text="RAG로 활용될 도큐먼트 파일명">
                      <template v-slot:activator="{ props }">
                        <v-chip 
                          v-if="selectedModelName" 
                          color="secondary"
                          variant="flat"
                          v-bind="props"
                          class="custom-chip"
                        >
                          <v-icon icon="mdi-file-document" start></v-icon>
                          {{ filenameRAG }}
                        </v-chip>
                      </template>
                    </v-tooltip>
                  </v-col>
                  <v-col cols="2">
                    <v-text-field
                      v-model.number="topRow"
                      label="벡터검색 건수"
                      density="compact"
                      type="number" min="1" max="50" :step="1"
                      class="custom-text-field-h50"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="2">
                    <v-text-field
                      v-model.number="temperature"
                      label="Temperature"
                      density="compact"
                      type="number" min="0.0" max="2.0" :step="0.1"
                      class="custom-text-field-h50"
                    ></v-text-field>
                  </v-col>
                </v-row>
              </v-container>
            </v-col>
            <v-col :cols="3">
              <v-container class="pa-0">
                <v-row class="fixed-height-row">
                  <v-col :cols="7">
                    <v-select
                      v-model="selectedModelId"
                      :items="models"
                      density="compact"
                      item-title="MODEL_NAME"
                      item-value="MODEL_ID"
                      chips
                      class="custom-select-h50"
                      @update:modelValue="updateModel"
                    ></v-select>
                  </v-col>
                  <v-col :cols="3">
                    <v-tooltip location="top" text="채팅 내용 저장">
                      <template v-slot:activator="{ props }">
                        <v-btn 
                          v-bind="props" 
                          density="comfortable"
                          icon="mdi-content-save"
                          @click="saveChatbot" 
                        ></v-btn>
                      </template>
                    </v-tooltip>
                  </v-col>
                  <v-col :cols="1">
                  </v-col>
                  <v-col :cols="1">
                    <v-progress-circular
                      v-if="isSQLGenerating"
                      color=var(--text-highlight-color)
                      indeterminate
                    ></v-progress-circular>
                  </v-col>
                </v-row>
              </v-container>
            </v-col>
          </v-card-title>
          <div class="spacing">
            <div class="chat-content" ref="chatContent">
              <div v-for="(message, index) in messages" :key="index" :class="['message', message.isUser ? 'user' : 'bot']">
                <div v-if="message.isUser" class="timestamp">
                  {{ message.timestamp }}
                </div>
                <div :class="['bubble', message.isUser ? 'user-bubble' : 'bot-bubble']">
                  <div v-html="formatMessage(message.text, message.isUser)" v-if="!message.relatedPhrases"></div>
                  <div v-else>
                    <!-- 메시지 본문 -->
                    <div v-html="formatMessage(message.text, message.isUser)"></div>
                    <!-- Related Phrases 버튼 -->
                    <div v-if="message.relatedPhrases">
                      <v-btn
                        v-for="(phrase, pIndex) in message.relatedPhrases"
                        :key="pIndex"
                        class="ma-2"
                        color=var(--button-background-color)
                        @click="viewPdfDocument(phrase.File, phrase.Page)"
                      >
                        <span class="custom-btn-w300">{{ phrase.Page }}P - {{ phrase.File }}</span>
                      </v-btn>
                    </div>
                  </div>
                  <div v-if="message.queryResult">
                    <v-data-table-virtual
                      :headers="generateHeaders(message.queryResult)"
                      :items="transformQueryResult(message.queryResult)"
                      class="elevation-1 custom-table"
                    >
                      <template v-slot:header>
                        <thead>
                          <tr class="custom-table-row">
                            <th v-for="(header, index) in generateHeaders(message.queryResult)" :key="index">
                              {{ header.title }} <!-- Header 텍스트 -->
                            </th>
                          </tr>
                        </thead>
                      </template>
                      <template v-slot:item="{ item }">
                        <tr class="custom-table-row">
                          <td v-for="(header, index) in generateHeaders(message.queryResult)" :key="index">
                            {{ item[header.value] }}
                          </td>
                        </tr>
                      </template>
                    </v-data-table-virtual>
                  </div>
                </div>
                <!-- <div :class="['bubble', message.isUser ? 'user-bubble' : 'bot-bubble']" v-html="formatMessage(message.text, message.isUser)">
                </div> -->
                <div v-if="!message.isUser" class="timestamp">
                  {{ message.timestamp }}
                </div>
              </div>
            </div>
          </div>
          <div class="center-message">
            🧑🏽‍🚀 챗봇 Assistant는 실수를 할 수 있습니다. 중요한 정보는 한번 더 확인하세요.
          </div>
          <v-textarea
            class="message-input"
            v-model="input"
            label="메시지 입력"
            bg-color=var(--message-input-background-color)
            solo
            rows="1"
            auto-grow
            @keydown.enter="handleKeydown"
            @keyup.enter="handleKeyup"
            append-inner-icon="mdi-send"
            @click:append-inner="sendMessage"
          ></v-textarea>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import axios from 'axios';
import { mapActions, mapGetters } from "vuex";
import { loadLLMConfig, setDefaultModel, deleteNullChat, formatMessage, formatTimestamp, saveChatRoom, saveChatMessage, scrollToBottom } from "../apiService";

export default {
  data: () => ({
    botnameRAG: '',
    filenameRAG: '',
    userInfo: '',

    urlLink: '', // 입력된 URL을 저장하는 변수

    temperature: 0.1,    // chatbot은 사실에 근거한 답만을 제시하도록 세팅
    topRow: 10,           // 문서당 10개

    selectedModelId: null, // 선택된 모델을 저장하는 변수
    selectedModelName: null, // 선택된 모델을 저장하는 변수
    models: [],
    modelOptions: [],   // 모델 옵션을 저장하는 배열
    embedding_model: '', // 임베딩 모델 (벡터임베딩, 벡터서치에서 사용)

    input: '',
    messages: [],
    summary: '', // 요약 내용을 저장
    summaryThreshold: 5, // 요약을 수행할 메시지 개수 임계값

    currentChatId: null,
    currentChatRoomId: null,
    isChatSaved:false,
    initialMessages: [],
    isSQLGenerating: false,
  }),
  computed: {
    ...mapGetters(['getActiveChats']),
    activeChats() {
      return this.getActiveChats;
    }
  },
  created() {
    this.loadLLMConfig(); // LLM 설정 로드
    deleteNullChat();
    this.botnameRAG = this.$route.params.botname;
    this.filenameRAG = this.$route.params.filename;
    this.startNewChatbot(this.botnameRAG); 
},
  beforeRouteUpdate(to, from, next) {
    // 라우트가 변경될 때마다 필요한 동작을 수행
    this.botnameRAG = to.params.botname;
    this.filenameRAG = to.params.filename;
    this.startNewChatbot(this.botnameRAG);
    next();
  },
  methods: {
    ...mapActions(['setActiveChats', 'addActiveChat', 'initializeApiClient', 'createChat']),
    async loadLLMConfig() {
      try {
        const config = await loadLLMConfig();
        if (config) {
          this.selectedModelId = config.selectedModelId;
          this.selectedModelName = config.selectedModelName;
          this.embedding_model = config.embedding_model;
          this.models = config.models;
        }
      } catch (error) {
        console.error('Error loading LLM config:', error);
      }
    },
    async updateModel() {
      await this.initializeApiClient(this.selectedModelId);
      setDefaultModel(this.selectedModelId); // 모델을 디폴트로 설정하는 메소드 호출
    },
    async startNewChatbot(botname) {
      this.currentChatId = null;
      this.currentChatRoomId = null;
      if (botname.startsWith('B_')) {
        const userInfoResponse = await axios.get('/api/config/selectUserInfo', { params: { bot_name: this.botnameRAG } });
        this.userInfo = userInfoResponse.data[0];
        this.messages = [{ text: `안녕하세요! ${this.botnameRAG}봇 입니다. 고객(${this.userInfo.사용자명}님)정보를 참고하여 답변을 드리도록 하겠습니다!\n무엇을 도와드릴까요?`, isUser: false, timestamp: formatTimestamp() }];
      }
      else {
        this.messages = [{ text: `안녕하세요! ${this.botnameRAG}봇 입니다. 무엇을 도와드릴까요?`, isUser: false, timestamp: formatTimestamp() }];
      }
      this.initialMessages = [...this.messages]; // 초기 메시지 배열 업데이트
    },
    async sendMessage() {
      if (this.input.trim()) {
        const userMessage = { text: this.input, isUser: true, timestamp: formatTimestamp() };
        this.messages.push(userMessage);
        this.input = '';
        this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤

        document.body.style.cursor = 'progress'; 
        this.isSQLGenerating = true;
        // Step 1: 데이터 조회 중
        this.messages.push({ text: '데이터 조회 중입니다.', isUser: false, timestamp: formatTimestamp() });
        this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤
        // 진행 상황을 업데이트할 인덱스 저장 (마지막 메시지 인덱스)
        const statusMessageIndex = this.messages.length - 1;
        
        const chatbotname = this.botnameRAG.replace(/^B_/, "");

        try {
          let systemPrompt = `You are an expert and problem solver in the field of ${chatbotname}. Your role is to provide practical and realistic solutions to a variety of issues, with answers that are factual and actionable. Your goal is to resolve problems effectively and efficiently by analyzing the situation, identifying root causes, and suggesting clear, actionable steps. Answers should be detailed, written in plain language, and based on the relevant information provided. You must include the <file></file> and <page></page> tags included in the relevant information in your answer.
          Context: Be clear and focused on solutions that are feasible and sustainable. Your answers must be written in Korean, and should be clear and easy to understand. There is no character limit to your answer, so please explain in as much detail as possible. Also your answers must be written strictly based on the relevant information provided, not by imagination or inference, and must be based on facts. Answers must include the <file></file> and <page></page> tags. 
          `;

          let relevantInformation = 'Here is some relevant information to help you with your questions : \n';
          // Step 1-1 Perform vector search
          const vsearchResponse = await axios.post('/api/chatbot/mvsearch', {
            file_name: this.filenameRAG,
            embedding_model: this.embedding_model,
            question: userMessage.text,
            top_row: this.topRow,
          });
          relevantInformation += vsearchResponse.data.map(doc => doc[0]).join('\n');

          if (this.botnameRAG.startsWith('B_')) {   // 비즈니스 챗봇
            // Step 2: 비즈니스 테이블 조회 중
            systemPrompt += '\n If user information is provided, refer to this information, but only refer to the sections directly related to your question.';
            relevantInformation += `\n user information : \n`;
            for (const [key, value] of Object.entries(this.userInfo)) {
              relevantInformation += `  - ${key}: ${value}\n`;
            }
            const tableMapping = {
              '투자': ['AIVS_ETFS', 'AIVS_USER_PORTFOLIO'], // '투자'에 여러 테이블 매핑
              '카드': ['AIVS_CARD_USAGE', 'AIVS_MERCHANT_CATEGORIES']
            };

            let tableNames = ['AIVS_ETFS']; // 기본값으로 첫 번째 테이블 할당
            for (const [keyword, names] of Object.entries(tableMapping)) {
              if (this.botnameRAG.includes(keyword)) {
                tableNames = names;
                break;
              }
            }

            // tableNames 배열을 SQL 쿼리에서 사용할 수 있도록 문자열로 변환
            const tableNamesStr = tableNames.map(name => `'${name}'`).join(', ');

            const tableInfoResponse = await axios.get(`/api/sqlgen/execSqlQuery?sql=select a.table_name, a.column_name, a.data_type, b.comments from dba_tab_cols a, dba_col_comments b where a.owner = 'DOCCHAT' and a.table_name in (${tableNamesStr}) and a.owner = b.owner and a.table_name = b.table_name and a.column_name = b.column_name order by a.COLUMN_ID`);

            const tableInfo = JSON.stringify(tableInfoResponse.data);

            const systemAugmentPrompt = `However, if you must create SQL queries, you should follow these guidelines: You should create syntactically correct Oracle SQL queries to obtain the information you need from the DB. You should only query the columns that you need to answer your question. Be careful to only use the column names that you see in the table below. Be careful not to query columns that do not exist. Also, be careful which columns are in which tables. And you need to include the owner name before the table name. (e.g. owner name. table name) Oracle SQL syntax does not explicitly add the schema name to the column name.
            You need to provide the answer in JSON format without including the keyword 'json'.
            {
              "SQL" : "Generated SQL Query"
            }`;
            let systemAugmentPrompt2 = '';

            if (this.botnameRAG.includes('투자')) { // '투자'라는 단어가 botnameRAG에 포함된 경우 실행할 코드
              systemPrompt += '\n You are also an Oracle SQL expert. You can create SQL statements based on the table information provided. When asked about the ETF list and investment portfolio, you should never give a different answer and create a SQL query to check for ETFs that are relevant to the question. ';

              systemAugmentPrompt2 += `\n Context: When you receive a question about ETFs and investment portfolio, you should not provide any kind of answer, but only generate SQL statements(When generating SQL, please use only the following tables and columns). For other questions, Be clear and focused on solutions that are feasible and sustainable. Also your answers must be written strictly based on the relevant information provided, not by imagination or inference, and must be based on facts. Answers must include the <file></file> and <page></page> tags. 
              Tables information: ${tableInfo}`;
            } else if (this.botnameRAG.includes('카드')) { // '카드'라는 단어가 botnameRAG에 포함된 경우 실행할 코드
              systemPrompt += '\n You are also an Oracle SQL expert. You can create SQL statements based on the table information provided. When asked about card usage history or merchants, you should never give any other answers and create a SQL query to check the card usage history or merchants that is relevant to the question. ';

              systemAugmentPrompt2 += `\n Context: When you receive a question about card usage history or merchants, you should not provide any kind of answer, but only generate SQL statements(When generating SQL, please use only the following tables and columns). For other questions, Be clear and focused on solutions that are feasible and sustainable. Also your answers must be written strictly based on the relevant information provided, not by imagination or inference, and must be based on facts. Answers must include the <file></file> and <page></page> tags. 
              Tables information: ${tableInfo}`;
            } 
            systemPrompt += systemAugmentPrompt + systemAugmentPrompt2;
          } else {   
            // 비즈니스 챗봇이 아닌 일반 문서기반 챗봇
            systemPrompt += '';
          }
          // Step 2-1 : Save 채팅 방
          if (!this.currentChatId) {
            const { chatId, chatRoomId } = await saveChatRoom();
            this.currentChatId = chatId;
            this.currentChatRoomId = chatRoomId;
          }
          // Step 2-2 : Save user message
          const username = process.env.VUE_APP_DEFAULT_USERNAME;
          console.log('userMessage.text : ', userMessage.text);
          await saveChatMessage(this.currentChatId, username, userMessage.text, 'user');
          this.messages[statusMessageIndex].text = '답변을 생성 중입니다.';
          this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤

          // 점 추가를 위한 Interval 설정
          let dotCount = 0;
          const maxDots = 5;
          const intervalId = setInterval(() => {
            dotCount = (dotCount + 1) % (maxDots + 1);
            const dots = '.'.repeat(dotCount);
            this.messages[statusMessageIndex].text = `답변을 생성 중입니다.${dots}`;
            this.$nextTick(() => { this.scrollToBottom(); });
          }, 1000); // 1초 간격으로 점 추가
          // **추가된 부분**: 요약된 정보 및 관련 정보를 포함하여 LLM에 전달
          // console.log('systemPrompt : ', systemPrompt);
          let contextMessages = [{ role: 'system', content: systemPrompt }];
          if (this.summary) contextMessages.push({ role: 'system', content: this.summary });
          contextMessages.push({ role: 'system', content: relevantInformation });
          contextMessages.push({ role: 'user', content: userMessage.text });

          // Step 3: 봇과의 채팅 
          const response = await this.createChat( { messages: contextMessages },  { temperature: this.temperature } );

          clearInterval(intervalId); // Interval 중지

          let responseObj = null;
          try {
            responseObj = JSON.parse(response);
          } catch (error) {
            console.error('Error parsing JSON:', error);
          }

          let botMessage ='';
          if (!responseObj || !responseObj.SQL) { // 일반 답변의 경우
            // 평문에서 <page></page> 태그를 추출
            const fileTagRegex = /<file>(.*?)<\/file>/g;
            const pageTagRegex = /<page>(.*?)<\/page>/g;
            let relatedPhrases = [];
            let matchFile, matchPage;
            // <file> 태그와 <page> 태그를 동시에 찾고, 같은 인덱스의 값을 함께 추가
            while ((matchFile = fileTagRegex.exec(response)) !== null && (matchPage = pageTagRegex.exec(response)) !== null) {
              relatedPhrases.push({
                File: matchFile[1].trim(),
                Page: matchPage[1].trim()
              });
            }
            // <file> 및 <page> 태그를 제거한 나머지 텍스트를 botMessage.text로 사용
            let responseTxtWithoutTags = response.replace(fileTagRegex, '').replace(pageTagRegex, '').trim();
            // botMessage 생성
            botMessage = { 
              text: responseTxtWithoutTags, 
              isUser: false, 
              timestamp: formatTimestamp(),
              relatedPhrases: relatedPhrases 
            };
            this.messages.push(botMessage);
            this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤
          } else {  // SQL 쿼리를 만든경우, 추가로 정보 조회한 결과를 바탕으로 답변을 생성
            // Step 4: SQL 쿼리 생성
            console.log('responseObj.SQL : ', responseObj.SQL);
            this.messages[statusMessageIndex].text = '질문에 맞는 답변을 위해 SQL을 생성/수행하고 그 결과를 이용하여 답변을 업데이트 중입니다.';
            this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤

            // 점 추가를 위한 Interval 설정
            let dotCount = 0;
            const maxDots = 5;
            const intervalId = setInterval(() => {
              dotCount = (dotCount + 1) % (maxDots + 1);
              const dots = '.'.repeat(dotCount);
              this.messages[statusMessageIndex].text = `질문에 맞는 답변을 위해 SQL을 생성/수행하고 그 결과를 이용하여 답변을 업데이트 중입니다.${dots}`;
              this.$nextTick(() => { this.scrollToBottom(); });
            }, 1000); // 1초 간격으로 점 추가

            const sqlResult = await axios.get(`/api/sqlgen/execSqlQuery?sql=${encodeURIComponent(responseObj.SQL)}`);
            // 추가 프롬프트를 생성하여 SQL 결과를 자연어로 설명하도록 요청
            let systemPrompt = `Instructions: You are an expert and problem solver in the field of ${chatbotname}. You provide practical and realistic solutions to various issues and your answers should be factual. Your goal is to resolve problems effectively and efficiently. Analyze the situation, identify root causes, and suggest actionable steps. Your answers are based on the relevant information provided. Be clear, concise, and focused on solutions that are feasible and sustainable. Answers must be written in Korean, and should be clear and easy to understand. There is no character limit to your answer, so please explain in as much detail as possible.

            You should provide the answer in the following format:
            {
              "QueryResult": [{ "column1": "value1", "column2": "value2", ... }],
              "Summary": "Provide a concise summary of the SQL query result in plain text.",
            }
            Example Output:
            QueryResult: { "DAU": 28000, "IAP Revenue": 4200, "Average Session Duration": 20 }
            요약: "주말 동안 사용자 활동이 증가했으며, DAU와 IAP 수익이 크게 상승했습니다. 반면, 평균 세션 시간은 약간 감소했습니다."

            Context: 질문내용에 대해 SQL수행결과를 참고해서 답변해 주세요.
            질문내용: ${userMessage.text}
            SQL수행결과: ${JSON.stringify(sqlResult.data)}
            `;
            let userPrompt = userMessage.text;

            const messages = [{ role: 'system', content: systemPrompt },
                              { role: 'user', content: userPrompt }];
            const responseResultTxt = await this.createChat({ messages }, { temperature: this.temperature });

            let parsedResponseResultTxt = null;
            try {
              parsedResponseResultTxt = JSON.parse(responseResultTxt);  // 문자열을 객체로 변환
            } catch (error) {
              console.error('Error parsing JSON:', error);
            }

            let botMessage ='';
            if (parsedResponseResultTxt) {
              const { QueryResult, Summary } = parsedResponseResultTxt;
              // botMessage에 QueryResult, Summary를 저장하여 각각 표시
              botMessage = {
                // text: `\n${responseTxt}\n요약: ${Summary}\n시사점: ${Insights}`, // 요약은 텍스트로 표시
                text: `\n요약: ${Summary}`, // 요약은 텍스트로 표시
                isUser: false,
                timestamp: formatTimestamp(),
                queryResult: QueryResult || [] // QueryResult는 v-data-table에서 사용
              };
            } else {
              botMessage = { text: responseResultTxt, isUser: false, timestamp: formatTimestamp() };
            }
            clearInterval(intervalId); // Interval 중지
            this.messages.push(botMessage);
            this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤
            // Step 5: Save bot response
            console.log('botMessage.text : ', botMessage.text);
            await saveChatMessage(this.currentChatId, this.selectedModelName, botMessage.text, 'bot');
          }
          // **추가된 부분**: 요약 필요성 검토 및 요약 수행
          if (this.messages.length >= this.summaryThreshold) {
            const summaryMessages = [{ role: 'system', content: '이전 대화를 요약해 주세요.' }]
              .concat(this.messages.map(msg => ({
                role: msg.isUser ? 'user' : 'assistant',
                content: msg.text
              })));
            try {
              const summaryResponse = await this.createChat( { messages: summaryMessages }, { temperature: 0.5, top_p: 1.0 } );
              this.summary = summaryResponse; // 새로운 요약 저장
              // this.messages = []; // 요약 후 메시지 초기화
            } catch (error) {
              console.error('Error generating summary:', error);
            }
          }
        } catch (error) {
          console.error('Error handling message:', error);
          this.messages.push({ text: error.message, isUser: false, timestamp: formatTimestamp() });
          this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤
        } finally {
          document.body.style.cursor = 'default'; 
          this.isSQLGenerating = false;
        }
      }
    },
    async saveChatbot() {
      try {
          // 현재 채팅 이력 이후에 새로운 대화가 있었는지 확인
        const initialMessagesLength = this.initialMessages.length;
        const currentMessagesLength = this.messages.length;
        const hasNewMessages = (currentMessagesLength - 1) > initialMessagesLength;
        // 새로운 대화가 없는 경우에는 아무것도 하지 않음
        if (hasNewMessages) {
          const messages = [{ role: 'system', content: '다음 대화를 5단어 이하로 요약해주세요: ' + this.messages.map(msg => msg.text).join(' ') }];
          const summaryResponse = await this.createChat( { messages },  { temperature: 0.5, top_p: 1.0 } );
          const chatTitle = `${this.botnameRAG}:${summaryResponse}`;
          const lastMessageTime = new Date().toLocaleTimeString();
          const newChat = { time: lastMessageTime, messages: [...this.messages], title: chatTitle };
          // 새로운 채팅 이력을 만들고 네비게이션 바에 추가
          this.addActiveChat(newChat);
          this.emitter.emit('update-active-chats', this.activeChats);
          await axios.post('/api/chatbot/updateHistoryTitle', {
            chat_id: this.currentChatId,
            title: chatTitle
          });
          // 채팅이 성공적으로 저장된 후
          this.isChatSaved = true;
        }
      } catch (error) {
        console.error('Error saving chat:', error);
      }
    },
    async viewPdfDocument(fileName, page) {
      page = page.replace(/<[^>]+>/g, '').trim();

      const baseUrl = process.env.VUE_APP_API_BASE_URL;
      const uploadsPath = process.env.VUE_APP_UPLOADS_PATH;
      const url = `${baseUrl}${uploadsPath}/${fileName}#page=${page}`;

      window.open(url, '_blank');
    },
    generateHeaders(queryResult) {
      if (!queryResult || queryResult.length === 0) {
        console.error('queryResult가 비어 있습니다.');
        return [];
      }

      const firstItem = queryResult[0];
      const headers = Object.keys(firstItem).map(key => ({
        title: key.charAt(0).toUpperCase() + key.slice(1),  // 첫 글자를 대문자로 변환
        value: key,
      }));

      return headers;
    },
    transformQueryResult(queryResult) {
      if (!queryResult) return []; // queryResult가 null 또는 undefined인 경우 빈 배열 반환
      return Array.isArray(queryResult) ? queryResult : [queryResult];
    },
    handleKeydown(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
      }
    },
    handleKeyup(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        this.sendMessage();
      }
    },
    scrollToBottom() {
      scrollToBottom(this.$refs.chatContent);
    },
    formatMessage(text, isUser) {
      return formatMessage(text, isUser);
    }    
  }
};
</script>

<style scoped>

.assistant-view-title {
  padding: 20px;
  height: 50px;
  display: flex;
  /* justify-content: space-between; */
  align-items: center;
}

.custom-chip {
  align-items: center;
  height: 41px;
}

.custom-table{
  /* background-color: var(--card-background-color); 
  color: var(--text-highlight-color);  */
  font-weight: bold;
}

.custom-table-row td{
  /* background-color: var(--background-color); 
  color: var(--text-highlight-color);  */
  height: 40px !important; 
  border-bottom: 1px dashed #607D8B !important;
}


</style>
