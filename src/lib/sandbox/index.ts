import { spawn } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AlgorithmInput } from "../types";
import { cppHarnessPrefix, cppHarnessSuffix, javaRunnerSource, pythonHarnessSuffix, supervisorSource } from "./harness";

export interface ExecutionOutcome {
  ok: boolean;
  output?: unknown;
  error?: string;
  milliseconds: number;
  memoryKiB: number | null;
  networkNamespace: boolean;
}

export interface AlgorithmRunner {
  readonly available: boolean;
  readonly runtime: string;
  readonly reason?: string;
  execute(input: unknown): Promise<ExecutionOutcome>;
  dispose(): Promise<void>;
}

interface CapturedProcess {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  outputLimited: boolean;
}

const hostEnvironment: NodeJS.ProcessEnv = {
  PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
  LANG: "C.UTF-8",
  LC_ALL: "C.UTF-8",
  NODE_ENV: process.env.NODE_ENV,
};

function capture(command: string, args: string[], options: { cwd?: string; input?: string; timeoutMs: number; env?: NodeJS.ProcessEnv }): Promise<CapturedProcess> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? hostEnvironment, shell: false, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let outputLimited = false;
    let settled = false;
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout: stdout.slice(-2_000_000), stderr: stderr.slice(-12_000), timedOut, outputLimited });
    };
    const kill = () => {
      try { child.kill("SIGKILL"); } catch { /* process already exited */ }
    };
    const timer = setTimeout(() => { timedOut = true; kill(); }, options.timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.length > 2_000_000) { outputLimited = true; kill(); }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 100_000) stderr = stderr.slice(-100_000);
    });
    child.on("error", (error) => { stderr += `\n${error.message}`; finish(null); });
    child.on("close", finish);
    child.stdin.on("error", () => { /* a killed or failed child can close stdin early */ });
    child.stdin.end(options.input ?? "");
  });
}

function validateSource(input: AlgorithmInput): string | null {
  if (!input.code.trim()) return "The source is empty.";
  if (input.code.length > 50_000) return "Source exceeds the 50,000 character execution limit.";
  const forbidden = /(__import__|\beval\s*\(|\bexec\s*\(|\bcompile\s*\(|\bopen\s*\(|ProcessBuilder|Runtime\.getRuntime|java\.net|java\.io|java\.nio|\bSystem\.|\bRuntime\b|\bsocket\s*\(|\bfork\s*\(|\bpopen\s*\(|\bsystem\s*\(|\basm\b|#\s*include|\bfstream\b|\bfilesystem\b)/;
  if (forbidden.test(input.code)) return "Source uses a host, dynamic-execution, process, file, or network construct blocked by the execution policy.";
  if (input.language === "python") {
    if (!/^\s*def\s+solve\s*\(/m.test(input.code)) return "Python must define solve(data).";
    const imports = input.code.matchAll(/^\s*(?:from\s+([A-Za-z_][\w.]*)\s+import|import\s+([A-Za-z_][\w.]*))/gm);
    const allowed = new Set(["collections", "heapq", "math", "functools", "itertools"]);
    for (const match of imports) {
      const module = (match[1] ?? match[2]).split(".")[0];
      if (!allowed.has(module)) return `Python import '${module}' is not allowlisted.`;
    }
  } else if (input.language === "cpp") {
    if (!/Json\s+solve\s*\(\s*Json\s*&\s*data\s*\)/.test(input.code)) return "C++ must define Json solve(Json& data) using the provided harness API.";
  } else {
    if (!/public\s+static\s+Object\s+solve\s*\(\s*Object\s+data\s*\)/.test(input.code)) return "Java must define public static Object solve(Object data) in class Algorithm.";
    if (!/public\s+class\s+Algorithm\b/.test(input.code)) return "Java source must declare public class Algorithm.";
    const imports = input.code.matchAll(/^\s*import\s+([^;]+);/gm);
    for (const match of imports) if (!/^java\.util\.(\*|[A-Za-z_]\w*)$/.test(match[1].trim())) return `Java import '${match[1].trim()}' is not allowlisted.`;
  }
  return null;
}

class UnavailableRunner implements AlgorithmRunner {
  readonly available = false;
  constructor(readonly runtime: string, readonly reason: string, private readonly directory?: string) {}
  async execute(): Promise<ExecutionOutcome> {
    return { ok: false, error: `UNAVAILABLE: ${this.reason}`, milliseconds: 0, memoryKiB: null, networkNamespace: false };
  }
  async dispose() { if (this.directory) await rm(this.directory, { recursive: true, force: true }); }
}

class ProcessRunner implements AlgorithmRunner {
  readonly available = true;
  constructor(
    private readonly input: AlgorithmInput,
    private readonly directory: string,
    private readonly supervisor: string,
    private readonly command: string[],
    readonly runtime: string,
    private readonly trusted: boolean,
  ) {}

  private async supervised(command: string[], timeoutMs: number, memory: number, cpu: number, stdin = "") {
    const result = await capture("python3", [this.supervisor, String(memory), String(cpu), "--", ...command], {
      cwd: this.directory, input: stdin, timeoutMs, env: hostEnvironment,
    });
    let networkNamespace = false;
    try { networkNamespace = (await readFile(join(this.directory, ".network-namespace"), "utf8")).trim() === "yes"; } catch { /* marker unavailable */ }
    return { ...result, networkNamespace };
  }

  async compile(): Promise<string | null> {
    if (this.input.language === "python") return null;
    if (this.input.language === "cpp") {
      const result = await this.supervised(["g++", "-std=c++17", "-O2", "-pipe", "main.cpp", "-o", "algorithm"], 20_000, 1_073_741_824, 10);
      if (result.code !== 0) return `C++ compilation failed: ${(result.stderr || result.stdout).slice(-3000)}`;
      return null;
    }
    const result = await this.supervised(["javac", "-J-Xmx256m", "-encoding", "UTF-8", "Algorithm.java", "Runner.java"], 25_000, 1_500_000_000, 12);
    if (result.code !== 0) return `Java compilation failed: ${(result.stderr || result.stdout).slice(-3000)}`;
    return null;
  }

  async probeNetworkIsolation(): Promise<boolean> {
    const result = await this.supervised(["python3", "-I", "-S", "-c", "pass"], 4_000, 268_435_456, 1);
    return result.code === 0 && result.networkNamespace;
  }

  async execute(input: unknown): Promise<ExecutionOutcome> {
    const memory = this.input.language === "java" ? 1_200_000_000 : 402_653_184;
    const result = await this.supervised(this.command, 4_500, memory, 3, JSON.stringify(input));
    if (result.networkNamespace === false && !this.trusted) {
      return { ok: false, error: "UNAVAILABLE: custom execution requires an OS network namespace; this host denied it.", milliseconds: 0, memoryKiB: null, networkNamespace: false };
    }
    if (result.timedOut) return { ok: false, error: "Execution exceeded the 4.5 s wall-clock / 3 s CPU limit and was killed.", milliseconds: 4500, memoryKiB: null, networkNamespace: result.networkNamespace };
    if (result.outputLimited) return { ok: false, error: "Execution exceeded the 2 MB output limit and was killed.", milliseconds: 0, memoryKiB: null, networkNamespace: result.networkNamespace };
    const line = result.stdout.trim().split("\n").filter(Boolean).at(-1);
    if (!line) return { ok: false, error: `Runner produced no result (exit ${result.code}). ${result.stderr.slice(-800)}`, milliseconds: 0, memoryKiB: null, networkNamespace: result.networkNamespace };
    try {
      const parsed = JSON.parse(line) as { ok: boolean; result?: unknown; error?: string; milliseconds?: number; memoryKiB?: number | null };
      return {
        ok: parsed.ok,
        output: parsed.result,
        error: parsed.error?.slice(0, 1200),
        milliseconds: Number.isFinite(parsed.milliseconds) ? Number(parsed.milliseconds) : 0,
        memoryKiB: typeof parsed.memoryKiB === "number" ? parsed.memoryKiB : null,
        networkNamespace: result.networkNamespace,
      };
    } catch {
      return { ok: false, error: `Invalid runner response (exit ${result.code}): ${(result.stderr || line).slice(-1000)}`, milliseconds: 0, memoryKiB: null, networkNamespace: result.networkNamespace };
    }
  }

  async dispose() { await rm(this.directory, { recursive: true, force: true }); }
}

async function version(command: string, args: string[]): Promise<string | null> {
  const result = await capture(command, args, { timeoutMs: 3000 });
  if (result.code !== 0) return null;
  return (result.stdout || result.stderr).trim().split("\n")[0] ?? command;
}

export async function createRunner(input: AlgorithmInput, trusted: boolean): Promise<AlgorithmRunner> {
  const invalid = validateSource(input);
  if (invalid) return new UnavailableRunner(`${input.language} validation`, invalid);
  const directory = await mkdtemp(join(tmpdir(), "algorithm-lab-"));
  await chmod(directory, 0o700);
  const supervisor = join(directory, "supervisor.py");
  await writeFile(supervisor, supervisorSource, { mode: 0o700 });
  const executable = input.language === "python" ? "python3" : input.language === "cpp" ? "g++" : "javac";
  const runtimeVersion = await version(executable, input.language === "cpp" ? ["--version"] : ["--version"]);
  if (!runtimeVersion) {
    return new UnavailableRunner(`${input.language} runtime not found`, `${executable} is not installed or could not be started. Install it to enable empirical execution; static results remain available.`, directory);
  }

  let command: string[];
  if (input.language === "python") {
    await writeFile(join(directory, "algorithm.py"), `${input.code}\n${pythonHarnessSuffix}`, { mode: 0o600 });
    command = ["python3", "-I", "-S", "algorithm.py"];
  } else if (input.language === "cpp") {
    await writeFile(join(directory, "main.cpp"), `${cppHarnessPrefix}\n${input.code}\n${cppHarnessSuffix}`, { mode: 0o600 });
    command = [join(directory, "algorithm")];
  } else {
    await writeFile(join(directory, "Algorithm.java"), input.code, { mode: 0o600 });
    await writeFile(join(directory, "Runner.java"), javaRunnerSource, { mode: 0o600 });
    command = ["java", "-Xms16m", "-Xmx128m", "-Xss512k", "-XX:+UseSerialGC", "-XX:ReservedCodeCacheSize=32m", "-cp", directory, "Runner"];
  }

  const runner = new ProcessRunner(input, directory, supervisor, command, `${runtimeVersion}; ${process.platform}/${process.arch}`, trusted);
  const networkIsolated = await runner.probeNetworkIsolation();
  if (!trusted && !networkIsolated) {
    return new UnavailableRunner(runtimeVersion, "OS network-namespace isolation is unavailable on this host. Custom code was not executed; use an exact reviewed library template or deploy the runner in a network-isolated container.", directory);
  }
  const compilationError = await runner.compile();
  if (compilationError) return new UnavailableRunner(runtimeVersion, compilationError, directory);
  return runner;
}
