const STAGES = ["Ideation", "Validation", "PRD", "Build", "Test", "Marketing", "Monitor"];
const STORAGE_KEY = "swarm-control-state-v1";

function defaultState() {
  return {
    budget: { monthlyCredits: 1500, usedCredits: 340, dailyTokenCap: 1200000, usedTokens: 420000 },
    agents: [
      { id: crypto.randomUUID(), name: "Idea Bounce Agent", type: "Ideation", stage: "Ideation", model: "gpt-4.1-mini", tokenCap: 120000, usedTokens: 13000, status: "active" },
      { id: crypto.randomUUID(), name: "Validation Agent", type: "Validation", stage: "Validation", model: "gpt-4.1", tokenCap: 180000, usedTokens: 42000, status: "active" },
      { id: crypto.randomUUID(), name: "PRD Agent", type: "Product", stage: "PRD", model: "gpt-4.1", tokenCap: 180000, usedTokens: 31000, status: "active" },
      { id: crypto.randomUUID(), name: "Build Agent", type: "Engineering", stage: "Build", model: "gpt-4.1", tokenCap: 220000, usedTokens: 88000, status: "active" },
      { id: crypto.randomUUID(), name: "Test Agent", type: "QA", stage: "Test", model: "gpt-4.1-mini", tokenCap: 140000, usedTokens: 24000, status: "active" },
      { id: crypto.randomUUID(), name: "Marketing Agent", type: "GTM", stage: "Marketing", model: "gpt-4.1-mini", tokenCap: 120000, usedTokens: 17000, status: "active" },
      { id: crypto.randomUUID(), name: "Monitoring Agent", type: "Ops", stage: "Monitor", model: "gpt-4.1-mini", tokenCap: 100000, usedTokens: 12000, status: "active" }
    ],
    ideas: [
      { id: crypto.randomUUID(), title: "AI Sales Copilot", impact: 81, risk: 33, stage: "Validation", notes: "Summaries + CRM writeback", ownerAgentId: null, score: 0 },
      { id: crypto.randomUUID(), title: "PRD Copilot", impact: 74, risk: 28, stage: "PRD", notes: "Draft PRD from idea", ownerAgentId: null, score: 0 },
      { id: crypto.randomUUID(), title: "Support Triage AI", impact: 68, risk: 40, stage: "Build", notes: "Ticket classification", ownerAgentId: null, score: 0 }
    ],
    logs: []
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try { return JSON.parse(raw); } catch { return defaultState(); }
}

let state = loadState();

function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function findAgentForStage(stage) {
  return state.agents.find((a) => a.stage === stage && a.status === "active");
}

function stageIndex(stage) { return STAGES.indexOf(stage); }

function scoreIdea(idea) {
  return Math.max(0, Math.min(100, Math.round(idea.impact * 0.7 + (100 - idea.risk) * 0.3)));
}

function appendLog(message, level = "info") {
  state.logs.unshift({ time: new Date().toLocaleTimeString(), message, level });
  state.logs = state.logs.slice(0, 30);
}

function runCycle() {
  let progressed = 0;
  for (const idea of state.ideas) {
    const idx = stageIndex(idea.stage);
    if (idx < 0 || idx >= STAGES.length - 1) continue;

    const currentAgent = findAgentForStage(idea.stage);
    if (!currentAgent) {
      appendLog(`No active agent for ${idea.stage}; ${idea.title} is blocked.`, "warn");
      continue;
    }

    const tokenCost = 8000 + Math.floor(Math.random() * 8000);
    const creditCost = Number((tokenCost / 50000).toFixed(2));

    const overAgentCap = currentAgent.usedTokens + tokenCost > currentAgent.tokenCap;
    const overDailyCap = state.budget.usedTokens + tokenCost > state.budget.dailyTokenCap;
    const overCredit = state.budget.usedCredits + creditCost > state.budget.monthlyCredits;

    if (overAgentCap || overDailyCap || overCredit) {
      currentAgent.status = "paused";
      appendLog(`${currentAgent.name} paused by AMO limits while processing ${idea.title}.`, "error");
      continue;
    }

    currentAgent.usedTokens += tokenCost;
    state.budget.usedTokens += tokenCost;
    state.budget.usedCredits = Number((state.budget.usedCredits + creditCost).toFixed(2));

    const newStage = STAGES[idx + 1];
    idea.stage = newStage;
    idea.ownerAgentId = currentAgent.id;
    idea.score = scoreIdea(idea);
    progressed += 1;
    appendLog(`${idea.title} moved to ${newStage} by ${currentAgent.name} (${tokenCost} tokens).`);
  }

  if (!progressed) appendLog("Cycle finished: no ideas progressed.", "warn");
  persist();
  render();
}

function runCycles(times) {
  for (let i = 0; i < times; i += 1) runCycle();
}

function addAgent() {
  const name = document.getElementById("agentName").value.trim();
  const type = document.getElementById("agentType").value.trim() || "Custom";
  const stage = document.getElementById("agentStage").value;
  const tokenCap = Number(document.getElementById("agentTokenCap").value || 0);
  const model = document.getElementById("agentModel").value.trim() || "gpt-4.1-mini";
  if (!name || !stage || tokenCap < 1000) return;

  state.agents.push({ id: crypto.randomUUID(), name, type, stage, model, tokenCap, usedTokens: 0, status: "active" });
  appendLog(`New agent onboarded: ${name} for ${stage}.`);
  persist();
  render();
}

function addIdea() {
  const title = document.getElementById("ideaTitle").value.trim();
  const impact = Number(document.getElementById("ideaImpact").value || 0);
  const risk = Number(document.getElementById("ideaRisk").value || 0);
  const notes = document.getElementById("ideaNotes").value.trim();
  if (!title || impact < 1 || risk < 1) return;

  state.ideas.push({ id: crypto.randomUUID(), title, impact, risk, stage: "Ideation", notes, ownerAgentId: null, score: scoreIdea({ impact, risk }) });
  appendLog(`New idea submitted: ${title}.`);
  persist();
  render();
}

function resetData() {
  state = defaultState();
  appendLog("State reset to demo defaults.");
  persist();
  render();
}

function renderKpis() {
  const activeAgents = state.agents.filter((a) => a.status === "active").length;
  const blockedIdeas = state.ideas.filter((i) => !findAgentForStage(i.stage) && i.stage !== "Monitor").length;
  const kpis = [
    ["Active ideas", state.ideas.length],
    ["Active agents", `${activeAgents}/${state.agents.length}`],
    ["Credits used", `$${state.budget.usedCredits} / $${state.budget.monthlyCredits}`],
    ["Tokens used", `${state.budget.usedTokens.toLocaleString()} / ${state.budget.dailyTokenCap.toLocaleString()}`],
    ["Blocked ideas", blockedIdeas]
  ];
  document.getElementById("kpiGrid").innerHTML = kpis.map(([k, v]) => `<div class="k"><div class="small">${k}</div><div class="v">${v}</div></div>`).join("");
}

function renderAgents() {
  const rows = state.agents.map((a) => {
    const statusClass = a.status === "active" ? "status-active" : "status-paused";
    return `<tr>
      <td>${a.name}<div class="small">${a.type}</div></td>
      <td><span class="pill s-${a.stage}">${a.stage}</span></td>
      <td>${a.model}</td>
      <td>${a.usedTokens.toLocaleString()} / ${a.tokenCap.toLocaleString()}</td>
      <td class="${statusClass}">${a.status}</td>
      <td><button data-agent-id="${a.id}" class="toggleBtn secondary">${a.status === "active" ? "Pause" : "Resume"}</button></td>
    </tr>`;
  }).join("");
  document.getElementById("agentsTable").innerHTML = `<thead><tr><th>Agent</th><th>Stage</th><th>Model</th><th>Token Usage</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody>`;

  document.querySelectorAll(".toggleBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-agent-id");
      const agent = state.agents.find((a) => a.id === id);
      if (!agent) return;
      agent.status = agent.status === "active" ? "paused" : "active";
      appendLog(`${agent.name} set to ${agent.status} by AMO.`);
      persist();
      render();
    });
  });
}

function renderIdeas() {
  const rows = state.ideas.map((i) => {
    const owner = state.agents.find((a) => a.id === i.ownerAgentId)?.name || "Unassigned";
    return `<tr>
      <td>${i.title}<div class="small">${i.notes || "-"}</div></td>
      <td><span class="pill s-${i.stage}">${i.stage}</span></td>
      <td>${i.impact}</td>
      <td>${i.risk}</td>
      <td>${i.score || scoreIdea(i)}</td>
      <td>${owner}</td>
    </tr>`;
  }).join("");
  document.getElementById("ideasTable").innerHTML = `<thead><tr><th>Idea</th><th>Stage</th><th>Impact</th><th>Risk</th><th>Score</th><th>Last Owner</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderLogs() {
  const rows = state.logs.map((l) => `<tr><td>${l.time}</td><td>${l.level}</td><td>${l.message}</td></tr>`).join("");
  document.getElementById("logTable").innerHTML = `<thead><tr><th>Time</th><th>Level</th><th>Message</th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="small">No logs yet.</td></tr>'}</tbody>`;
}

function initForms() {
  const stageSelect = document.getElementById("agentStage");
  stageSelect.innerHTML = STAGES.map((s) => `<option value="${s}">${s}</option>`).join("");

  document.getElementById("addAgentBtn").addEventListener("click", addAgent);
  document.getElementById("addIdeaBtn").addEventListener("click", addIdea);
  document.getElementById("runCycleBtn").addEventListener("click", runCycle);
  document.getElementById("runFiveBtn").addEventListener("click", () => runCycles(5));
  document.getElementById("resetBtn").addEventListener("click", resetData);
}

function render() {
  renderKpis();
  renderAgents();
  renderIdeas();
  renderLogs();
}

initForms();
render();
