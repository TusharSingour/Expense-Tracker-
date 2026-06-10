/**
 * Canvas charts — animated pie & grouped bar (vanilla, no deps).
 */

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

function deviceRatio(ctx, canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ label: string; value: number; color: string }[]} segments — expense totals per category
 * @param {{ formatCurrency?: (n: number) => string }} [options]
 */
export function animatePieChart(canvas, segments, options = {}) {
  const { formatCurrency } = options;
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const filtered = segments.filter((s) => s.value > 0);
  const total = filtered.reduce((a, s) => a + s.value, 0);

  let raf = 0;
  const duration = 900;

  const draw = (progress) => {
    const { w, h } = deviceRatio(ctx, canvas);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 - 6;
    const r = Math.min(w, h) * 0.36;

    if (total <= 0 || filtered.length === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(148, 163, 184, 0.12)";
      ctx.fill();
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-secondary").trim() || "#94a3b8";
      ctx.font = "600 13px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No expense data yet", cx, cy + 4);
      return;
    }

    let start = -Math.PI / 2;
    const sweepTarget = Math.PI * 2 * easeOutCubic(progress);

    filtered.forEach((seg) => {
      const frac = seg.value / total;
      const angle = frac * sweepTarget;
      const fill = seg.color || "#64748b";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.shadowColor = fill;
      ctx.shadowBlur = 12 * progress;
      ctx.fill();
      ctx.shadowBlur = 0;
      start += angle;
    });

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg-deep").trim() || "#0f172a";
    ctx.fill();

    ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "center";
    if (typeof formatCurrency === "function") {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-primary").trim() || "#e2e8f0";
      ctx.font = "700 15px Inter, system-ui, sans-serif";
      ctx.fillText(formatCurrency(total), cx, cy - 8);
      ctx.font = "500 11px Inter, system-ui, sans-serif";
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-secondary").trim() || "#94a3b8";
      ctx.fillText(`${filtered.length} categories`, cx, cy + 12);
    } else {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-primary").trim() || "#e2e8f0";
      ctx.font = "700 14px Inter, sans-serif";
      ctx.fillText("Categories", cx, cy - 6);
      ctx.font = "600 18px Inter, sans-serif";
      ctx.fillStyle = "#06b6d4";
      ctx.fillText(`${filtered.length}`, cx, cy + 14);
    }
  };

  const startTime = performance.now();

  const loop = (now) => {
    const t = Math.min(1, (now - startTime) / duration);
    draw(t);
    if (t < 1) raf = requestAnimationFrame(loop);
  };

  raf = requestAnimationFrame(loop);

  return () => cancelAnimationFrame(raf);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ labels: string[]; income: number[]; expense: number[] }} data — aligned arrays
 */
export function animateBarChart(canvas, data) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const { labels, income, expense } = data;
  const n = labels.length;

  let raf = 0;
  const duration = 950;

  const maxVal = Math.max(1, ...income, ...expense);
  const pad = { l: 44, r: 16, t: 24, b: 36 };

  const draw = (progress) => {
    const { w, h } = deviceRatio(ctx, canvas);
    ctx.clearRect(0, 0, w, h);

    const chartW = w - pad.l - pad.r;
    const chartH = h - pad.t - pad.b;
    const groupW = chartW / Math.max(1, n);
    const barW = groupW * 0.28;
    const gap = groupW * 0.12;

    ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (chartH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
    }

    labels.forEach((lb, i) => {
      const gx = pad.l + i * groupW + gap;
      const hi = (income[i] / maxVal) * chartH * easeOutCubic(progress);
      const he = (expense[i] / maxVal) * chartH * easeOutCubic(progress);

      const baseY = pad.t + chartH;

      ctx.fillStyle = "rgba(34, 197, 94, 0.85)";
      ctx.shadowColor = "rgba(34, 197, 94, 0.35)";
      ctx.shadowBlur = 8 * progress;
      ctx.fillRect(gx, baseY - hi, barW, hi);

      ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
      ctx.shadowColor = "rgba(239, 68, 68, 0.35)";
      ctx.fillRect(gx + barW + gap * 0.4, baseY - he, barW, he);
      ctx.shadowBlur = 0;

      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-secondary").trim() || "#94a3b8";
      ctx.font = "500 11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(lb, pad.l + i * groupW + groupW / 2, h - 12);
    });

    ctx.textAlign = "left";
    ctx.font = "600 11px Inter, sans-serif";
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(pad.l, 8, 10, 10);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-secondary").trim() || "#94a3b8";
    ctx.fillText("Income", pad.l + 16, 17);

    ctx.fillStyle = "#ef4444";
    ctx.fillRect(pad.l + 72, 8, 10, 10);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-secondary").trim() || "#94a3b8";
    ctx.fillText("Expense", pad.l + 88, 17);
  };

  const startTime = performance.now();
  const loop = (now) => {
    const t = Math.min(1, (now - startTime) / duration);
    draw(t);
    if (t < 1) raf = requestAnimationFrame(loop);
  };

  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}
