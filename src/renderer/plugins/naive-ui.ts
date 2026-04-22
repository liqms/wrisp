import { create, NLayout, NLayoutSider, NMenu, NLayoutHeader, NLayoutContent, NAvatar, NSpace, NIcon, NButton, NFlex, NText, NCard, NConfigProvider, NSelect, NDivider, NSlider, NSwitch, NScrollbar, NDescriptions, NDescriptionsItem, NInput, NTag, NInputGroup, NEmpty, NImage, NMessageProvider, NDialogProvider, NModalProvider, NNotificationProvider } from 'naive-ui'

// 创建 Naive UI 实例
const naive = create({
  // 可以在这里添加全局配置
  components: [
    NLayout,
    NLayoutSider,
    NSpace,
    NLayoutHeader,
    NLayoutContent,
    NMenu,
    NAvatar,
    NIcon,
    NButton,
    NFlex,
    NText,
    NCard,
    NConfigProvider,
    NSelect,
    NDivider,
    NSlider,
    NSwitch,
    NScrollbar,
    NDescriptions,
    NDescriptionsItem,
    NInput,
    NTag,
    NInputGroup,
    NEmpty,
    NImage,
    NButton,
    NIcon,
    NTag,
    NSelect,
    NSpace,
    NSwitch, 
    NConfigProvider, 
    NMessageProvider, 
    NDialogProvider, 
    NModalProvider, 
    NNotificationProvider
  ]
  // themeOverrides: {
  //   common: {
  //     primaryColor: '#2080f0',
  //     primaryColorHover: '#4098fc',
  //     primaryColorPressed: '#1060c9',
  //   }
  // }
})

export default naive