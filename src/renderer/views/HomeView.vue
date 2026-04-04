<template>
  <div class="home">
    <n-card title="欢迎使用 PenTip" size="large">
      <template #header-extra>
        <n-tag type="success" size="small">v1.0.0</n-tag>
      </template>
      
      <n-space vertical size="large">
        <n-alert title="智能创作助手" type="info">
          基于 Electron 和 Vue 3的跨平台桌面应用，为创作者提供自动化和智能化创作。
        </n-alert>
        
        <n-space vertical>
          <n-h2 prefix="bar" style="margin-top: 0">
            核心功能
          </n-h2>
          
          <n-list>
            <n-list-item>
              <n-thing title="AI对话" description="集成主流AI大模型，提供免费智能对话功能">
                <template #avatar>
                  <n-icon size="24">
                    <ChatbubbleOutline />
                  </n-icon>
                </template>
              </n-thing>
            </n-list-item>
            
            <n-list-item>
              <n-thing title="动态智能体" description="根据作品动态生成智能体，更精准的进行创作">
                <template #avatar>
                  <n-icon size="24">
                    <RocketOutline />
                  </n-icon>
                </template>
              </n-thing>
            </n-list-item>
            
            <n-list-item>
              <n-thing title="语义搜索" description="基于LanceDB向量数据库的智能内容检索">
                <template #avatar>
                  <n-icon size="24">
                    <SearchOutline />
                  </n-icon>
                </template>
              </n-thing>
            </n-list-item>
            
            <n-list-item>
              <n-thing title="本地存储" description="作品数据存储，数据安全可控">
                <template #avatar>
                  <n-icon size="24">
                    <SaveOutline />
                  </n-icon>
                </template>
              </n-thing>
            </n-list-item>
          </n-list>
        </n-space>
        
        <n-space justify="center">
          <n-button type="primary" size="large" @click="createNewWork">
            <template #icon>
              <n-icon>
                <AddCircleOutline />
              </n-icon>
            </template>
            新建作品
          </n-button>
          
          <n-button type="info" size="large" @click="openSettings">
            <template #icon>
              <n-icon>
                <SettingsOutline />
              </n-icon>
            </template>
            设置
          </n-button>
          
          <n-button type="success" size="large" @click="openAbout">
            <template #icon>
              <n-icon>
                <InformationCircleOutline />
              </n-icon>
            </template>
            关于
          </n-button>
        </n-space>
      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { 
  NCard, 
  NTag, 
  NSpace, 
  NAlert, 
  NH2, 
  NList, 
  NListItem, 
  NThing, 
  NIcon, 
  NButton 
} from 'naive-ui'
import { 
  ChatbubbleOutline,
  RocketOutline,
  SearchOutline,
  SaveOutline,
  AddCircleOutline,
  SettingsOutline,
  InformationCircleOutline
} from '@vicons/ionicons5'

const router = useRouter()

const createNewWork = () => {
  console.log('Create new work')
  // 这里可以添加创建新作品的逻辑
}

const openSettings = () => {
  console.log('Open settings')
  // 这里可以添加打开设置的逻辑
}

const openAbout = () => {
  router.push('/about')
}
</script>

<style scoped>
.home {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}
</style>
