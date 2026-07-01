const form = document.querySelector("#voteForm");
const done = document.querySelector("#done");
const editVote = document.querySelector("#editVote");
const waiting = document.querySelector("#waiting");
const studentJoinedCount = document.querySelector("#studentJoinedCount");
const ended = document.querySelector("#ended");

const voterIdKey = "woolworthsInnovationVoterId";
const voteKey = "woolworthsInnovationVote";

let config = null;
let choices = {};
let currentStep = 0;
let hasStarted = false;
let hasEnded = false;
let heartbeatTimer = null;

function voterId() {
  let id = localStorage.getItem(voterIdKey);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    localStorage.setItem(voterIdKey, id);
  }
  return id;
}

function optionCard(round, option, saved) {
  const checked = saved?.[round.id] === option.id ? "checked" : "";
  return `
    <label class="choice" style="--choice:${option.color}">
      <input type="radio" name="${round.id}" value="${option.id}" ${checked} />
      <span>${option.name}</span>
    </label>
  `;
}

function renderStep() {
  waiting.hidden = true;
  ended.hidden = true;
  done.hidden = true;
  form.hidden = false;
  const round = config.rounds[currentStep];
  const isLast = currentStep === config.rounds.length - 1;
  form.innerHTML = `
    <div class="progressRow" aria-label="Voting progress">
      <span>Round ${currentStep + 1} of ${config.rounds.length}</span>
      <div class="stepDots">
        ${config.rounds.map((_, index) => `<span class="stepDot ${index <= currentStep ? "active" : ""}"></span>`).join("")}
      </div>
    </div>
    <section class="round">
      <div class="roundHeader">
        <h2>${round.title}</h2>
        <p>${round.prompt}</p>
      </div>
      <div class="choices">
        ${config.options.map((option) => optionCard(round, option, choices)).join("")}
      </div>
    </section>
    <div class="navRow">
      <button class="secondary" type="button" id="backStep" ${currentStep === 0 ? "disabled" : ""}>Back</button>
      <button type="submit">${isLast ? "Submit vote" : "Next"}</button>
    </div>
  `;

  document.querySelector("#backStep").addEventListener("click", () => {
    if (currentStep === 0) return;
    currentStep -= 1;
    renderStep();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function showWaiting() {
  waiting.hidden = false;
  form.hidden = true;
  done.hidden = true;
  ended.hidden = true;
}

function resetToWaiting(joinedCount) {
  hasStarted = false;
  hasEnded = false;
  currentStep = 0;
  choices = {};
  localStorage.removeItem(voteKey);
  updateJoinedCount(joinedCount);
  showWaiting();
}

function showEnded() {
  hasEnded = true;
  waiting.hidden = true;
  form.hidden = true;
  done.hidden = true;
  ended.hidden = false;
}

function updateJoinedCount(count) {
  studentJoinedCount.textContent = count ?? 0;
}

function sendPresence(path, keepalive = false) {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voterId: voterId() }),
    keepalive
  });
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    sendPresence("/api/heartbeat").catch(() => {});
  }, 10000);
}

async function load() {
  config = await fetch("/api/config").then((res) => res.json());
  choices = JSON.parse(localStorage.getItem(voteKey) || "null") || {};
  hasStarted = config.activityStarted;
  hasEnded = config.activityEnded;

  const joinState = await sendPresence("/api/join").then((res) => res.json());
  startHeartbeat();

  if (!hasStarted && !hasEnded) {
    resetToWaiting(joinState.joinedCount);
  } else if (hasEnded) {
    showEnded();
  } else if (hasStarted) {
    renderStep();
  } else {
    showWaiting();
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const round = config.rounds[currentStep];
  if (hasEnded) {
    showEnded();
    return;
  }
  const selected = new FormData(form).get(round.id);

  if (!selected) {
    alert("Please select one option to continue.");
    return;
  }

  choices[round.id] = selected;

  if (currentStep < config.rounds.length - 1) {
    currentStep += 1;
    renderStep();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const payload = { voterId: voterId(), choices };
  const response = await fetch("/api/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    if (response.status === 403) {
      showEnded();
      return;
    }
    alert("Your vote could not be submitted. Please try again.");
    return;
  }

  localStorage.setItem(voteKey, JSON.stringify(choices));
  form.hidden = true;
  done.hidden = false;
});

editVote.addEventListener("click", () => {
  done.hidden = true;
  form.hidden = false;
  currentStep = 0;
  renderStep();
});

load();

const events = new EventSource("/api/events");
events.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateJoinedCount(data.joinedCount);
  if (!data.activityStarted && !data.activityEnded) {
    resetToWaiting(data.joinedCount);
    return;
  }
  if (data.activityEnded) {
    showEnded();
    return;
  }
  if (data.activityStarted && !hasStarted) {
    hasStarted = true;
    renderStep();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (!data.activityStarted && hasStarted && done.hidden) {
    hasStarted = false;
    currentStep = 0;
    showWaiting();
  }
};

window.addEventListener("beforeunload", () => {
  sendPresence("/api/leave", true).catch(() => {});
});
