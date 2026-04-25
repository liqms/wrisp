<template>
  <NLayout class="home-layout">
    <NLayoutContent class="home-content">
      <!-- Banner 横幅区域 -->
      <div class="banner-wrapper">
        <NCard class="banner-card" hoverable bordered>
          <div class="banner-content">
            <div class="banner-text">
              <div class="banner-icon-wrapper">
                <NIcon :component="Heart" size="48" class="banner-icon" />
              </div>
              <h1 class="banner-title">
                <NText class="title-text">AI 写作助手</NText>
              </h1>
              <p class="banner-subtitle">
                <NText class="subtitle-text">释放你的创作灵感，让写作更高效</NText>
              </p>
              <NButton 
                type="primary" 
                size="large" 
                @click="router.push('/chat')"
                class="banner-btn"
              >
                <template #icon>
                  <NIcon :component="Heart" size="20" />
                </template>
                立即开始写作
              </NButton>
            </div>
            <div class="banner-visual">
              <div class="floating-icon icon-1">
                <NIcon :component="Heart" size="40" />
              </div>
              <div class="floating-icon icon-2">
                <NIcon :component="Heart" size="40" />      
              </div>
              <div class="floating-icon icon-3">
                <NIcon :component="Heart" size="40" />
              </div>
            </div>
          </div>
        </NCard>
      </div>

      <!-- 功能区域 -->
      <div class="features-wrapper">
        <!-- 深度写作 -->
        <div class="feature-section">
          <NSpace class="section-header" :size="16">
            <div class="section-icon" style="background: linear-gradient(135deg, #6366f1, #d946ef);">
              <NIcon :component="Heart" size="24" />
            </div>
            <div>
              <h2 class="section-title">深度写作</h2>
              <p class="section-desc">专业的文学创作工具</p>
            </div>
          </NSpace>
          <NSpace class="feature-grid" wrap :size="16">
            <NCard
              v-for="feature in deepWritingFeatures"
              :key="feature.id"
              class="feature-card"
              hoverable
              @click="handleFeatureClick(feature)"
            >
              <div 
                class="card-icon" 
                :style="{ background: `linear-gradient(135deg, ${feature.color}20, ${feature.color}10)` }"
              >
                <NIcon :component="feature.icon" :size="28" :style="{ color: feature.color }" />
              </div>
              <h3 class="card-title">{{ feature.title }}</h3>
              <p class="card-desc">{{ feature.description }}</p>
            </NCard>
          </NSpace>
        </div>

        <!-- 自媒体 -->
        <div class="feature-section">
          <NSpace class="section-header" :size="16">
            <div class="section-icon" style="background: linear-gradient(135deg, #10b981, #059669);">
              <NIcon :component="Heart" size="24" />
            </div>
            <div>
              <h2 class="section-title">自媒体</h2>
              <p class="section-desc">多平台内容创作支持</p>
            </div>
          </NSpace>
          <NSpace class="feature-grid" wrap :size="16">
            <NCard
              v-for="feature in mediaFeatures"
              :key="feature.id"
              class="feature-card"
              hoverable
              @click="handleFeatureClick(feature)"
            >
              <div 
                class="card-icon" 
                :style="{ background: `linear-gradient(135deg, ${feature.color}20, ${feature.color}10)` }"
              >
                <NIcon :component="feature.icon" :size="28" :style="{ color: feature.color }" />
              </div>
              <h3 class="card-title">{{ feature.title }}</h3>
              <p class="card-desc">{{ feature.description }}</p>
            </NCard>
          </NSpace>
        </div>

        <!-- 商业推广 -->
        <div class="feature-section">
          <NSpace class="section-header" :size="16">
            <div class="section-icon" style="background: linear-gradient(135deg, #f59e0b, #b45309);">
              <NIcon :component="Megaphone" size="24" />
            </div>
            <div>
              <h2 class="section-title">商业推广</h2>
              <p class="section-desc">专业营销文案创作</p>
            </div>
          </NSpace>
          <NSpace class="feature-grid" wrap :size="16">
            <NCard
              v-for="feature in businessFeatures"
              :key="feature.id"
              class="feature-card"
              hoverable
              @click="handleFeatureClick(feature)"
            >
              <div 
                class="card-icon" 
                :style="{ background: `linear-gradient(135deg, ${feature.color}20, ${feature.color}10)` }"
              >
                <NIcon :component="feature.icon" :size="28" :style="{ color: feature.color }" />
              </div>
              <h3 class="card-title">{{ feature.title }}</h3>
              <p class="card-desc">{{ feature.description }}</p>
            </NCard>
          </NSpace>
        </div>
      </div>
    </NLayoutContent>
  </NLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NButton, NText, NIcon, NLayout, NLayoutContent, NSpace } from 'naive-ui'
import { 
  Heart, 
  Flame, 
  Megaphone, 
} from '@vicons/ionicons5'
import { i18n } from '@/renderer/plugins/i18n'


// 使用类型断言解决 i18n 实例的类型问题
const t = i18n.global.t as (key: string) => string | string[]

const router = useRouter()

// 深度写作功能
const deepWritingFeatures = ref([
  {
    id: 1,
    title: '小说创作',
    description: '沉浸式写作体验，支持章节管理',
    icon: Heart,
    color: '#6366f1'
  },
  {
    id: 2,
    title: '情节构思',
    description: '思维导图辅助情节设计',
    icon: Heart,
    color: '#8b5cf6'
  },
  {
    id: 3,
    title: '人物设定',
    description: '完整的角色档案管理',
    icon: Heart,
    color: '#a855f7'
  },
  {
    id: 4,
    title: '大纲梳理',
    description: '结构化大纲编辑工具',
    icon: Heart,
    color: '#d946ef'
  }
])

// 自媒体功能
const mediaFeatures = ref([
  {
    id: 5,
    title: '公众号排版',
    description: '一键生成精美公众号文章',
    icon: Heart,
    color: '#10b981'
  },
  {
    id: 6,
    title: '短视频脚本',
    description: '专业短视频脚本创作',
    icon: Heart,
    color: '#059669'
  },
  {
    id: 7,
    title: '小红书文案',
    description: '爆款文案一键生成',
    icon: Heart,
    color: '#047857'
  },
  {
    id: 8,
    title: '微博运营',
    description: '热点追踪与内容创作',
    icon: Flame,
    color: '#065f46'
  }
])

// 商业推广功能
const businessFeatures = ref([
  {
    id: 9,
    title: '广告文案',
    description: '专业广告文案撰写',
    icon: Megaphone,
    color: '#f59e0b'
  },
  {
    id: 10,
    title: '产品描述',
    description: '电商产品详情页文案',
    icon: Heart,
    color: '#d97706'
  },
  {
    id: 11,
    title: '营销策划',
    description: '完整营销方案制定',
    icon: Heart,
    color: '#b45309'
  },
  {
    id: 12,
    title: '品牌故事',
    description: '品牌文化故事创作',
    icon: Heart,
    color: '#92400e'
  }
])

const handleFeatureClick = (feature: typeof deepWritingFeatures.value[0]) => {
  console.log('Clicked feature:', feature.title)
  switch (feature.id) {
    case 1:
      router.push('/novel')
      break
    default:
      router.push('/chat')
  }
}
</script>

<style scoped>
.home-layout {
  min-height: 100vh;
  background: linear-gradient(180deg, var(--bg-gradient-start) 0%, var(--bg-secondary) 100%);
}

.home-content {
  padding: 0;
}

/* Banner 样式 */
.banner-wrapper {
  padding: 30px 20px;
}

.banner-card {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  border: none;
  border-radius: 24px;
  overflow: hidden;
}

.banner-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 40px;
  padding: 20px;
}

.banner-text {
  flex: 1;
}

.banner-icon-wrapper {
  width: 64px;
  height: 64px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.banner-icon {
  color: #fff;
}

.banner-title {
  margin-bottom: 12px;
}

.title-text {
  font-size: 40px;
  font-weight: 700;
  color: #fff;
}

.banner-subtitle {
  margin-bottom: 20px;
}

.subtitle-text {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.85);
}

.banner-btn {
  background: #fff;
  color: var(--primary-color);
  border: none;
  border-radius: 50px;
  padding: 12px 28px;
  font-weight: 600;
}

.banner-btn:hover {
  background: rgba(255, 255, 255, 0.95);
}

.banner-visual {
  position: relative;
  width: 180px;
  height: 180px;
}

.floating-icon {
  position: absolute;
  color: rgba(255, 255, 255, 0.9);
  animation: float 3s ease-in-out infinite;
}

.icon-1 {
  top: 15%;
  left: 15%;
  animation-delay: 0s;
}

.icon-2 {
  top: 35%;
  right: 5%;
  animation-delay: 1s;
}

.icon-3 {
  bottom: 15%;
  left: 35%;
  animation-delay: 2s;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-12px) rotate(5deg);
  }
}

/* 功能区域 */
.features-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.feature-section {
  margin-bottom: 40px;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.section-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.section-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.section-desc {
  font-size: 13px;
  color: var(--text-secondary);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.feature-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 16px;
  padding: 20px;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
}

.card-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.card-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .banner-content {
    flex-direction: column;
    text-align: center;
  }

  .title-text {
    font-size: 28px;
  }

  .subtitle-text {
    font-size: 14px;
  }

  .banner-visual {
    width: 140px;
    height: 140px;
  }

  .floating-icon {
    font-size: 32px;
  }

  .feature-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }

  .feature-card {
    padding: 16px 12px;
  }

  .card-icon {
    width: 44px;
    height: 44px;
  }

  .section-title {
    font-size: 18px;
  }
}
</style>