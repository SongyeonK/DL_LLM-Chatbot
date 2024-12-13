<template>
  <v-container fluid class="pa-0">
    <v-row justify="center" no-gutters>
      <v-col :cols="12" class="assistant-view">
        <v-card>
          <v-card-title class="assistant-view-title">
            <v-col :cols="9">
              <v-container class="pa-0">
                <v-row class="fixed-height-row">
                  <v-col :cols="5">
                    <v-icon class="mr-2">mdi-database-alert</v-icon> SQL 생성 / 검수
                  </v-col>
                  <v-col :cols="5">
                    <v-radio-group inline v-model="sqlgenRadios">
                      <v-radio label="SQL생성" value="SQLGEN" color=var(--text-highlight-color) @change="sqlgenRadioChange('SQLGEN')"></v-radio>
                      <v-radio label="수행결과" value="RESULT" color=var(--text-highlight-color) @change="sqlgenRadioChange('RESULT')"></v-radio>
                      <v-radio label="SQL검수" value="SQLREVIEW" color=var(--text-highlight-color) @change="sqlgenRadioChange('SQLREVIEW')"></v-radio>
                    </v-radio-group>
                  </v-col>
                  <v-col :cols="2">
                    <v-select
                      v-model="selectedSchema"
                      :items="schemas"
                      density="compact"
                      item-title="USERNAME"
                      item-value="USER_ID"
                      label="스키마 선택"
                      class="custom-select-h50"
                      @change="setProfile"
                    ></v-select>
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
                          @click="saveChat" 
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
                        @click="viewPdfDocument(phrase.Page)"
                      >
                      <span class="custom-btn-w300">{{ phrase.Title }}</span>
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
            :disabled="!isSetProfiled"
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
    schemas: [],
    selectedSchema: '',
    cachedSchema: null,
    sqlgenRadios: "SQLGEN",
    sqlgenMode: "SQLGEN",
    isSetProfiled: false,
    topRow: 20,           // 벡터검색수 : 5개
    temperature: 0.1,    // chatbot은 사실에 근거한 답만을 제시하도록 세팅
    selectedModelId: null, // 선택된 모델을 저장하는 변수
    selectedModelName: null, // 선택된 모델을 저장하는 변수
    models: [],
    modelOptions: [],
    embedding_model: '', // 임베딩 모델 (벡터임베딩, 벡터서치에서 사용)

    input: '',
    messages: [],
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
    this.loadSchemas();   // DB 스키마 명 로드
  },
  mounted() {
    this.setProfile(); // 초기화 시 selectedPrompt 값을 설정
    this.messages.push({
      text: '안녕하세요! SQL 생성 또는 검수를 위한 화면입니다. 먼저 상단의 옵션과 대상 스키마를 선택하세요.',
      isUser: false,
      timestamp: formatTimestamp()  // 안전하게 this 접근
    });
  },
  watch: {
    selectedSchema() {
      this.setProfile();
    }
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
    async loadSchemas() {
      if (this.cachedSchema) {
        this.schemas = this.cachedSchema;
        return;
      }
      try {
        const response = await axios.get('/api/sqlgen/loadSchemas');
        this.schemas = response.data;
        this.cachedSchema = response.data;
      } catch (error) {
        console.error('Error loading Schemas config:', error);
      }
    },
    async setProfile() {
      if (this.selectedSchema) {
        try {
          // 프로필 저장 API 호출
          await axios.post('/api/sqlgen/setProfile', {
            schema: this.selectedSchema
          });
          this.isSetProfiled = true;
          // schemaTables 엔드포인트 호출
          const response = await axios.get(`/api/sqlgen/schemaTables?schema=${this.selectedSchema}`);
          // response.data가 배열인지 확인하고, 줄바꿈으로 연결
          const formattedTableInfo = Array.isArray(response.data) ? response.data.join('\n') : response.data;
          // 봇 메시지로 출력
          if (this.sqlgenMode === 'SQLGEN' || this.sqlgenMode === 'RESULT') {
            this.messages.push({ text: `${this.selectedSchema} 테이블은 다음과 같습니다. 테이블 정보를 참고해서 SQL생성을 위한 자연어를 입력하세요.\n${formattedTableInfo}`, isUser: false, timestamp: formatTimestamp() });
          } else if (this.sqlgenMode === 'SQLREVIEW') {
            this.messages.push({ text: `${this.selectedSchema} 테이블은 다음과 같습니다. 테이블 정보를 참고해서 SQL검수를 받기 위한 SQL구문을 입력하세요.\n${formattedTableInfo}`, isUser: false, timestamp: formatTimestamp() });
          }
          this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤
        } catch (error) {
          console.error('Error setting profile:', error);
          this.messages.push({ text: '프로필 설정 중 오류가 발생했습니다.', isUser: false, timestamp: formatTimestamp() });
          this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤
        }
      }
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
        this.messages.push({ text: '스키마 조회 중입니다.', isUser: false, timestamp: formatTimestamp() });
        this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤
        // 진행 상황을 업데이트할 인덱스 저장 (마지막 메시지 인덱스)
        const statusMessageIndex = this.messages.length - 1;

        try {
          // Step 1-1: Save 채팅 방
          if (!this.currentChatId) {
            const { chatId, chatRoomId } = await saveChatRoom();
            this.currentChatId = chatId;
            this.currentChatRoomId = chatRoomId;
          }
          // Step 1-2: Save user message
          const username = process.env.VUE_APP_DEFAULT_USERNAME;
          await saveChatMessage(this.currentChatId, username, userMessage.text, 'user');
          let systemPrompt;
          let relevantInformation;
          // getTableInfo, getConstInfo 호출
          const tableInfoResponse = await axios.get(`/api/sqlgen/getTableInfo?profile=${this.selectedSchema}`);
          const tableInfo = JSON.stringify(tableInfoResponse.data);
          const constInfoResponse = await axios.get(`/api/sqlgen/getConstInfo?profile=${this.selectedSchema}`);
          const constInfo = JSON.stringify(constInfoResponse.data);

          // console.log('this.selectedSchema : ', this.selectedSchema);
          if (this.sqlgenMode === 'SQLGEN') {
            //  systemPrompt = `def generate_sql_query(user_question: str, table_info: dict, const_info: dict) -> dict:
            // # 간단한 SQL 쿼리 생성 로직
            // user_question = "챗봇은 몇개인가요?"
            // table_info = ${tableInfo}
            // const_info = ${constInfo}
            // generated_sql_query = "SELECT COUNT(*) FROM DOCCHAT.AIVS_CHATBOTS;"
            // return {
            //     "user_query": user_question,
            //     "sql_query": generated_sql_query
            // }`;
            systemPrompt = `Instructions: You are an Oracle SQL expert. Given an input question, first create a syntactically correct Oracle SQL query to run. You must query only the columns that are needed to answer the question. Pay attention to use only the column names you can see in the tables below. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table. And be sure to include the owner name in front of the table name. (e.g. owner name.table name) And note that Oracle SQL syntax does not explicitly add the schema name to the column names. Additionally, the 'generated SQL query' must be formatted to improve the readability of the SQL query.
            You should provide the answer in JSON format, without including the keyword 'json'.
            { 
              "사용자질의": "질문 내용", 
              "GEN_SQL": "생성된 SQL 쿼리" 
            }
            Context: Please use only the following tables and columns. If your question is not related to a table, mark it as "N/A".
            Tables information: ${tableInfo}
            Primary Keys and Foreign Keys: ${constInfo}`;
            relevantInformation = '';
          } else if (this.sqlgenMode === 'RESULT') {
            systemPrompt = `Instructions: You are an Oracle SQL expert. Given an input question, first create a syntactically correct Oracle SQL query to run. You must query only the columns that are needed to answer the question. Pay attention to use only the column names you can see in the tables below. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table. And be sure to include the owner name in front of the table name. (e.g. owner name.table name) And note that Oracle SQL syntax does not explicitly add the schema name to the column names. You should provide the answer in JSON format, without including the keyword 'json'.
            { 
              "사용자질의": "질문 내용", 
              "GEN_SQL": "생성된 SQL 쿼리" 
            }
            Context: Please use only the following tables and columns. If your question is not related to a table, mark it as "N/A".
            Tables information: ${tableInfo}
            Primary Keys and Foreign Keys: ${constInfo}`;
            relevantInformation = '';
          } else if (this.sqlgenMode === 'SQLREVIEW') {
            systemPrompt = `Instructions: You are an Oracle SQL expert. Your task is to review the given SQL query for correctness, efficiency, and best practices based on the provided SQL standard. Provide suggestions for improvement if necessary.

            You should provide the answer in JSON format, without including the keyword 'json'.
            { 
              "Input SQL": "입력된 SQL 문", 
              "Reviewed SQL": "제공된 SQL 표준을 근거로, 수정/보완된 SQL",
              "수정 근거": "SQL이 수정된 근거, SQL이 수정된 근거가 되는 관련 SQL 표준 문구",
              "RelatedPhrases": [
                {
                  "Title": "SQL 표준의 관련 섹션 제목 (섹션 번호 포함)",
                  "Page": "해당 섹션의 페이지 번호"
                },
                {
                  "Title": "SQL 표준의 관련 섹션 제목 (섹션 번호 포함)",
                  "Page": "해당 섹션의 페이지 번호"
                }
              ]
            }

            Context: Review the provided SQL statement using the table information (table and column) and PK/FK provided below. The review must be strictly based on the SQL standard provided. The reviewed SQL must not be modified based on imagination or inference, only on facts from the SQL standard.

            Important guidelines:
            1. Each "수정 근거" must have at least one corresponding RelatedPhrase.
            2. The RelatedPhrases must directly correspond to the "수정 근거" and contain the exact section title (including section number) and page number from the SQL standard that support the revision.
            3. The section title and page number of the SQL standard document are enclosed in <title></title> and <page></page> tags, respectively. Extract them exactly as they appear in the document.
            4. Provide the reason for modification in Korean.
            5. If the query does not significantly violate the SQL standard, do not provide review results or a reviewed SQL statement.

            Tables information: ${tableInfo}
            PK(Primary Keys) and FK(Foreign Keys): ${constInfo}`;

            relevantInformation = 'Here is some relevant information to help you with your questions : \n';
            // Step 2: Perform vector search
            this.messages[statusMessageIndex].text = 'SQL표준을 조회 중입니다.';
            this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤
            const vsearchResponse = await axios.post('/api/chatbot/mvsearch', {
              file_name: 'SQL검수',
              embedding_model: this.embedding_model,
              question: userMessage.text,
              top_row: this.topRow
            });
            // 검수대상 SQL과의 유사도 검색결과를 반영한 context를 생성
            relevantInformation += `\n SQL standards : \n`;
            relevantInformation += vsearchResponse.data.map(doc => doc[1]).join('\n');
            // console.log('relevantInformation : ', relevantInformation);
            // SQL 리뷰이력결과를 context에 추가
            const response = await axios.get('/api/config/loadSQLReviewHistories', { params: { reviewType: 'SQL검수' } });
            // JSON 문자열을 파싱하여 객체로 변환
            this.reviewHistories = response.data.map(item => { return { ...item, CONTENT: JSON.parse(item.CONTENT) }; });
            relevantInformation += `\n SQL Review History data : \n`;
            relevantInformation += JSON.stringify(this.reviewHistories, null, 2);
          }
          
          // Step 3: 답변 생성 중
          let initialMessage = 'SQL을 생성 중입니다.';
          if (this.sqlgenMode === 'SQLREVIEW') { initialMessage = 'SQL을 검수 중입니다.'; }

          this.messages[statusMessageIndex].text = initialMessage;
          this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤

          // 점 추가를 위한 Interval 설정
          let dotCount = 0;
          const maxDots = 5;
          const intervalId = setInterval(() => {
            dotCount = (dotCount + 1) % (maxDots + 1);
            const dots = '.'.repeat(dotCount);
            this.messages[statusMessageIndex].text = `${initialMessage}${dots}`;
            this.$nextTick(() => { this.scrollToBottom(); });
          }, 1000); // 1초 간격으로 점 추가

          // Step 3-1: 봇과의 채팅
          const messages = [{ role: 'system', content: systemPrompt },
                            { role: 'user', content: relevantInformation },
                            { role: 'user', content: userMessage.text }];
          // console.log('messages : ', messages);
          const responseTxt = await this.createChat({ messages }, { temperature: this.temperature });
          let botMessage = { text: `\n${responseTxt}`, isUser: false, timestamp: formatTimestamp() };

          clearInterval(intervalId); // Interval 중지

          if (this.sqlgenMode === 'SQLGEN') {
            this.messages.push(botMessage);
            this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤
          } else if (this.sqlgenMode === 'RESULT') {
            // Step 4: Extract and execute generated SQL
            const responseObj = JSON.parse(responseTxt);
            if (responseObj.GEN_SQL) {
              console.log('responseObj.GEN_SQL : ', responseObj.GEN_SQL);
              try {
                this.messages[statusMessageIndex].text = '쿼리를 수행 중입니다.';
                this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤

                // 점 추가를 위한 Interval 설정
                let dotCount = 0;
                const maxDots = 5;
                const intervalId = setInterval(() => {
                  dotCount = (dotCount + 1) % (maxDots + 1);
                  const dots = '.'.repeat(dotCount);
                  this.messages[statusMessageIndex].text = `쿼리를 수행 중입니다.${dots}`;
                  this.$nextTick(() => { this.scrollToBottom(); });
                }, 1000); // 1초 간격으로 점 추가

                const sqlResult = await axios.get(`/api/sqlgen/execSqlQuery?sql=${encodeURIComponent(responseObj.GEN_SQL)}`);
                // 추가 프롬프트를 생성하여 SQL 결과를 자연어로 설명하도록 요청
                let systemPrompt = `Instructions: You are an expert in transforming SQL query results into detailed and natural language explanations in Korean. Your task is to interpret the SQL query results by providing a comprehensive and insightful summary in Korean. In your summary, ensure that you place equal importance on both the user's original query and the SQL execution results. When deriving implications, carefully consider how both the user's query and the query results contribute to the insights. 
                Your response should be structured as follows: 
                1. Provide a clear and concise summary of the SQL query results in Korean, while explicitly addressing the user's original query. The summary should be in plain text format. 
                2. Derive implications or potential actions by taking into account both the user’s query and the query results, presented as key insights in plain text format. 
                3. The query results should be provided in JSON format(without including the keyword 'json'.), as this allows flexible rendering into a table using Vue.js components, D3.js, or other visualization tools.
                                
                You should provide the answer in the following format:
                {
                  "QueryResult": [{ "column1": "value1", "column2": "value2", ... }],
                  "Summary": "Provide a concise summary of the SQL query result in plain text.",
                  "Insights": "Provide key insights derived from the SQL query result in plain text."
                }
                Example Output:
                QueryResult: { "DAU": 28000, "IAP Revenue": 4200, "Average Session Duration": 20 }
                요약: "주말 동안 사용자 활동이 증가했으며, DAU와 IAP 수익이 크게 상승했습니다. 반면, 평균 세션 시간은 약간 감소했습니다."
                시사점: "사용자 활동이 활발해지면 세션 시간이 줄어들지만, 그 대신 자주 접속하는 경향이 있습니다. 수익과 사용자 활동에 긍정적인 영향을 미칩니다."

                Context: The summary and key insights should be in clear, concise, and natural Korean language. The SQL query results should be provided in JSON format for easy integration into visualization components.

                사용자질의: ${userMessage.text}
                SQL수행결과: ${JSON.stringify(sqlResult.data)}
                `;
                let userPrompt = 'SQL 수행결과를 한국어 자연어로 설명해주세요.';

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
                  const { QueryResult, Summary, Insights } = parsedResponseResultTxt;
                  // botMessage에 QueryResult, Summary, Insights를 저장하여 각각 표시
                  botMessage = {
                    // text: `\n${responseTxt}\n요약: ${Summary}\n시사점: ${Insights}`, // 요약 및 시사점은 텍스트로 표시
                    text: `\n요약: ${Summary}\n시사점: ${Insights}`, // 요약 및 시사점은 텍스트로 표시
                    isUser: false,
                    timestamp: formatTimestamp(),
                    queryResult: QueryResult || [] // QueryResult는 v-data-table에서 사용
                  };
                } else {
                  botMessage = { text: `\n${responseTxt}` + '\n' + responseResultTxt, isUser: false, timestamp: formatTimestamp() };
                }
                clearInterval(intervalId); // Interval 중지
                this.messages.push(botMessage);
                this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤
              } catch (error) {
                console.error('Error executing SQL query:', error);
                clearInterval(intervalId); // Interval 중지
                this.messages.push({ text: 'SQL 쿼리 실행에 실패했습니다.', isUser: false, timestamp: formatTimestamp() });
                this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤
              }
            } else {
              clearInterval(intervalId); // Interval 중지
              this.messages.push({ text: 'SQL 생성에 실패했습니다.', isUser: false, timestamp: formatTimestamp() });
              this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤
            }
          } else if (this.sqlgenMode === 'SQLREVIEW') {
            let parsedResponseTxt = null;
            try {
              parsedResponseTxt = JSON.parse(responseTxt);  // 문자열을 객체로 변환
            } catch (error) {
              console.error('Error parsing JSON:', error);
            }

            // "RelatedPhrases" 속성을 제외한 나머지 데이터로 botMessage.text를 생성
            let botMessage ='';
            console.log('responseTxt : ', responseTxt);
            if (parsedResponseTxt) {
              // RelatedPhrases 속성을 제거
              let responseTxtWithoutRelatedPhrases = { ...parsedResponseTxt };
              delete responseTxtWithoutRelatedPhrases["RelatedPhrases"];

              // 나머지 데이터를 문자열로 변환하여 botMessage.text에 사용
              botMessage = {
                text: `\n${JSON.stringify(responseTxtWithoutRelatedPhrases, null, 2)}`, // JSON을 보기 좋게 포맷
                isUser: false,
                timestamp: formatTimestamp(),
                relatedPhrases: parsedResponseTxt["RelatedPhrases"] || []
              };
            } else {
              botMessage = { text: responseTxt, isUser: false, timestamp: formatTimestamp() };
            }
            this.messages.push(botMessage);
            this.$nextTick(() => { this.scrollToBottom(); });
            // 이력 테이블에 인서트
            const reviewData = { document_id: null, type: 'SQL검수', user_id: this.selectedModelName, content: JSON.stringify(botMessage.text) };
            try {
              await axios.post('/api/config/saveReview', reviewData);
            } catch (error) {
              console.error('Error saving review:', error);
              this.messages.push({ text: '이력 저장에 실패했습니다.', isUser: false, timestamp: formatTimestamp() });
              this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤
              return;
            }
          }
          // Step 5: Save bot message
          await saveChatMessage(this.currentChatId, this.selectedModelName, botMessage.text, 'bot');
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
    async saveChat() {
      try {
        // 현재 채팅 이력 이후에 새로운 대화가 있었는지 확인
        const initialMessagesLength = this.initialMessages.length;
        const currentMessagesLength = this.messages.length;
        const hasNewMessages = (currentMessagesLength - 1) > initialMessagesLength;
        // 새로운 대화가 없는 경우에는 아무것도 하지 않음
        if (hasNewMessages) {
          const messages = [{ role: 'system', content: '다음 대화를 5단어 이하로 요약해주세요: ' + this.messages.map(msg => msg.text).join(' ') }];
          const summaryResponse = await this.createChat( { messages }, { temperature: 0.5 } ); // 요약은 낮은 temperature로 설정
          const chatTitle = summaryResponse;
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
    sqlgenRadioChange(value) {
      this.sqlgenMode = value;
      this.selectedSchema = '';
    },
    async viewPdfDocument(page) {
      // 서버에서 PDF 파일 경로를 받아서 표시
      const docClass = 'SQL검수';
      const response = await axios.get('/api/config/getPdfFile', {  params: { docClass: docClass } });
      const fileName = response.data.length > 0 ? response.data[0].DOC_FILENAME : null;
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
    },
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

.bubble {
  max-width: 80%;
  padding: 10px;
  border-radius: 10px;
  margin: 5px;
  display: inline-block;
  font-family: "Courier New", Courier, monospace;
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
