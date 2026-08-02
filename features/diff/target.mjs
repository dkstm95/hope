import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { parseGitHubPullRequestUrl } from "./github.mjs";

const execFile = promisify(execFileCallback);
const GITHUB_COMMAND_TIMEOUT_MS = 30_000;

export function parsePullRequestTargetArgument(value) {
  if (value === undefined) return Object.freeze({ url: undefined });
  const numberMatch = value.match(/^#?([1-9][0-9]*)$/u);
  if (numberMatch) {
    const pullRequestNumber = Number.parseInt(numberMatch[1], 10);
    if (!Number.isSafeInteger(pullRequestNumber)) {
      throw new TypeError("Hope diff needs a safe positive pull request number");
    }
    return Object.freeze({ pullRequestNumber, url: undefined });
  }
  if (value.startsWith("#") || /^[-+]?[0-9]/u.test(value)) {
    throw new TypeError("Hope diff needs a positive pull request number or canonical GitHub pull request URL");
  }
  return Object.freeze({ url: parseGitHubPullRequestUrl(value).url });
}

async function runJson(command, arguments_, { exec = execFile } = {}) {
  try {
    const { stdout } = await exec(command, arguments_, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      timeout: GITHUB_COMMAND_TIMEOUT_MS,
    });
    return JSON.parse(stdout);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`${command} is required to find the current pull request`);
    }
    throw new Error(`Hope could not find a pull request from the current repository`);
  }
}

async function currentBranch(options) {
  try {
    const { stdout } = await (options.exec ?? execFile)(
      "git",
      ["branch", "--show-current"],
      {
        encoding: "utf8",
        maxBuffer: 64 * 1024,
        timeout: GITHUB_COMMAND_TIMEOUT_MS,
      },
    );
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function currentRepository(options) {
  const repository = await runJson(
    "gh",
    ["repo", "view", "--json", "nameWithOwner"],
    options,
  );
  if (typeof repository.nameWithOwner !== "string") {
    throw new Error("GitHub did not identify the current repository");
  }
  return repository.nameWithOwner;
}

export async function resolveGitHubPullRequestNumber(number, options = {}) {
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new TypeError("Hope diff needs a positive pull request number");
  }
  const repository = await currentRepository(options);
  return Object.freeze({
    ...parseGitHubPullRequestUrl(
      `https://github.com/${repository}/pull/${number}`,
    ),
    selection: "explicit-number",
  });
}

export async function discoverGitHubPullRequest(options = {}) {
  const repository = await currentRepository(options);
  const pullRequests = await runJson(
    "gh",
    [
      "pr",
      "list",
      "--repo",
      repository,
      "--state",
      "open",
      "--author",
      "@me",
      "--limit",
      "100",
      "--json",
      "number,url,headRefName,createdAt",
    ],
    options,
  );
  if (!Array.isArray(pullRequests) || pullRequests.length === 0) {
    throw new Error("No open pull request authored by you was found in the current repository");
  }
  const branch = await currentBranch(options);
  const branchMatches = branch
    ? pullRequests.filter((pullRequest) => pullRequest.headRefName === branch)
    : [];
  const candidates = branchMatches.length > 0 ? branchMatches : pullRequests;
  const selected = [...candidates].sort((left, right) => (
    String(right.createdAt).localeCompare(String(left.createdAt), "en")
    || right.number - left.number
  ))[0];
  return Object.freeze({
    ...parseGitHubPullRequestUrl(selected.url),
    selection: branchMatches.length > 0 ? "current-branch" : "latest-authored",
  });
}
