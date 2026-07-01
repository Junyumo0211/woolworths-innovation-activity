const screenResponseCount = document.querySelector("#screenResponseCount");
const screenAnalysisTitle = document.querySelector("#screenAnalysisTitle");
const screenAnalysisBody = document.querySelector("#screenAnalysisBody");
const screenBars = document.querySelector("#screenBars");

function renderScreenBars(data) {
  const max = Math.max(...Object.values(data.totals), 1);
  screenBars.innerHTML = data.options
    .map((option) => {
      const value = data.totals[option.id] || 0;
      const width = Math.round((value / max) * 100);
      return `
        <div class="screenBarRow">
          <div class="screenBarTop">
            <strong>${option.name}</strong>
            <span>${value}</span>
          </div>
          <div class="screenTrack">
            <div class="screenFill" style="--bar:${option.color};width:${width}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function render(data) {
  screenResponseCount.textContent = data.responseCount;
  screenAnalysisTitle.textContent = data.responseCount ? data.analysis.title : "Waiting for votes";
  screenAnalysisBody.textContent = data.responseCount
    ? data.analysis.body
    : "The class analysis will appear after students submit their choices.";
  renderScreenBars(data);
}

fetch("/api/results")
  .then((res) => res.json())
  .then(render);

const events = new EventSource("/api/events");
events.onmessage = (event) => render(JSON.parse(event.data));
