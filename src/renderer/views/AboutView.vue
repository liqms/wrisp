<template>
  <div class="about">
    <h1>关于 PenTip</h1>
    <p>PenTip 是一款基于 Electron 和 Vue 3的跨平台桌面应用，为创作者提供自动化和智能化创作。</p>
    <h2>核心功能</h2>
    <ul>
      <li>AI对话 - 集成主流AI大模型，提供免费智能对话功能</li>
      <li>动态智能体 - 根据作品动态生成智能体，更精准的进行创作</li>
      <li>语义搜索 - 基于LanceDB向量数据库的智能内容检索</li>
      <li>本地存储 - 作品数据存储，数据安全可控</li>
      <li>多系统支持 - 支持Windows、macOS、Linux等多个操作系统</li>
    </ul>
  </div>
</template>

<style scoped>
.about {
  padding: 20px;
}

h1 {
  font-size: 24px;
  margin-bottom: 16px;
}

h2 {
  font-size: 20px;
  margin-top: 24px;
  margin-bottom: 12px;
}

p {
  margin-bottom: 20px;
}

ul {
  margin-left: 20px;
}

li {
  margin-bottom: 8px;
}
</style>
