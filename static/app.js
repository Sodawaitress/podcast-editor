let segments = [];
let filename = "";
let history = [];
let currentSeg = -1;
let audio = null;

// ── 上传区域 ──

document.addEventListener("DOMContentLoaded", () => {
  const uploadZone = document.getElementById("uploadZone");
  const fileInput = document.getElementById("fileInput");

  uploadZone.addEventListener("click", () => fileInput.click());

  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.add("dragover");
  });

  uploadZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove("dragover");
  });

  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) uploadFile(fileInput.files[0]);
  });
});

async function uploadFile(file) {
  setStatus(`转录中：${file.name}，请稍等...`);

  const form = new FormData();
  form.append("audio", file);

  try {
    const res = await fetch("/upload", { method: "POST", body: form });
    const data = await res.json();

    filename = data.filename;
    segments = data.segments.map(s => ({ ...s, deleted: false, selected: false }));
    history = [];

    // 设置播放器
    audio = document.getElementById("audioPlayer");
    audio.src = `/uploads/${filename}`;
    // 初始化 wavesurfer
    if (window.wavesurfer) window.wavesurfer.destroy();
    window.wavesurfer = WaveSurfer.create({
      container: "#waveform",
      waveColor: "#2a4a2a",
      progressColor: "#a8e890",
      cursorColor: "#a8e890",
      height: 80,
      normalize: true,
      backend: "MediaElement",
      media: audio,
    });
    audio.ontimeupdate = onTimeUpdate;

    document.getElementById("playerBar").style.display = "flex";
    document.getElementById("stats").style.display = "block";
    document.getElementById("searchWrap").style.display = "block";
    document.getElementById("sideActions").style.display = "flex";

    updateStats();
    renderSegments();
    setStatus(`完成，共 ${segments.length} 段`);
  } catch (e) {
    setStatus("上传失败，请重试");
  }
}

// ── 渲染字幕 ──
function renderSegments() {
  const list = document.getElementById("segmentList");
  const query = document.getElementById("searchInput")?.value.toLowerCase() || "";
  list.innerHTML = "";

  segments.forEach((seg, i) => {
    if (query && !seg.text.toLowerCase().includes(query)) return;

    const div = document.createElement("div");
    div.className = "segment"
      + (seg.deleted ? " deleted" : "")
      + (i === currentSeg ? " active" : "")
      + (seg.selected ? " selected" : "");
    div.dataset.index = i;

    div.innerHTML = `
      <div class="active-bar"></div>
      <span class="seg-time">${fmt(seg.start)}<br>${fmt(seg.end)}</span>
      <span class="seg-text" contenteditable="${!seg.deleted}" 
            onblur="editText(${i}, this.innerText)"
            onclick="event.stopPropagation()">${seg.text}</span>
    `;

    div.onclick = (e) => {
      if (e.shiftKey) {
        saveHistory();
        segments[i].selected = !segments[i].selected;
      } else {
        saveHistory();
        segments[i].deleted = !segments[i].deleted;
        segments[i].selected = false;
      }
      updateStats();
      renderSegments();
    };

    // 点时间戳跳转
    div.querySelector(".seg-time").onclick = (e) => {
      e.stopPropagation();
      if (audio) {
        audio.currentTime = seg.start;
        audio.play();
        document.getElementById("playIcon").textContent = "⏸";
      }
    };

    list.appendChild(div);
  });
}

// ── 播放器 ──
function togglePlay() {
  if (!audio) return;
  if (audio.paused) {
    audio.play();
    document.getElementById("playIcon").textContent = "⏸";
  } else {
    audio.pause();
    document.getElementById("playIcon").textContent = "▶";
  }
}

function onTimeUpdate() {
  if (!audio) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  document.getElementById("progressFill").style.width = pct + "%";
  document.getElementById("progressHead").style.left = pct + "%";
  document.getElementById("timeDisplay").textContent =
    `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;

  // 字幕高亮跟踪
  const idx = segments.findIndex(s => audio.currentTime >= s.start && audio.currentTime < s.end);
  if (idx !== -1 && idx !== currentSeg) {
    currentSeg = idx;
    renderSegments();
    const el = document.querySelector(`.segment[data-index="${idx}"]`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function seekTo(e) {
  if (!audio) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  audio.currentTime = pct * audio.duration;
}

// ── 编辑 ──
function editText(i, text) {
  segments[i].text = text.trim();
}

function filterSegments(val) { renderSegments(); }

function selectAll() {
  saveHistory();
  const allSelected = segments.filter(s => !s.deleted).every(s => s.selected);
  segments.forEach(s => { if (!s.deleted) s.selected = !allSelected; });
  renderSegments();
}

function deleteSelected() {
  saveHistory();
  segments.forEach(s => { if (s.selected) { s.deleted = true; s.selected = false; } });
  updateStats();
  renderSegments();
}

function saveHistory() { history.push(JSON.parse(JSON.stringify(segments))); }

function undoDelete() {
  if (!history.length) return;
  segments = history.pop();
  updateStats();
  renderSegments();
}

// ── 统计 ──
function updateStats() {
  const total = segments[segments.length - 1]?.end || 0;
  const deletedTime = segments.filter(s => s.deleted).reduce((a, s) => a + (s.end - s.start), 0);
  const deletedCount = segments.filter(s => s.deleted).length;

  document.getElementById("statTotal").textContent = fmt(total);
  document.getElementById("statDeleted").textContent = `${deletedCount} 段 (-${fmt(deletedTime)})`;
  document.getElementById("statRemain").textContent = fmt(total - deletedTime);
}

// ── 导出 ──
async function exportAudio() {
  const kept = segments.filter(s => !s.deleted);
  if (!kept.length) return;
  setStatus("导出中...");

  const res = await fetch("/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, segments: kept })
  });

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `edited_${filename}`;
  a.click();
  setStatus("导出完成！");
}

// ── 工具 ──
function fmt(s) {
  if (!s && s !== 0) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function setStatus(msg) {
  document.getElementById("statusText").textContent = msg;
}

// ── 键盘快捷键 ──
document.addEventListener("keydown", (e) => {
  if (e.target.contentEditable === "true") return;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  if ((e.metaKey || e.ctrlKey) && e.key === "z") { e.preventDefault(); undoDelete(); }
});

function autoRemoveFiller() {
  const input = document.getElementById("fillerInput").value;
  const fillers = input.split(",").map(s => s.trim()).filter(Boolean);
  if (!fillers.length) return;

  saveHistory();
  let count = 0;

  segments.forEach(seg => {
    const text = seg.text.trim();
    const isFiller = fillers.some(f => {
      // 整段都是口头禅，或者非常短且包含口头禅
      return text === f ||
             (text.length <= 6 && fillers.some(f => text.includes(f)));
    });
    if (isFiller) {
      seg.deleted = true;
      count++;
    }
  });

  updateStats();
  renderSegments();
  setStatus(`自动删除了 ${count} 段口头禅`);
}