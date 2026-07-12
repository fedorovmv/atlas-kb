import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function checkOpenspecInstalled(): Promise<boolean> {
  try {
    await execFileAsync("openspec", ["--version"]);
    return true;
  } catch {
    try {
      await execFileAsync("npx", ["@fission-ai/openspec", "--version"]);
      return true;
    } catch {
      return false;
    }
  }
}

async function runOpenspec(args: string[]): Promise<string> {
  const { stdout, stderr } = await execFileAsync("npx", ["@fission-ai/openspec", ...args], {
    maxBuffer: 1024 * 1024 * 4,
  });
  return stdout || stderr;
}

export async function openspecNewCommand(options: {
  root?: string;
  name?: string;
  json?: boolean;
}): Promise<void> {
  if (!(await checkOpenspecInstalled())) {
    console.log("OpenSpec not installed. Install with: npm i @fission-ai/openspec");
    return;
  }

  const args = ["new"];
  if (options.name) args.push(options.name);
  if (options.json) args.push("--json");

  const output = await runOpenspec(args);
  console.log(output);
}

export async function openspecStatusCommand(options: {
  root?: string;
  json?: boolean;
}): Promise<void> {
  if (!(await checkOpenspecInstalled())) {
    console.log("OpenSpec not installed. Install with: npm i @fission-ai/openspec");
    return;
  }

  const args = ["status"];
  if (options.json) args.push("--json");

  const output = await runOpenspec(args);
  console.log(output);
}

export async function openspecCheckCommand(options: {
  root?: string;
  json?: boolean;
}): Promise<void> {
  if (!(await checkOpenspecInstalled())) {
    console.log("OpenSpec not installed. Install with: npm i @fission-ai/openspec");
    return;
  }

  const args = ["check"];
  if (options.json) args.push("--json");

  const output = await runOpenspec(args);
  console.log(output);
}

export async function openspecArchiveCommand(options: {
  root?: string;
  name: string;
  json?: boolean;
}): Promise<void> {
  if (!(await checkOpenspecInstalled())) {
    console.log("OpenSpec not installed. Install with: npm i @fission-ai/openspec");
    return;
  }

  const args = ["archive", options.name];
  if (options.json) args.push("--json");

  const output = await runOpenspec(args);
  console.log(output);
}
