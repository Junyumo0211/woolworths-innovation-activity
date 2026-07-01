const form = document.querySelector("#voteForm");
const done = document.querySelector("#done");
const editVote = document.querySelector("#editVote");

const voterIdKey = "woolworthsInnovationVoterId";
const voteKey = "woolworthsInnovationVote";

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

async function load() {
  const config = await fetch("/api/config").then((res) => res.json());
  const saved = JSON.parse(localStorage.getItem(voteKey) || "null");

  form.innerHTML = `
    ${config.rounds
      .map(
        (round) => `
          <section class="round">
            <div class="roundHeader">
              <h2>${round.title}</h2>
              <p>${round.prompt}</p>
            </div>
            <div class="choices">
              ${config.options.map((option) => optionCard(round, option, saved)).join("")}
            </div>
          </section>
        `
      )
      .join("")}
    <div class="submitRow">
      <button type="submit">${saved ? "Update vote" : "Submit vote"}</button>
    </div>
  `;

  if (saved) {
    form.hidden = true;
    done.hidden = false;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const choices = Object.fromEntries(data.entries());
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
});

load();
