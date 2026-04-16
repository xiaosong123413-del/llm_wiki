function escapeRegex(value) {
  return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function matchesPattern(filename, pattern) {
  const regex = new RegExp(
    `^${escapeRegex(pattern).replace(/\*/g, ".*")}$`,
    "u",
  );
  return regex.test(filename);
}

export function selectNextBatch(files, options) {
  const selected = [];
  const remaining = files.filter((file) => !options.completedFiles.has(file));

  for (const pattern of options.patternOrder) {
    for (const file of remaining) {
      if (selected.length >= options.batchLimit) return selected;
      if (selected.includes(file)) continue;
      if (matchesPattern(file, pattern)) {
        selected.push(file);
      }
    }
  }

  return selected;
}
