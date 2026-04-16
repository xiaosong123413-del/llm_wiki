export async function canClearStaleLock(pidText) {
  const pid = Number(pidText);
  if (!Number.isInteger(pid) || pid <= 0) return true;

  try {
    process.kill(pid, 0);
    return false;
  } catch {
    return true;
  }
}
