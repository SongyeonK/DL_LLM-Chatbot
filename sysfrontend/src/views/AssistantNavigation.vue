<template>
  <v-container class="grey lighten-3">
    <v-card class="mx-auto" max-width="100%">
      <v-navigation-drawer
        color=var(--navigation-background-color)
        v-model="menuDrawer"
        app
        width="250"
        overlay-opacity="0"
        style="margin-top: 50px; border-right: 1px solid rgba(224, 224, 224, 0.5); height: 95%;"
      >
        <v-card min-height="20vh" color=var(--navigation-background-color)>
          <v-list v-model:opened="openedGroups">
            <v-list-group value="group1">
              <template v-slot:activator="{ props }">
                <v-list-item 
                  v-bind="props" 
                  class="custom-list-item2"
                  prepend-icon="mdi-assistant" 
                  title="Assistant"
                ></v-list-item>
              </template>
              <v-list-item
                v-for="(item, i) in AssistantItems"
                :key="i"
                :prepend-icon="item.icon"
                :title="item.text"
                :value="item.text"
                class="custom-list-item"
                color=var(--text-highlight-color)
                rounded="xl"
                @click="item.text === '기본 채팅' ? startNewChat() : goToPage(item.path)"
              ></v-list-item>
            </v-list-group>
            
            <v-divider class="mx-3"></v-divider>

            <v-list-group value="group2">
              <template v-slot:activator="{ props }">
                <v-list-item 
                  v-bind="props"
                  class="custom-list-item2"
                  prepend-icon="mdi-robot-love" 
                  title="Chatbots"
                ></v-list-item>
              </template>
              <div v-for="(chatbot, i) in botItems" :key="i">
                <v-tooltip location="top" :text="`${chatbot.botname} : ${chatbot.filename}`">
                  <template v-slot:activator="{ props }">
                    <v-list-item
                      :title="`${chatbot.botname} : ${chatbot.filename}`"
                      :value="chatbot.botname"
                      v-bind="props"
                      class="custom-list-item2"
                      color=var(--text-highlight-color)
                      rounded="shaped"
                      @click="startNewChatbot(i)"
                    >
                    <template v-slot:append>
                        <v-tooltip location="right" text="챗봇 삭제">
                          <template v-slot:activator="{ props }">
                            <v-btn
                              icon="mdi-delete-off"
                              variant="text"
                              v-bind="props"
                              @click="openBotDeleteDialog(chatbot.botname, i)"
                            ></v-btn>
                          </template>
                        </v-tooltip>
                      </template>
                    </v-list-item>
                  </template>
                </v-tooltip>
              </div>
            </v-list-group>

            <v-divider class="mx-3"></v-divider>

            <v-list-group value="group3">
              <template v-slot:activator="{ props }">
                <v-list-item 
                  v-bind="props"
                  class="custom-list-item2"
                  prepend-icon="mdi-wechat"
                  title="Chat Histories"
                ></v-list-item>
              </template>
              <div v-for="(chat, i) in activeChats" :key="i">
                <v-tooltip location="top" :text="chat.title">
                  <template v-slot:activator="{ props }">
                    <v-list-item
                      :title="chat.title"
                      :value="chat.title"
                      :class="[{ 'v-list-item--disabled': !isChattingView }, 'custom-list-item2']"
                      v-bind="props"
                      color=var(--text-highlight-color)
                      rounded="shaped"
                      @click=loadChat(i)
                    >
                      <template v-slot:append>
                        <v-tooltip location="right" text="챗 목록 삭제">
                          <template v-slot:activator="{ props }">
                            <v-btn
                              icon="mdi-delete-off"
                              variant="text"
                              v-bind="props"
                              @click="openChatDeleteDialog(chat.title, i)"
                            ></v-btn>
                          </template>
                        </v-tooltip>
                      </template>
                    </v-list-item>
                  </template>
                </v-tooltip>
              </div>
            </v-list-group>
          </v-list>
        </v-card>
      </v-navigation-drawer>
    </v-card>

    <!-- Bot 삭제 확인 다이얼로그 -->
    <v-dialog v-model="botDeleteDialog" max-width="500">
      <v-card>
        <v-card-title class="headline">선택한 챗봇을 정말 삭제 할까요?</v-card-title>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" text @click="botDeleteDialog = false">취소</v-btn>
          <v-btn color="blue darken-1" text @click="confirmDeleteBot">확인</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Chat 삭제 확인 다이얼로그 -->
    <v-dialog v-model="chatDeleteDialog" max-width="500">
      <v-card>
        <v-card-title class="headline">선택한 채팅 이력을 정말 삭제 할까요?</v-card-title>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" text @click="chatDeleteDialog = false">취소</v-btn>
          <v-btn color="blue darken-1" text @click="confirmDeleteChat">확인</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
import { mapActions, mapGetters } from "vuex";
import axios from 'axios';

export default {
  computed: {
    ...mapGetters(['getActiveChats', 'getBotItems']),
    activeChats() {
      return this.getActiveChats;
    },
    botItems() {
      return this.getBotItems;
    }
  },
  data: () => ({
    menuDrawer: true,
    openedGroups: ['group1'],
    isChattingView: false,                              // 현재 ChattingView 상태를 추적
    AssistantItems: [
      { text: '기본 채팅', icon: 'mdi-chat-plus', active: true, path: '/assistant/chatting' },
      { text: '쿼리 생성', icon: 'mdi-database-alert', active: true, path: '/assistant/gensql' },
    ],
    chatDeleteDialog: false,                            // Chat 삭제 확인 다이얼로그 표시 여부
    selectedChatTitle: '',                              // 삭제할 채팅 제목
    selectedChatIndex: null,                            // 삭제할 채팅 인덱스
    botDeleteDialog: false,                             // Bot 삭제 확인 다이얼로그 표시 여부
    selectedBotName: '',                               // 삭제할 Bot 이름
    selectedBotIndex: null,                             // 삭제할 Bot 인덱스
    // botItems: [],                                    // 새로 추가된 커스텀 챗봇 목록
  }),
  created() {
    this.loadBotItems();                              // 기존 봇 리스트 불러오기
    this.emitter.on('update-bot-items', (botItems) => {
      this.setBotItems(botItems);
    });
    this.loadChatHistories();                          // 기존 채팅 이력 불러오기
    this.emitter.on('update-active-chats', (activeChats) => {
      this.setActiveChats(activeChats);
    });
    this.startNewChat();
  },
  methods: {
    ...mapActions(['navigateTo', 'setActiveChats', 'setBotItems']),
    goToPage(path) {
      this.navigateTo(path);
      this.isChattingView = (path === '/assistant/chatting');
    },
    startNewChat() {
      this.emitter.emit('start-new-chat');    // ChattingView.vue로 이벤트 전달
      this.navigateTo('/assistant/chatting');      // 일반 채팅 페이지로 라우팅 추가
      this.isChattingView = true;             // ChattingView 상태로 변경
    },
    startNewChatbot(index) {
      const RAGbotname = this.botItems[index].botname;
      const RAGfilename = this.botItems[index].filename;

      this.$router.push({ name: 'chatbot', params: { botname: RAGbotname, filename: RAGfilename  } }); // 커스텀 챗봇 채팅 페이지로 라우팅 추가
      this.isChattingView = false;            // 커스텀 챗봇 채팅 페이지에서는 false로
    },
    loadChat(index) {
      if (!this.isChattingView) return;       // ChattingView가 아닌 경우 클릭 무시
      this.loadChatHistories();               // 기존 채팅 이력 불러오기
      this.emitter.emit('load-chat', index);  // ChattingView.vue로 이벤트 전달
    },
    // DB에서 채팅이력 데이터 불러와서 vuex에 로드하기
    async loadBotItems() {
      try {
        const response = await axios.get('/api/chatbot/loadBots');

        const botLists = response.data.map(bot => {
          return {
            bot_id: bot.BOT_ID,
            botname: bot.BOT_NAME,
            filename: bot.DOC_FILENAME,
            // messages: [] 
          };
        });
        this.setBotItems(botLists);
      } catch (error) {
        console.error('Error loading bot Lists:', error);
      }
    },
    // DB에서 채팅이력 데이터 불러와서 vuex에 로드하기
    async loadChatHistories() {
      try {
        const response = await axios.get('/api/chatbot/loadHistories');

        const chatHistories = response.data.map(chat => {
          return {
            chat_id: chat.CHAT_ID,
            chat_room_id: chat.CHAT_ROOM_ID,
            title: chat.TITLE,
            messages: [] 
          };
        });
        this.setActiveChats(chatHistories);
      } catch (error) {
        console.error('Error loading chat histories:', error);
      }
    },
    // Bot 삭제 다이얼로그 열기
    openBotDeleteDialog(bot_name, index) {
      this.selectedBotName = bot_name;
      this.selectedBotIndex = index;
      this.botDeleteDialog = true;
    },
    // Bot 삭제 확인 및 실행
    async confirmDeleteBot() {
      this.botDeleteDialog = false;

      try {
        const response = await axios.delete('/api/chatbot/deleteBot', { 
          data: { bot_name: this.selectedBotName } 
        });

        if (response.status === 200) {
          // Vuex 상태에서 삭제
          this.botItems.splice(this.selectedBotIndex, 1);
          this.setBotItems(this.botItems);
        }
      } catch (error) {
        console.error('Error deleting chat data:', error);
      }
    },
    // Chat 삭제 다이얼로그 열기
    openChatDeleteDialog(title, index) {
      this.selectedChatTitle = title;
      this.selectedChatIndex = index;
      this.chatDeleteDialog = true;
    },
    // Chat 삭제 확인 및 실행
    async confirmDeleteChat() {
      this.chatDeleteDialog = false;
      try {
        const response = await axios.delete('/api/chatbot/deleteChat', { 
          data: { title: this.selectedChatTitle } 
        });

        if (response.status === 200) {
          // Vuex 상태에서 삭제
          this.activeChats.splice(this.selectedChatIndex, 1);
          this.setActiveChats(this.activeChats);
        }
      } catch (error) {
        console.error('Error deleting chat data:', error);
      }
    },
  }
};
</script>

<style>
.custom-list-item {
  margin-left: -20px !important; 
  /* margin-right: -20px !important;  */
}

.custom-list-item .v-list-item__content {
  margin-left: -20px !important; /* 특정 스타일 */
}

.custom-list-item2 .v-list-item__content {
  margin-left: -20px !important; /* 특정 스타일 */
}
</style>


