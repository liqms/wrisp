<template>
  <div class="home">
    <h1>Welcome to PenTip</h1>
    <p>基于 Electron 和 Vue 3的跨平台桌面应用，为创作者提供自动化和智能化创作。</p>
    <button @click="createNewWork">
      新建作品
    </button>
  </div>
</template>

<script setup lang="ts">
const createNewWork = () => {
  console.log('Create new work')
}
</script>

<style scoped>
.home {
  padding: 20px;
}

h1 {
  font-size: 24px;
  margin-bottom: 16px;
}

p {
  margin-bottom: 20px;
}

button {
  padding: 10px 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #45a049;
}
</style>
