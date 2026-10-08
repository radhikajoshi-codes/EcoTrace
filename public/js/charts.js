/**
 * EcoTrace Trend Chart Renderer
 * Replicates the exact Stitch UI line chart:
 * Baseline target: 17.0k t/mo +3.2% over
 * Jan, Feb, Mar, Apr, May, Jun
 * Actual vs Baseline with gradient fill
 */

class TrendChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.data = [
      { month: 'Jan', actual: 16.2, baseline: 17.0 },
      { month: 'Feb', actual: 16.8, baseline: 17.0 },
      { month: 'Mar', actual: 17.1, baseline: 17.0 },
      { month: 'Apr', actual: 17.4, baseline: 17.0 },
      { month: 'May', actual: 18.2, baseline: 17.0 },
      { month: 'Jun', actual: 18.4, baseline: 17.0 }
    ];
    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
    this.render();
  }

  updateData(newData) {
    if (newData && newData.length) {
      this.data = newData;
      this.render();
    }
  }

  render() {
    if (!this.ctx || !this.width || !this.height) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    const padLeft = 45;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 35;

    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    const maxVal = 20.0;
    const minVal = 0.0;

    // 1. Draw horizontal grid lines & labels (0k, 5k, 10k, 15k)
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';

    const gridSteps = [0, 5, 10, 15, 20];
    gridSteps.forEach(val => {
      const y = padTop + chartH - (val / maxVal) * chartH;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();

      ctx.fillText(`${val}k`, padLeft - 8, y + 4);
    });

    const stepX = chartW / (this.data.length - 1);

    // 2. Draw Baseline Target Line (dashed gray)
    const baselineY = padTop + chartH - (17.0 / maxVal) * chartH;
    ctx.save();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, baselineY);
    ctx.lineTo(w - padRight, baselineY);
    ctx.stroke();
    ctx.restore();

    // 3. Draw Actual Trend (gradient fill underneath)
    const points = this.data.map((d, i) => {
      return {
        x: padLeft + i * stepX,
        y: padTop + chartH - (d.actual / maxVal) * chartH,
        val: d.actual,
        month: d.month
      };
    });

    // Area Gradient
    const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.20)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.00)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, padTop + chartH);
    ctx.lineTo(points[0].x, padTop + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Actual Line (Solid Dark Slate / Emerald)
    ctx.beginPath();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.5;
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Points & X Labels
    ctx.textAlign = 'center';
    points.forEach((p, idx) => {
      // X-Axis Label
      ctx.fillStyle = '#64748B';
      ctx.fillText(p.month, p.x, h - 12);

      // Point circle
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = idx === points.length - 1 ? '#059669' : '#1E293B';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    });
  }
}

window.TrendChart = TrendChart;
