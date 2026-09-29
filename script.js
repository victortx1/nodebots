const canvas = document.getElementById("bg-canvas");
const ctx = canvas.getContext("2d");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let width, height, nodes;
const NODE_COUNT_BASE = 90; // por 1000x1000px de área, ajustado abaixo
const LINK_DIST = 140;

function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  const count = Math.floor((width * height) / 18000);
  nodes = Array.from({ length: Math.max(30, Math.min(count, 140)) }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
  }));
}

function step() {
  ctx.clearRect(0, 0, width, height);

  for (const n of nodes) {
    n.x += n.vx;
    n.y += n.vy;

    if (n.x < 0 || n.x > width) n.vx *= -1;
    if (n.y < 0 || n.y > height) n.vy *= -1;
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < LINK_DIST) {
        const alpha = (1 - dist / LINK_DIST) * 0.18;
        ctx.strokeStyle = `rgba(105, 199, 255, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  for (const n of nodes) {
    ctx.fillStyle = "rgba(105, 199, 255, 0.55)";
    ctx.beginPath();
    ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!reduceMotion) requestAnimationFrame(step);
}

window.addEventListener("resize", resize);
resize();

if (reduceMotion) {
  // desenha um único frame estático, sem loop de animação
  step();
} else {
  requestAnimationFrame(step);
}