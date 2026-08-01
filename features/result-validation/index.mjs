const idPattern = /^[a-z][a-z0-9-]{0,63}$/u;

export function createResultValidation({
  groupItems,
  referenceItems = groupItems,
  referenceNoun = "ID",
  stringCharacters,
}) {
  function plainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function object(value, path, errors) {
    if (!plainObject(value)) {
      errors.push(`${path} must be an object`);
      return {};
    }
    return value;
  }

  function unknownKeys(value, allowed, path, errors) {
    if (!plainObject(value)) return;
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) errors.push(`${path}.${key} is not allowed`);
    }
  }

  function text(value, path, errors, { optional = false } = {}) {
    if (value === undefined && optional) return undefined;
    if (
      typeof value !== "string"
      || value.trim().length === 0
      || [...value].length > stringCharacters
    ) {
      errors.push(
        `${path} must be a non-empty string within ${stringCharacters} characters`,
      );
      return "";
    }
    return value;
  }

  function choice(value, allowed, path, errors) {
    if (!allowed.includes(value)) {
      errors.push(`${path} must be one of ${allowed.join(", ")}`);
    }
    return value;
  }

  function integer(value, path, errors, { minimum = 0, optional = false } = {}) {
    if (value === undefined && optional) return undefined;
    if (!Number.isSafeInteger(value) || value < minimum) {
      errors.push(`${path} must be an integer of at least ${minimum}`);
      return minimum;
    }
    return value;
  }

  function boolean(value, path, errors) {
    if (typeof value !== "boolean") {
      errors.push(`${path} must be a boolean`);
      return false;
    }
    return value;
  }

  function array(value, path, errors, maximum = groupItems) {
    if (!Array.isArray(value)) {
      errors.push(`${path} must be an array`);
      return [];
    }
    if (value.length > maximum) {
      errors.push(`${path} must have at most ${maximum} items`);
    }
    return value.slice(0, maximum);
  }

  function identifier(value, path, errors, ids) {
    const result = text(value, path, errors);
    if (result && !idPattern.test(result)) errors.push(`${path} is invalid`);
    if (result && ids.has(result)) errors.push(`${path} repeats ID ${result}`);
    if (result) ids.add(result);
    return result;
  }

  function stringList(
    value,
    path,
    errors,
    {
      maximum = groupItems,
      minimum = 0,
    } = {},
  ) {
    const items = array(value, path, errors, maximum);
    if (items.length < minimum) {
      errors.push(
        `${path} must contain at least ${minimum} item${minimum === 1 ? "" : "s"}`,
      );
    }
    return items.map((item, index) => text(item, `${path}[${index}]`, errors));
  }

  function references(
    value,
    path,
    errors,
    known,
    {
      maximum = referenceItems,
      minimum = 0,
      noun = referenceNoun,
    } = {},
  ) {
    const items = stringList(value, path, errors, { maximum, minimum });
    const seen = new Set();
    for (const item of items) {
      if (seen.has(item)) errors.push(`${path} repeats ${noun} ${item}`);
      seen.add(item);
      if (!known.has(item)) {
        errors.push(`${path} references unknown ${noun} ${item}`);
      }
    }
    return items;
  }

  return Object.freeze({
    array,
    boolean,
    choice,
    identifier,
    integer,
    object,
    plainObject,
    references,
    stringList,
    text,
    unknownKeys,
  });
}
