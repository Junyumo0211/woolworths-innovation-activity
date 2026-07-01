const responseCount = document.querySelector("#responseCount");
const analysisTitle = document.querySelector("#analysisTitle");
const analysisBody = document.querySelector("#analysisBody");
const bars = document.querySelector("#bars");
const roundTable = document.querySelector("#roundTable");
const reset = document.querySelector("#reset");

function renderBars(data) {
  const max = Math.max(...Object.values(data.totals), 1);
  bars.innerHTML = data.options
    .map((option) => {
      const value = data.totals[option.id] || 0;
      const width = Math.round((value / max) * 100);
      return `
        <div class="barRow">
          <div class="barName">${option.name}</div>
          <div class="track"><div class="fill" style="--bar:${option.color};width:${width}%"></div></div>
          <div class="barValue">${value}</div>
        </div>
      `;
    })
    .join("");
}

function renderRounds(data) {
  roundTable.innerHTML = data.rounds
    .map(
      (round) => `
        <div class="roundResult">
          <div class="roundLabel">${round.title.replace("Round ", "R")}</div>
          ${data.options
            .map(
              (option) => `
                <div class="miniCell" style="border-top:4px solid ${option.color}">
                  <strong>${option.short}</strong>
                  <span>${data.byRound[round.id][option.id] || 0} votes</span>
                </div>
              `
            )
            .join("")}
        </div>
      `
    )
    .join("");
}

function render(data) {
  responseCount.textContent = data.responseCount;
  analysisTitle.textContent = data.responseCount ? data.analysis.title : "Waiting for votes";
  analysisBody.textContent = data.responseCount
    ? data.analysis.body
    : "The class analysis will appear after students submit their choices.";
  renderBars(data);
  renderRounds(data);
}

reset.addEventListener("click", async () => {
  if (!confirm("Reset all class votes?")) return;
  const key = localStorage.getItem("woolworthsAdminKey") || prompt("Teacher key, if configured:");
  if (key) localStorage.setItem("woolworthsAdminKey", key);
  const response = await fetch("/api/reset", {
    method: "POST",
    headers: key ? { "x-admin-key": key } : {}
  });
  if (response.status === 401) {
    localStorage.removeItem("woolworthsAdminKey");
    alert("Reset failed: teacher key is required or incorrect.");
  }
});

document.querySelector('a[href="/api/export.csv"]').addEventListener("click", (event) => {
  const key = localStorage.getItem("woolworthsAdminKey") || prompt("Teacher key, if configured:");
  if (!key) return;
  localStorage.setItem("woolworthsAdminKey", key);
  event.currentTarget.href = `/api/export.csv?key=${encodeURIComponent(key)}`;
});

fetch("/api/results")
  .then((res) => res.json())
  .then(render);

const events = new EventSource("/api/events");
events.onmessage = (event) => render(JSON.parse(event.data));
