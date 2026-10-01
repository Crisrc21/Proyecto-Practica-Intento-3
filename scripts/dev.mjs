import { spawn } from "node:child_process";

function createCommand(scriptName) {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec ?? "cmd.exe",
      args: ["/d", "/s", "/c", `npm run dev --prefix ${scriptName}`]
    };
  }

  return {
    command: "npm",
    args: ["run", "dev", "--prefix", scriptName]
  };
}

const processes = [
  {
    name: "backend",
    ...createCommand("backend")
  },
  {
    name: "frontend",
    ...createCommand("frontend")
  }
].map(({ name, command, args }) => {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    windowsHide: false
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });

  return child;
});

function stopAll() {
  for (const child of processes) {
    if (!child.killed) {
      child.kill();
    }
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});
