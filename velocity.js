// Input timestamps are seconds. Report fitted slopes in signal units per minute.
function initialVelocity(series, windowMinutes) {
  const points = series.filter(([seconds]) => seconds / 60 >= windowMinutes[0] && seconds / 60 <= windowMinutes[1]);
  const count = points.length;
  if (count < 2) return {count, slope: null};
  const meanTime = points.reduce((sum, [seconds]) => sum + seconds / 60, 0) / count;
  const meanSignal = points.reduce((sum, [, signal]) => sum + signal, 0) / count;
  let covariance = 0;
  let variance = 0;
  let signalVariance = 0;
  for (const [seconds, signal] of points) {
    const dt = seconds / 60 - meanTime;
    covariance += dt * (signal - meanSignal);
    variance += dt * dt;
    signalVariance += (signal - meanSignal) ** 2;
  }
  return {count, slope: variance ? covariance / variance : null,
    rSquared: count >= 3 && variance > 0 && signalVariance > 0
      ? Math.min(1, (covariance / Math.sqrt(variance) / Math.sqrt(signalVariance)) ** 2) : null,
    first: points[0][0] / 60, last: points[count - 1][0] / 60};
}
