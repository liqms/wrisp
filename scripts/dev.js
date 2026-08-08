const { spawn, exec, execSync } = require('child_process');
const net = require('net');

/**
 * Patch child_process.execSync 以容错 taskkill 失败
 * 原因：vite-plugin-electron 在重启 Electron 时调用 treeKillSync -> execSync('taskkill /pid X /T /F')
 *       如果旧进程已经自行退出，taskkill 会抛 "process not found" 错误，导致整个 dev 进程崩溃
 *       此处对以 taskkill 开头的命令捕获错误并静默忽略（进程不存在本身就是我们想要的结果）
 */
(function patchExecSyncForTaskkill() {
  const originalExecSync = require('child_process').execSync;
  require('child_process').execSync = function patchedExecSync(command, options) {
    try {
      return originalExecSync.call(this, command, options);
    } catch (err) {
      const cmd = typeof command === 'string' ? command.trim().toLowerCase() : '';
      if (cmd.startsWith('taskkill')) {
        // 进程不存在或已退出 -> 视为成功，返回空 Buffer
        return Buffer.alloc(0);
      }
      throw err;
    }
  };
})();

const port = 5173;

/**
 * 检查端口是否被占用
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    // 尝试连接到端口，如果连接成功则端口被占用
    const socket = new net.Socket();
    
    socket.setTimeout(1000);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    
    // 尝试连接到 localhost:port
    socket.connect(port, 'localhost');
  });
}

/**
 * 获取占用端口的进程 PID
 */
function getProcessUsingPort(port) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const pid = parseInt(parts[parts.length - 1]);
            if (!isNaN(pid)) {
              resolve(pid);
              return;
            }
          }
        }
        resolve(null);
      });
    } else {
      exec(`lsof -ti:${port}`, (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        const pid = parseInt(stdout.trim());
        resolve(isNaN(pid) ? null : pid);
      });
    }
  });
}

/**
 * 终止进程
 */
function killProcess(pid) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(`taskkill /F /PID ${pid}`, (error) => {
        resolve(!error);
      });
    } else {
      exec(`kill -9 ${pid}`, (error) => {
        resolve(!error);
      });
    }
  });
}

/**
 * 释放端口
 */
async function releasePort(port) {
  const inUse = await isPortInUse(port);
  if (!inUse) {
    console.log(`端口 ${port} 可用`);
    return true;
  }

  console.log(`端口 ${port} 被占用，正在查找占用进程...`);
  const pid = await getProcessUsingPort(port);
  
  if (!pid) {
    console.log(`无法找到占用端口 ${port} 的进程`);
    return false;
  }

  console.log(`发现进程 PID ${pid} 占用端口 ${port}，正在终止...`);
  const killed = await killProcess(pid);
  
  if (killed) {
    console.log(`成功终止进程 PID ${pid}`);
    // 等待端口释放
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 再次检查端口是否已释放
    const stillInUse = await isPortInUse(port);
    if (stillInUse) {
      console.log(`端口 ${port} 仍被占用，请手动处理`);
      return false;
    }
    
    return true;
  } else {
    console.log(`终止进程 PID ${pid} 失败`);
    return false;
  }
}

/**
 * 执行构建
 */
async function buildProject() {
  console.log('========================================');
  console.log('开始构建项目...');
  
  try {
    console.log('执行 vite build 命令...');
    execSync('vite build', { 
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    });
    console.log('✅ 构建完成');
    return true;
  } catch (error) {
    console.error('❌ 构建失败:', error.message);
    return false;
  }
}

/**
 * 启动 Vite 开发服务器（包含 Electron）
 */
async function startVite() {
  console.log('========================================');
  console.log('启动 Vite 开发服务器（包含 Electron）...');

  // 在 Windows 上设置控制台编码为 UTF-8
  if (process.platform === 'win32') {
    try {
      require('child_process').execSync('chcp 65001', { stdio: 'inherit' });
    } catch (error) {
      console.warn('设置控制台编码失败，但继续启动...');
    }
  }

  // 释放端口
  const released = await releasePort(port);
  if (!released) {
    console.error('无法释放端口，启动失败');
    process.exit(1);
  }

  const env = {
    ...process.env,
    LANG: 'zh_CN.UTF-8',
    LC_ALL: 'zh_CN.UTF-8',
    NODE_ENV: 'development'
  };

  if (process.platform === 'win32') {
    env.CHCP = '65001';
  }

  // 使用 vite 命令启动，vite-plugin-electron 会自动处理 Electron 启动
  const vite = spawn('vite', [], {
    shell: true,
    stdio: 'inherit',
    env
  });

  vite.on('close', (code) => {
    process.exit(code);
  });

  process.on('SIGINT', () => {
    vite.kill();
    process.exit();
  });
}

startVite();
