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
                    <v-icon class="mr-2">mdi-chat-plus</v-icon> 기본 채팅
                  </v-col>
                  <v-col :cols="3">
                    <v-select
                      v-model="selectedType"
                      :items="contactType"
                      label="대화상대 유형"
                      density="compact"
                      class="custom-select-h50"
                      @change="updatePrompt"
                    ></v-select>
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
                  <v-col cols="2">
                    <v-text-field
                      v-model.number="topP"
                      label="top-p"
                      density="compact"
                      type="number" min="0.0" max="1.0" :step="0.1"
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
                <div :class="['bubble', message.isUser ? 'user-bubble' : 'bot-bubble']" v-html="formatMessage(message.text, message.isUser)">
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
import { getLLMConfig, setDefaultModel, deleteNullChat, formatMessage, formatTimestamp, saveChatRoom, saveChatMessage, scrollToBottom } from "../apiService";

export default {
  data: () => ({
    contactType: ['친구 유형', '멘토 유형', '교수 유형', '비평가 유형', '코치 유형', 
                  '문제해결사 유형', '스토리텔러 유형', '연구자 유형', '토론자 유형', '엔터테이너 유형'],
    selectedType: '친구 유형',
    selectedPrompt: [],
    prompts: {
      '친구 유형': `
        You are a friendly companion. You listen with empathy and respond warmly. 
        Your goal is to provide emotional support and understanding. 
        Engage in light-hearted conversation, offer comfort, and show genuine interest in the user's feelings and experiences.
        Encourage them to share their thoughts and emotions freely.
      `,
      '멘토 유형': `
        You are a mentor. You provide advice and guidance, drawing from your extensive experience and knowledge. 
        Your goal is to help the user achieve personal and professional growth. 
        Offer constructive feedback, suggest actionable steps, and inspire confidence. 
        Be patient, supportive, and challenge them to reach their full potential.
      `,
      '교수 유형': `
        You are an educator. You explain complex topics in simple, understandable terms. 
        Your goal is to facilitate learning and deepen the user's understanding. 
        Use examples, analogies, and step-by-step explanations to clarify concepts. 
        Encourage questions and promote critical thinking.
      `,
      '비평가 유형': `
        You are a critic. You analyze and provide critical insights into various subjects. 
        Your goal is to offer different perspectives and stimulate thoughtful discussion. 
        Be objective, articulate your opinions clearly, and back them up with evidence. 
        Encourage the user to consider multiple viewpoints and engage in a healthy debate.
      `,
      '코치 유형': `
        You are a coach. You motivate and challenge the user to achieve their goals. 
        Your goal is to maximize their potential and drive improvement. 
        Offer positive reinforcement, set achievable targets, and provide constructive feedback. 
        Encourage persistence, resilience, and a growth mindset.
      `,
      '문제 해결사 유형': `
        You are a problem solver. You provide practical and realistic solutions to various issues. 
        Your goal is to resolve problems effectively and efficiently. 
        Analyze the situation, identify root causes, and suggest actionable steps. 
        Be clear, concise, and focused on solutions that are feasible and sustainable.
      `,
      '스토리텔러 유형': `
        You are a storyteller. You convey information through engaging and vivid stories. 
        Your goal is to entertain and inform the user. 
        Use descriptive language, create relatable characters, and build captivating narratives. 
        Make the information memorable by weaving it into a compelling story.
      `,
      '연구자 유형': `
        You are a researcher. You provide in-depth analysis and data-driven insights on various topics. 
        Your goal is to offer thorough and accurate information. 
        Present well-researched facts, cite credible sources, and explain methodologies. 
        Help the user understand the broader context and significance of the data.
      `,
      '토론자 유형': `
        You are a debater. You engage in discussions from various angles and encourage critical thinking. 
        Your goal is to foster deep conversations and broaden the user's perspective. 
        Present arguments logically, challenge assumptions, and respond thoughtfully to counterarguments. 
        Promote respectful and constructive dialogue.
      `,
      '엔터테이너 유형': `
        You are an entertainer. You use humor, wit, and engaging dialogue to make the interaction enjoyable. 
        Your goal is to lighten the mood and provide amusement. 
        Share funny anecdotes, clever jokes, and playful banter. 
        Keep the conversation lively and ensure the user has a good time.
      `
    },
    temperature: 0.7,
    topP: 0.9,

    selectedModelId: null, // 선택된 모델을 저장하는 변수
    selectedModelName: null, // 선택된 모델을 저장하는 변수
    models: [],
    modelOptions: [],   // 모델 옵션을 저장하는 배열

    input: '',
    messages: [],
    summary: '', // 요약 내용을 저장
    summaryThreshold: 10, // 요약을 수행할 메시지 개수 임계값

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
    this.emitter.on('load-chat', this.loadChat);
    this.emitter.on('start-new-chat', this.startNewChat);
  },
  mounted() {
    this.updatePrompt(); // 초기화 시 selectedPrompt 값을 설정
    this.messages.push({
      text: '안녕하세요! 오늘은 무엇을 도와드릴까요?',
      isUser: false,
      timestamp: formatTimestamp()  // 안전하게 this 접근
    });
  },
  beforeUnmount() {
    this.emitter.off('load-chat', this.loadChat);
    this.emitter.off('start-new-chat', this.startNewChat);
  },
  watch: {
    selectedType() {
      this.updatePrompt();
    }
  },
  methods: {
    ...mapActions(['setActiveChats', 'addActiveChat', 'initializeApiClient', 'createChat']),
    async loadLLMConfig() {
      try {
        const data = await getLLMConfig();
        this.models = data.models;
        const defaultModel = data.models.find(model => model.DEFAULT_MODEL_YN === 'Y');
        
        if (defaultModel) {
          this.selectedModelId = defaultModel.MODEL_ID;
          this.selectedModelName = defaultModel.MODEL_NAME;
          this.modelOptions = data.options.filter( option => option.MODEL_ID === this.selectedModelId );
          this.temperature = this.modelOptions.find(option => option.OPTION_NAME === 'temperature')?.OPTION_VALUE;
          this.topP = this.modelOptions.find(option => option.OPTION_NAME === 'top_p')?.OPTION_VALUE;
        } else {
          console.error('No default model found');
        }
      } catch (error) {
        console.error('Error loading LLM config:', error);
      }
    },
    async updateModel() {
      await this.initializeApiClient(this.selectedModelId);
      setDefaultModel(this.selectedModelId); // 모델을 디폴트로 설정하는 메소드 호출
      this.loadLLMConfig();
    },
    async startNewChat() {
      this.currentChatId = null;
      this.currentChatRoomId = null;
      this.messages = [{ text: '안녕하세요! 오늘은 무엇을 도와드릴까요?', isUser: false, timestamp: formatTimestamp() }];
      this.initialMessages = [...this.messages]; // 초기 메시지 배열 업데이트
    },
    updatePrompt() {
      this.selectedPrompt = this.prompts[this.selectedType];
      // console.log('selectedPrompt : ', this.selectedPrompt);
    },
    async sendMessage() {
      if (this.input.trim()) {
        const userMessage = { text: this.input, isUser: true, timestamp: formatTimestamp() };
        // const userMessage = { text: this.input, isUser: true, user_id: process.env.VUE_APP_DEFAULT_USERNAME, role: 'user' };
        this.messages.push(userMessage);
        this.input = '';
        this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤

        document.body.style.cursor = 'progress'; 
        this.isSQLGenerating = true;

        try {
          const systemPrompt = `Instructions: You are a ${this.selectedType} of conversation partner. ${this.selectedPrompt} Answers must be in Korean.`;
          // Step 1: Save 채팅 방
          if (!this.currentChatId) {
            const { chatId, chatRoomId } = await saveChatRoom();
            this.currentChatId = chatId;
            this.currentChatRoomId = chatRoomId;
          }
          // Step 2: Save user message
          const username = process.env.VUE_APP_DEFAULT_USERNAME;
          await saveChatMessage(this.currentChatId, username, userMessage.text, 'user');
          // **수정된 부분**: systemPrompt 및 요약을 포함한 메시지 전송
          // systemPrompt 추가 : 최근 대화 10개 포함
          let contextMessages = [{
            role: (this.selectedModelName === 'mistralai/Mistral-7B-Instruct-v0.3' || this.selectedModelName === 'mistralai/Mistral-7B-Instruct-v0.2') ? 'user' : 'system', 
            content: systemPrompt 
          }];
          if (this.summary) {
            contextMessages.push({
              role: (this.selectedModelName === 'mistralai/Mistral-7B-Instruct-v0.3' || this.selectedModelName === 'mistralai/Mistral-7B-Instruct-v0.2') ? 'user' : 'system', 
              content: this.summary 
            });
          }
          contextMessages = contextMessages.concat(
            this.messages.slice(-10).map(msg => ({ role: msg.isUser ? 'user' : 'assistant', content: msg.text}))
          );
          // Step 3: 봇과의 채팅
          const response = await this.createChat( { messages: contextMessages }, { temperature: this.temperature, top_p: this.topP } );
          const botMessage = { text: response, isUser: false, timestamp: formatTimestamp() };
          this.messages.push(botMessage);
          this.$nextTick(() => { this.scrollToBottom(); }); // DOM 업데이트 후 스크롤

          // Step 4: Save bot message
          await saveChatMessage(this.currentChatId, this.selectedModelName, botMessage.text, 'bot');
          // **수정된 부분**: 요약 필요성 검토 및 요약 수행
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
          // this.messages.push({ text: 'Sorry, something went wrong.', isUser: false, timestamp: formatTimestamp() });
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
          const summaryResponse = await this.createChat( { messages }, { temperature: 0.5, top_p: 1.0 } );
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
    async loadChat(index) {
      const chat = this.activeChats[index];
      if (chat) {
        this.currentChatId = chat.chat_id;
        this.currentChatRoomId = chat.chat_room_id;

        try {
          const response = await axios.get('/api/chatbot/loadChat', {
            params: { chat_room_id: this.currentChatRoomId }
          });
          if (response.data.length > 0) {
            this.messages = response.data.map(msg => ({
              text: msg.CONTENT,
              isUser: msg.ROLE === 'user'
            }));
            this.initialMessages = [...this.messages]; // 초기 메시지 배열 설정
            this.$nextTick(() => {
              this.scrollToBottom();
            });
          }
        } catch (error) {
          console.error('Error fetching chat messages:', error);
        }
      } else {
        console.error('Selected chat does not have a valid messages array:', chat);
      }
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

</style>
