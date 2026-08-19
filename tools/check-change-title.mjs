#!/usr/bin/env node

import { isEntrypoint } from "./entrypoint.mjs";

const allowedTypes = Object.freeze([
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "test",
]);

const titlePattern = /^(?<type>[a-z]+)\((?<scope>[a-z0-9]+(?:-[a-z0-9]+)*)\)(?<breaking>!)?: (?<subject>\S[^\r\n]*)$/u;
const unsafeTitleCharacterPattern = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/u;

export function validateChangeTitle(message) {
  if (typeof message !== "string" || message.length === 0) {
    throw new Error("change title is required");
  }

  const [title] = message.replaceAll("\r\n", "\n").split("\n");
  if (title !== title.trim()) {
    throw new Error("change title cannot start or end with whitespace");
  }
  if (unsafeTitleCharacterPattern.test(title)) {
    throw new Error(
      "change title cannot contain control or bidirectional formatting characters",
    );
  }

  const match = title.match(titlePattern);
  if (!match) {
    throw new Error(
      "change title must match <type>(<scope>): <observable outcome>",
    );
  }

  const { type } = match.groups;
  if (!allowedTypes.includes(type)) {
    throw new Error(
      `change title type must be one of: ${allowedTypes.join(", ")}`,
    );
  }
  return title;
}

if (isEntrypoint(import.meta.url)) {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length > 1) {
    process.stderr.write(
      "Usage: node tools/check-change-title.mjs [change-title]\n",
    );
    process.exitCode = 1;
  } else {
    try {
      const title = validateChangeTitle(
        arguments_[0] ?? process.env.HOPE_CHANGE_TITLE,
      );
      process.stdout.write(`Change title is valid: ${title}\n`);
    } catch (error) {
      process.stderr.write(`change-title: ${error.message}\n`);
      process.exitCode = 1;
    }
  }
}
