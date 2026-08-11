// Diff owns this private command parser; it is not a public Hope CLI contract.
export function takeOptions(values, {
  allowed,
  prefix,
  repeatable = [],
}) {
  const allowedKeys = new Set(allowed);
  const repeatableKeys = new Set(repeatable);
  const options = {};
  const positionals = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const key = value.slice(2);
    if (!allowedKeys.has(key)) {
      throw new TypeError(`Unknown ${prefix} option: ${value}`);
    }
    const next = values[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new TypeError(`${prefix} option ${value} needs a value`);
    }
    if (repeatableKeys.has(key)) {
      const entries = options[key] ?? [];
      entries.push(next);
      options[key] = entries;
      index += 1;
      continue;
    }
    if (options[key] !== undefined) {
      throw new TypeError(`${prefix} option ${value} was repeated`);
    }
    options[key] = next;
    index += 1;
  }
  return { options, positionals };
}
