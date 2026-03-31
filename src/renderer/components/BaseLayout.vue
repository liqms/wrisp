<template>
  <div class="base-layout">
    <header class="header">
      <h1>PenTip - 智能创作助手</h1>
      <nav class="nav">
        <router-link to="/" class="nav-link">首页</router-link>
        <router-link to="/about" class="nav-link">关于</router-link>
      </nav>
    </header>
    <main class="main">
      <router-view />
    </main>
    <footer class="footer">
      <p>&copy; 2024 PenTip. All rights reserved.</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
// 基础布局组件
</script>

<style scoped>
.base-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background-color: #2c3e50;
  color: white;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.nav {
  display: flex;
  gap: 1rem;
}

.nav-link {
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.nav-link:hover,
.nav-link.router-link-active {
  background-color: #34495e;
}

.main {
  flex: 1;
  padding: 2rem;
}

.footer {
  background-color: #ecf0f1;
  padding: 1rem 2rem;
  text-align: center;
  color: #7f8c8d;
}
</style>
