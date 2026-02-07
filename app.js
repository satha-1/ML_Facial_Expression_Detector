// ──────────────────────────────────────────────
// MODEL URL — paste your Teachable Machine link here (must end with /)
// ──────────────────────────────────────────────
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/P_hvRoRyH/";

// ── DOM refs ──
const video       = document.getElementById("webcam");
const placeholder = document.getElementById("placeholder");
const startBtn    = document.getElementById("startBtn");
const stopBtn     = document.getElementById("stopBtn");
const topPred     = document.getElementById("topPrediction");
const topLabel    = document.getElementById("topLabel");
const topConf     = document.getElementById("topConfidence");
const probSection = document.getElementById("probabilities");
const probList    = document.getElementById("probList");

// ── State ──
let model        = null;
let stream       = null;
let animFrameId  = null;
let lastPredTime = 0;
const PREDICT_INTERVAL = 120; // ms between predictions (~8 fps)

// ──────────────────────────────────────────────
// Load the Teachable Machine model
// ──────────────────────────────────────────────
async function loadModel() {
  const modelURL   = MODEL_URL + "model.json";
  const metadataURL = MODEL_URL + "metadata.json";
  model = await tmImage.load(modelURL, metadataURL);
  console.log("✅ Model loaded — classes:", model.getClassLabels());
}

// ──────────────────────────────────────────────
// Start Camera
// ──────────────────────────────────────────────
async function startCamera() {
  startBtn.disabled = true;
  startBtn.textContent = "Loading…";

  try {
    // Load model if not already loaded
    if (!model) await loadModel();

    // Request webcam
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 640, height: 480 },
      audio: false,
    });

    video.srcObject = stream;
    video.style.display = "block";
    placeholder.style.display = "none";

    // Wait for video to be ready
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });

    // Show UI sections
    topPred.classList.remove("hidden");
    probSection.classList.remove("hidden");

    // Build probability list once
    buildProbList();

    // Start prediction loop
    lastPredTime = 0;
    animFrameId = requestAnimationFrame(predictLoop);

    stopBtn.disabled = false;
    startBtn.textContent = "▶ Start Camera";
  } catch (err) {
    console.error("Camera / model error:", err);
    alert("Could not start camera or load model.\n\n" + err.message);
    startBtn.disabled = false;
    startBtn.textContent = "▶ Start Camera";
  }
}

// ──────────────────────────────────────────────
// Stop Camera
// ──────────────────────────────────────────────
function stopCamera() {
  // Stop prediction loop
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  // Stop webcam stream
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  video.style.display = "none";
  placeholder.style.display = "flex";

  topPred.classList.add("hidden");
  probSection.classList.add("hidden");

  startBtn.disabled = false;
  stopBtn.disabled = true;
}

// ──────────────────────────────────────────────
// Prediction Loop (throttled via timestamp)
// ──────────────────────────────────────────────
async function predictLoop(timestamp) {
  if (!stream) return; // camera was stopped

  if (timestamp - lastPredTime >= PREDICT_INTERVAL) {
    lastPredTime = timestamp;

    const predictions = await model.predict(video);

    // Find top prediction
    let best = predictions[0];
    for (const p of predictions) {
      if (p.probability > best.probability) best = p;
    }

    // Update top prediction display
    topLabel.textContent = best.className;
    topConf.textContent  = (best.probability * 100).toFixed(1) + "%";

    // Update per-class bars
    for (const p of predictions) {
      const pct = (p.probability * 100).toFixed(1);
      const row = document.getElementById("row-" + slugify(p.className));
      if (row) {
        row.querySelector(".bar-fill").style.width = pct + "%";
        row.querySelector(".class-pct").textContent = pct + "%";
      }
    }
  }

  animFrameId = requestAnimationFrame(predictLoop);
}

// ──────────────────────────────────────────────
// Build probability list items from model labels
// ──────────────────────────────────────────────
function buildProbList() {
  probList.innerHTML = "";
  const labels = model.getClassLabels();

  for (const label of labels) {
    const li = document.createElement("li");
    li.id = "row-" + slugify(label);
    li.innerHTML = `
      <span class="class-name">${label}</span>
      <div class="bar-bg"><div class="bar-fill" style="width:0%"></div></div>
      <span class="class-pct">0.0%</span>
    `;
    probList.appendChild(li);
  }
}

// ──────────────────────────────────────────────
// Utility — turn a label into a safe DOM id slug
// ──────────────────────────────────────────────
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
