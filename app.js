// app.js
let tool = "brush";
let color = "#000000";
let size = 4;
let drawing = false;
let startX = 0, startY = 0;
let currentFrame = 0;
let frames = [];
let fps = 12;
let interval;
let undoStack = [];

const canvas = document.getElementById("canvas");
const onion = document.getElementById("onion");
const cursorCanvas = document.getElementById("cursorCanvas");
const ctx = canvas.getContext("2d");
const onionCtx = onion.getContext("2d");
const cursorCtx = cursorCanvas.getContext("2d");
const timeline = document.getElementById("timeline");

canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDraw);
canvas.addEventListener("mouseleave", stopDraw);

cursorCanvas.addEventListener("mousemove", showCursorSize);
cursorCanvas.addEventListener("mouseleave", () => cursorCtx.clearRect(0, 0, 450, 400));

document.getElementById("colorPicker").addEventListener("input", e => color = e.target.value);
document.getElementById("brushSize").addEventListener("input", e => size = parseInt(e.target.value));

function setTool(t, buttonEl) {
  tool = t;
  document.querySelectorAll(".panel button").forEach(btn => btn.classList.remove("active"));
  if (buttonEl) {
    buttonEl.classList.add("active");
    buttonEl.classList.add("clicked");
    setTimeout(() => buttonEl.classList.remove("clicked"), 150);
  }
}

document.querySelectorAll(".panel button").forEach(button => {
  button.addEventListener("click", () => {
    const toolAttr = button.getAttribute("data-tool");
    if (toolAttr) setTool(toolAttr, button);
    else {
      document.querySelectorAll(".panel button").forEach(b => b.classList.remove("active"));
      button.classList.add("active");
      button.classList.add("clicked");
      setTimeout(() => button.classList.remove("clicked"), 150);
    }
  });
});

function getCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.min(e.clientX - rect.left, canvas.width),
    y: Math.min(e.clientY - rect.top, canvas.height)
  };
}

function startDraw(e) {
  drawing = true;
  const { x, y } = getCoords(e);
  startX = x;
  startY = y;
  if (tool === "brush" || tool === "eraser") {
    ctx.beginPath();
    ctx.moveTo(x, y);
  } else if (tool === "fill") {
    saveCurrentFrame();
    floodFill(x, y);
    updateThumbnails();
  }
}

function draw(e) {
  if (!drawing) return;
  const { x, y } = getCoords(e);
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (tool === "brush") {
    ctx.strokeStyle = color;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  } else if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.globalCompositeOperation = "source-over";
  } else if (tool === "circle") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (frames[currentFrame]) ctx.drawImage(frames[currentFrame], 0, 0);
    ctx.strokeStyle = color;
    const width = x - startX;
    const height = y - startY;
    ctx.beginPath();
    ctx.ellipse(startX + width / 2, startY + height / 2, Math.abs(width) / 2, Math.abs(height) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (tool === "square") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (frames[currentFrame]) ctx.drawImage(frames[currentFrame], 0, 0);
    ctx.strokeStyle = color;
    const width = x - startX;
    const height = y - startY;
    ctx.strokeRect(startX, startY, width, height);
  }
}

function stopDraw() {
  if (!drawing) return;
  drawing = false;
  ctx.beginPath();
  saveCurrentFrame();
  updateThumbnails();
}

function floodFill(x, y) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const index = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  const targetColor = data.slice(index, index + 4);
  const fillColor = hexToRgba(color);
  const visited = new Set();

  function colorsMatch(i) {
    return data[i] === targetColor[0] && data[i+1] === targetColor[1] && data[i+2] === targetColor[2] && data[i+3] === targetColor[3];
  }

  const stack = [{ x, y }];
  while (stack.length > 0) {
    const { x, y } = stack.pop();
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
    const i = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
    if (!colorsMatch(i)) continue;
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    data[i] = fillColor[0];
    data[i+1] = fillColor[1];
    data[i+2] = fillColor[2];
    data[i+3] = 255;

    stack.push({ x: x + 1, y });
    stack.push({ x: x - 1, y });
    stack.push({ x, y: y + 1 });
    stack.push({ x, y: y - 1 });
  }

  ctx.putImageData(imageData, 0, 0);
}

function hexToRgba(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255, 255];
}

function saveCurrentFrame() {
  const frame = document.createElement("canvas");
  frame.width = canvas.width;
  frame.height = canvas.height;
  const frameCtx = frame.getContext("2d");
  frameCtx.drawImage(canvas, 0, 0);
  frames[currentFrame] = frame;
  undoStack.push(frame.toDataURL());
  if (undoStack.length > 100) undoStack.shift();
}

function undo() {
  if (undoStack.length > 1) {
    undoStack.pop();
    const dataURL = undoStack[undoStack.length - 1];
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const frame = document.createElement("canvas");
      frame.width = canvas.width;
      frame.height = canvas.height;
      const frameCtx = frame.getContext("2d");
      frameCtx.drawImage(img, 0, 0);
      frames[currentFrame] = frame;
      updateThumbnails();
    };
    img.src = dataURL;
  }
}

function addFrame() {
  saveCurrentFrame();
  currentFrame = frames.length;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawOnionSkin(currentFrame);
  frames.push(null);
  updateThumbnails();
}

function drawOnionSkin(index) {
  onionCtx.clearRect(0, 0, onion.width, onion.height);
  if (frames[index - 1]) {
    onionCtx.globalAlpha = 0.3;
    onionCtx.drawImage(frames[index - 1], 0, 0);
    onionCtx.globalAlpha = 1;
  }
}

function updateThumbnails() {
  timeline.innerHTML = "";
  frames.forEach((frame, index) => {
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    if (index === currentFrame) thumb.classList.add("active");
    const canvasEl = document.createElement("canvas");
    canvasEl.width = 50;
    canvasEl.height = 50;
    const cctx = canvasEl.getContext("2d");
    if (frame) cctx.drawImage(frame, 0, 0, 50, 50);
    thumb.appendChild(canvasEl);
    thumb.addEventListener("click", () => showFrame(index));
    timeline.appendChild(thumb);
  });
}

function showFrame(index) {
  if (frames[index]) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(frames[index], 0, 0);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  drawOnionSkin(index);
  currentFrame = index;
  updateThumbnails();
}

function deleteFrame() {
  frames.splice(currentFrame, 1);
  currentFrame = Math.max(0, currentFrame - 1);
  showFrame(currentFrame);
  updateThumbnails();
}

function duplicateFrame() {
  if (frames[currentFrame]) {
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.getContext("2d").drawImage(frames[currentFrame], 0, 0);
    frames.splice(currentFrame + 1, 0, copy);
    currentFrame++;
    showFrame(currentFrame);
    updateThumbnails();
  }
}

function clearFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawOnionSkin(currentFrame);
}

function playAnim() {
  let i = 0;
  stopAnim();
  interval = setInterval(() => {
    if (frames[i]) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(frames[i], 0, 0);
    }
    i = (i + 1) % frames.length;
  }, 1000 / fps);
}

function stopAnim() {
  clearInterval(interval);
}

function updateSpeed(value) {
  fps = parseInt(value);
  document.getElementById("fpsValue").textContent = value;
  if (interval) {
    playAnim();
  }
}

function showCursorSize(e) {
  cursorCtx.clearRect(0, 0, 450, 400);
  const rect = cursorCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  cursorCtx.beginPath();
  cursorCtx.strokeStyle = tool === "eraser" ? "gray" : color;
  cursorCtx.arc(x, y, size / 2, 0, Math.PI * 2);
  cursorCtx.stroke();
}

function exportGIF() {
  const gif = new GIF({ workers: 2, quality: 10, width: 450, height: 400, workerScript: 'js/gif.worker.js' });
  for (const frame of frames) {
    if (!frame) continue;
    // Создаём временный холст
    const temp = document.createElement('canvas');
    temp.width = frame.width;
    temp.height = frame.height;
    const tctx = temp.getContext('2d');
    // Рисуем белый фон
    tctx.fillStyle = '#ffffff';
    tctx.fillRect(0, 0, temp.width, temp.height);
    // Поверх рисуем существующий кадр
    tctx.drawImage(frame, 0, 0);
    // И только затем добавляем его в GIF
    gif.addFrame(tctx, { delay: 1000 / fps });
  }
  gif.on('finished', blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'animation.gif';
    link.click();
    URL.revokeObjectURL(url);
  });
  gif.render();
}



addFrame();
