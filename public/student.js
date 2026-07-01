const form = document.querySelector("#voteForm");
const done = document.querySelector("#done");
const editVote = document.querySelector("#editVote");

const voterIdKey = "woolworthsInnovationVoterId";
const voteKey = "woolworthsInnovationVote";

let config = null;
let choices = {};
let currentStep = 0;

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
      <input required type="radio" name="${round.id}" value="${option.id}" ${checked} />
      <span>${option.name}</span>
    </label>
  `;
}

function renderStep() {
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

async function load() {
  config = await fetch("/api/config").then((res) => res.json());
  choices = JSON.parse(localStorage.getItem(voteKey) || "null") || {};
  renderStep();

  if (Object.keys(choices).length === config.rounds.length) {
    form.hidden = true;
    done.hidden = false;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const round = config.rounds[currentStep];
  const selected = new FormData(form).get(round.id);

  if (!selected) {
    alert("Please choose one option before continuing.");
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
