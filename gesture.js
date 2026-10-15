export function releaseState(active, progress, inside, moved) {
  if (!moved || !inside) return active;
  return active ? progress > 0.45 : progress >= 0.78;
}
