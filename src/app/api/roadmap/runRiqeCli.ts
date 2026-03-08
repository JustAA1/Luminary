import { spawn } from "child_process";
import path from "path";
import { createInterface } from "readline";

/**
 * Run the local RIQE Python pipeline. Uses a single long-lived daemon process
 * so state (onboard/signal/switch) is preserved across requests.
 */
let daemon: ReturnType<typeof spawn> | null = null;
let rl: ReturnType<typeof createInterface> | null = null;
let queue: { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void }[] = [];

function startDaemon() {
  if (daemon) return;
  const root = path.resolve(process.cwd());
  const py = process.platform === "win32" ? "python" : "python3";
  daemon = spawn(py, ["-m", "riqe.cli", "--daemon"], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      HF_HUB_DISABLE_PROGRESS_BARS: "1",
    },
  });
  rl = createInterface({ input: daemon.stdout!, crlfDelay: Infinity });
  rl.on("line", (line) => {
    const next = queue.shift();
    if (!next) return;
    try {
      const parsed = line ? JSON.parse(line) : {};
      next.resolve(parsed);
    } catch {
      next.resolve({ error: line || "Invalid JSON from pipeline" });
    }
  });
  daemon.stderr?.setEncoding("utf-8");
  daemon.stderr?.on("data", (chunk) => {
    const next = queue[0];
    if (next) next.reject(new Error(chunk.trim() || "Pipeline error"));
  });
  daemon.on("error", (err) => {
    daemon = null;
    rl = null;
    queue.forEach((q) => q.reject(err));
    queue = [];
  });
  daemon.on("close", (code) => {
    if (code !== 0 && code !== null) {
      const next = queue.shift();
      if (next) next.reject(new Error(`Pipeline exited with code ${code}`));
    }
    daemon = null;
    rl = null;
  });
}

export function runRiqeCli(input: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    startDaemon();
    if (!daemon?.stdin?.writable) {
      reject(new Error("Pipeline not ready"));
      return;
    }
    queue.push({ resolve, reject });
    daemon.stdin!.write(input + "\n", "utf-8", (err) => {
      if (err) {
        const i = queue.findIndex((q) => q.reject === reject);
        if (i !== -1) queue.splice(i, 1);
        reject(err);
      }
    });
  });
}
