const { spawn, exec } = require("child_process");
const net = require("net");
const path = require("path");

const port = 5173;

/**
 * 检查端口是否被占用
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    // 尝试连接到端口，如果连接成功则端口被占用
    const socket = new net.Socket();

    socket.setTimeout(1000);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });

    // 尝试连接到 localhost:port
    socket.connect(port, "localhost");
  });
}

/**
 * 获取占用端口的进程 PID
 */
function getProcessUsingPort(port) {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }

        const lines = stdout.split("\n");
        for (const line of lines) {
          if (line.includes("LISTENING")) {
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
    if (process.platform === "win32") {
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
    await new Promise((resolve) => setTimeout(resolve, 2000));

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
 * 启动 Vite 开发服务器（包含 Electron）
 */
async function startVite() {
  console.log("========================================");
  console.log("启动 Vite 开发服务器（包含 Electron）...");

  // 在 Windows 上设置控制台编码为 UTF-8
  if (process.platform === "win32") {
    try {
      require("child_process").execSync("chcp 65001", { stdio: "inherit" });
    } catch {
      console.warn("设置控制台编码失败，但继续启动...");
    }
  }

  // 释放端口
  const released = await releasePort(port);
  if (!released) {
    console.error("无法释放端口，启动失败");
    process.exit(1);
  }

  const env = {
    ...process.env,
    LANG: "zh_CN.UTF-8",
    LC_ALL: "zh_CN.UTF-8",
    NODE_ENV: "development",
  };

  if (process.platform === "win32") {
    env.CHCP = "65001";
  }

  // 将 taskkill 容错补丁预加载进 vite 子进程。
  // dev.js 自己执行 process.execSync 补丁对子进程无效，
  // 必须通过 NODE_OPTIONS=--require 注入，补丁才会在
  // vite-plugin-electron 所在进程（vite 子进程）中生效。
  const patchFile = path
    .join(__dirname, "patch-taskkill.js")
    .replace(/\\/g, "/");
  env.NODE_OPTIONS = [env.NODE_OPTIONS, `--require=${patchFile}`]
    .filter(Boolean)
    .join(" ");

  // 使用 vite 命令启动，vite-plugin-electron 会自动处理 Electron 启动
  const vite = spawn("vite", [], {
    shell: true,
    stdio: "inherit",
    env,
  });

  vite.on("close", (code) => {
    process.exit(code);
  });

  process.on("SIGINT", () => {
    vite.kill();
    process.exit();
  });
}

startVite();
