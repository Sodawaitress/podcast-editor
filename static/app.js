let segments = [];
let filename = "";

async function uploadFile() {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return;

  document.getElementById("status").textContent = "转录中，请稍等...";

  const form = new FormData();
  form.append("audio", file);

  const res = await fetch("/upload", { method: "POST", body: form });
  const data = await res.json();

  filename = data.filename;
  segments = data.segments.map(s => ({ ...s, deleted: false }));

  document.getElementById("status").textContent = `完成，共 ${segments.length} 段`;
  document.getElementById("actions").style.display = "block";
  renderSegments();
}

function renderSegments() {
  const list = document.getElementById("segmentList");
  list.innerHTML = "";
  segments.forEach((seg, i) => {
    const div = document.createElement("div");
    div.className = "segment" + (seg.deleted ? " deleted" : "");
    div.innerHTML = `
      <span class="seg-time">${fmt(seg.start)} → ${fmt(seg.end)}</span>
      <span class="seg-text">${seg.text}</span>
    `;
    div.onclick = () => {
      segments[i].deleted = !segments[i].deleted;
      renderSegments();
    };
    list.appendChild(div);
  });
}

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, "0")}`;
}

async function exportAudio() {
  const kept = segments.filter(s => !s.deleted);
  document.getElementById("status").textContent = "导出中...";

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

  document.getElementById("status").textContent = "导出完成！";
}
