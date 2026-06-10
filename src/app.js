const TOTALS_ENDPOINT = "/api/totales";
const CANDIDATES_ENDPOINT = "/api/participantes";
const SETTINGS_ENDPOINT = "/api/settings";
const UPLOAD_ENDPOINT = "/api/upload-image";
const SETTINGS_KEY = "onpe-animation-settings-v1";
const ADMIN_SESSION_KEY = "onpe-admin-session-v1";

const fallbackTotals = {
  actasContabilizadas: 97.803,
  contabilizadas: 90728,
  totalActas: 92766,
  participacionCiudadana: 70.544,
  actasEnviadasJee: 1.743,
  enviadasJee: 1617,
  actasPendientesJee: 0.454,
  pendientesJee: 421,
  fechaActualizacion: 1781107320179,
  totalVotosEmitidos: 19276364,
  totalVotosValidos: 18016988,
  porcentajeVotosEmitidos: 100,
  porcentajeVotosValidos: 100
};

const fallbackCandidates = [
  {
    nombreAgrupacionPolitica: "FUERZA POPULAR",
    codigoAgrupacionPolitica: 8,
    nombreCandidato: "KEIKO SOFIA FUJIMORI HIGUCHI",
    dniCandidato: "10001088",
    totalVotosValidos: 9006051,
    porcentajeVotosValidos: 49.986,
    porcentajeVotosEmitidos: 46.721
  },
  {
    nombreAgrupacionPolitica: "JUNTOS POR EL PERU",
    codigoAgrupacionPolitica: 10,
    nombreCandidato: "ROBERTO HELBERT SANCHEZ PALOMINO",
    dniCandidato: "16002918",
    totalVotosValidos: 9010937,
    porcentajeVotosValidos: 50.014,
    porcentajeVotosEmitidos: 46.746
  }
];

const candidateDefaults = {
  "8": {
    accent: "#f26522",
    accentSoft: "#ffb17e",
    initials: "KF",
    logo: "K",
    image: "",
    animation: "focus",
    enabled: true,
    speed: 2.1,
    scale: 1
  },
  "10": {
    accent: "#24a857",
    accentSoft: "#ff5147",
    initials: "RS",
    logo: "JP",
    image: "",
    animation: "pulse",
    enabled: true,
    speed: 2.4,
    scale: 1
  },
  default: {
    accent: "#0a4a86",
    accentSoft: "#7fc8f8",
    initials: "CA",
    logo: "V",
    image: "",
    animation: "float",
    enabled: true,
    speed: 2.3,
    scale: 1
  }
};

const elements = {
  refreshButton: document.querySelector("#refreshButton"),
  autoRefresh: document.querySelector("#autoRefresh"),
  sourceStatus: document.querySelector("#sourceStatus"),
  actasPercent: document.querySelector("#actasPercent"),
  totalActas: document.querySelector("#totalActas"),
  actasDetail: document.querySelector("#actasDetail"),
  trackCounted: document.querySelector("#trackCounted"),
  trackJee: document.querySelector("#trackJee"),
  trackPending: document.querySelector("#trackPending"),
  updatedAt: document.querySelector("#updatedAt"),
  countedLegend: document.querySelector("#countedLegend"),
  jeeLegend: document.querySelector("#jeeLegend"),
  pendingLegend: document.querySelector("#pendingLegend"),
  candidateGrid: document.querySelector("#candidateGrid"),
  voteDifference: document.querySelector("#voteDifference"),
  differencePercent: document.querySelector("#differencePercent"),
  leaderName: document.querySelector("#leaderName"),
  leaderVotes: document.querySelector("#leaderVotes"),
  controlsGrid: document.querySelector("#controlsGrid"),
  resetSettings: document.querySelector("#resetSettings"),
  adminToggle: document.querySelector("#adminToggle"),
  adminToggleLabel: document.querySelector("#adminToggleLabel"),
  adminPanel: document.querySelector("#adminPanel"),
  adminLoginPanel: document.querySelector("#adminLoginPanel"),
  adminLoginForm: document.querySelector("#adminLoginForm"),
  adminUser: document.querySelector("#adminUser"),
  adminPassword: document.querySelector("#adminPassword"),
  adminLoginMessage: document.querySelector("#adminLoginMessage"),
  logoutAdmin: document.querySelector("#logoutAdmin"),
  candidateTemplate: document.querySelector("#candidateTemplate"),
  controlTemplate: document.querySelector("#controlTemplate")
};

let state = {
  totals: fallbackTotals,
  candidates: fallbackCandidates,
  settings: readSettings(),
  adminAuth: sessionStorage.getItem(ADMIN_SESSION_KEY) || "",
  source: "fallback",
  error: "",
  timer: null,
  settingsTimer: null
};

function readSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function adminHeaders(extra = {}) {
  return {
    ...extra,
    Authorization: `Basic ${state.adminAuth}`
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-PE").format(Number(value || 0));
}

function formatPercent(value, decimals = 3) {
  return `${Number(value || 0).toFixed(decimals)} %`;
}

function formatUpdateTime(timestamp) {
  if (!timestamp) return "Actualizado: --";

  return `Actualizado al ${new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(timestamp))}`;
}

function shortCandidateName(name) {
  const parts = String(name || "").trim().split(/\s+/);

  if (parts.length <= 3) return parts.join(" ");
  return `${parts[0]} ${parts[1]} ${parts.at(-2)} ${parts.at(-1)}`;
}

function initialsFromName(name) {
  return String(name || "CA")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getCandidateSettings(candidate) {
  const key = String(candidate.codigoAgrupacionPolitica || "default");
  const base = candidateDefaults[key] || {
    ...candidateDefaults.default,
    initials: initialsFromName(candidate.nombreCandidato),
    logo: initialsFromName(candidate.nombreAgrupacionPolitica)
  };

  return {
    ...base,
    ...(state.settings[key] || {})
  };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (!contentType.includes("application/json")) {
      throw new Error("La respuesta no es JSON.");
    }

    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.message || "Respuesta sin exito.");
    }

    return payload.data;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchSettings() {
  try {
    const settings = await fetchJson(SETTINGS_ENDPOINT);
    state.settings = settings || {};
    persistSettings();
    renderCandidates();
    if (isAdmin()) renderControls();
  } catch {
    state.settings = readSettings();
  }
}

async function saveSettings() {
  if (!isAdmin()) return;

  persistSettings();

  const response = await fetch(SETTINGS_ENDPOINT, {
    method: "POST",
    headers: adminHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify(state.settings)
  });

  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "No se pudo guardar la configuracion.");
  }
}

function isAdmin() {
  return Boolean(state.adminAuth);
}

async function refreshData() {
  elements.sourceStatus.textContent = "Cargando";
  elements.sourceStatus.className = "status-pill loading";
  elements.refreshButton.disabled = true;

  try {
    const [totals, candidates] = await Promise.all([
      fetchJson(TOTALS_ENDPOINT),
      fetchJson(CANDIDATES_ENDPOINT)
    ]);

    state.totals = totals;
    state.candidates = normalizeCandidates(candidates);
    state.source = "live";
    state.error = "";
  } catch (error) {
    state.totals = fallbackTotals;
    state.candidates = normalizeCandidates(fallbackCandidates);
    state.source = "fallback";
    state.error = error.message;
  } finally {
    elements.refreshButton.disabled = false;
    render();
  }
}

function normalizeCandidates(candidates) {
  return [...(candidates || [])]
    .filter((candidate) => candidate && candidate.nombreCandidato)
    .sort((a, b) => Number(b.totalVotosValidos || 0) - Number(a.totalVotosValidos || 0))
    .slice(0, 2);
}

function renderSummary() {
  const totals = state.totals || fallbackTotals;
  const counted = Number(totals.actasContabilizadas || 0);
  const jee = Number(totals.actasEnviadasJee || 0);
  const pending = Number(totals.actasPendientesJee || 0);

  elements.actasPercent.textContent = formatPercent(counted, 3);
  elements.totalActas.textContent = formatNumber(totals.totalActas);
  elements.actasDetail.textContent =
    `${formatPercent(jee, 3)} de actas para envio al JEE y ${formatPercent(pending, 3)} pendientes`;
  elements.trackCounted.style.width = `${Math.min(counted, 100)}%`;
  elements.trackJee.style.width = `${Math.min(jee, 100)}%`;
  elements.trackPending.style.width = `${Math.min(pending, 100)}%`;
  elements.countedLegend.textContent = `(${formatNumber(totals.contabilizadas)})`;
  elements.jeeLegend.textContent = `(${formatNumber(totals.enviadasJee)})`;
  elements.pendingLegend.textContent = `(${formatNumber(totals.pendientesJee)})`;
  elements.updatedAt.textContent = formatUpdateTime(totals.fechaActualizacion).toUpperCase();

  if (state.source === "live") {
    elements.sourceStatus.textContent = "En vivo";
    elements.sourceStatus.className = "status-pill live";
  } else {
    elements.sourceStatus.textContent = "Respaldo";
    elements.sourceStatus.className = "status-pill fallback";
    elements.sourceStatus.title = state.error || "Usando datos de ejemplo.";
  }
}

function renderDifference() {
  const [leader, runnerUp] = state.candidates;

  if (!leader || !runnerUp) return;

  const difference = Math.abs(Number(leader.totalVotosValidos || 0) - Number(runnerUp.totalVotosValidos || 0));
  const validVotes = Number(state.totals.totalVotosValidos || 0);
  const differencePercent = validVotes ? (difference / validVotes) * 100 : 0;

  elements.voteDifference.textContent = `${formatNumber(difference)} votos`;
  elements.differencePercent.textContent = `${differencePercent.toFixed(3)} puntos sobre votos validos`;
  elements.leaderName.textContent = shortCandidateName(leader.nombreCandidato);
  elements.leaderVotes.textContent = `${formatNumber(leader.totalVotosValidos)} votos`;
}

function renderCandidates() {
  elements.candidateGrid.replaceChildren();

  state.candidates.forEach((candidate, index) => {
    const config = getCandidateSettings(candidate);
    const fragment = elements.candidateTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".candidate-card");
    const image = fragment.querySelector("img");
    const initials = fragment.querySelector(".portrait span");
    const key = String(candidate.codigoAgrupacionPolitica || "default");

    card.dataset.candidate = key;
    card.classList.add(index === 0 ? "is-leading" : "is-trailing");
    card.dataset.animation = config.enabled ? config.animation : "none";
    card.style.setProperty("--candidate-accent", config.accent);
    card.style.setProperty("--candidate-soft", config.accentSoft || config.accent);
    card.style.setProperty("--candidate-progress", `${Number(candidate.porcentajeVotosValidos || 0)}%`);
    card.style.setProperty("--animation-speed", `${Number(config.speed || 2.2)}s`);
    card.style.setProperty("--candidate-scale", Number(config.scale || 1));

    image.src = config.image || "";
    image.alt = `Foto de ${shortCandidateName(candidate.nombreCandidato)}`;
    image.hidden = !config.image;
    initials.textContent = config.initials || initialsFromName(candidate.nombreCandidato);
    initials.hidden = Boolean(config.image);
    image.addEventListener("error", () => {
      image.hidden = true;
      initials.hidden = false;
    });

    fragment.querySelector(".candidate-percent").textContent = formatPercent(candidate.porcentajeVotosValidos, 3);
    fragment.querySelector(".movement-badge").textContent = index === 0 ? "Lidera" : "Sigue";
    fragment.querySelector("h2").textContent = shortCandidateName(candidate.nombreCandidato);
    fragment.querySelector(".party-logo").textContent = config.logo || initialsFromName(candidate.nombreAgrupacionPolitica);
    fragment.querySelector(".party-name").textContent = candidate.nombreAgrupacionPolitica;
    fragment.querySelector(".votes").textContent = `${formatNumber(candidate.totalVotosValidos)} votos`;
    fragment.querySelector(".vote-meter span").style.width = `${Number(candidate.porcentajeVotosValidos || 0)}%`;

    elements.candidateGrid.append(fragment);
  });
}

function renderControls() {
  if (!isAdmin()) {
    elements.controlsGrid.replaceChildren();
    return;
  }

  elements.controlsGrid.replaceChildren();

  state.candidates.forEach((candidate) => {
    const key = String(candidate.codigoAgrupacionPolitica || "default");
    const config = getCandidateSettings(candidate);
    const fragment = elements.controlTemplate.content.cloneNode(true);
    const control = fragment.querySelector(".control-card");

    control.dataset.candidate = key;
    control.style.setProperty("--candidate-accent", config.accent);
    fragment.querySelector(".control-avatar").textContent = config.initials || initialsFromName(candidate.nombreCandidato);
    fragment.querySelector("h3").textContent = shortCandidateName(candidate.nombreCandidato);
    fragment.querySelector("p").textContent = candidate.nombreAgrupacionPolitica;

    const enabled = fragment.querySelector('[data-field="enabled"]');
    const animation = fragment.querySelector('[data-field="animation"]');
    const speed = fragment.querySelector('[data-field="speed"]');
    const scale = fragment.querySelector('[data-field="scale"]');
    const accent = fragment.querySelector('[data-field="accent"]');
    const image = fragment.querySelector('[data-field="image"]');

    enabled.checked = Boolean(config.enabled);
    animation.value = config.animation || "none";
    speed.value = Number(config.speed || 2.2);
    scale.value = Number(config.scale || 1);
    accent.value = config.accent || "#0a4a86";
    image.value = config.image || "";

    fragment.querySelector('[data-output="speed"]').textContent = `${Number(speed.value).toFixed(1)} s`;
    fragment.querySelector('[data-output="scale"]').textContent = `${Number(scale.value).toFixed(2)}x`;

    elements.controlsGrid.append(fragment);
  });
}

function render() {
  renderSummary();
  renderDifference();
  renderCandidates();
  renderAdminState();
  renderControls();
}

function renderAdminState() {
  const isVisible = isAdmin();

  elements.adminPanel.classList.toggle("is-hidden", !isVisible);
  if (isVisible) {
    elements.adminLoginPanel.classList.add("is-hidden");
  }
  elements.adminToggleLabel.textContent = isVisible ? "Admin activo" : "Admin";
}

function updateSetting(card, field, value) {
  const key = card.dataset.candidate;
  const current = state.settings[key] || {};

  state.settings[key] = {
    ...current,
    [field]: value
  };

  persistSettings();
}

function setFormMessage(message, tone = "") {
  elements.adminLoginMessage.textContent = message;
  elements.adminLoginMessage.dataset.tone = tone;
}

function setUploadMessage(card, message, tone = "") {
  const target = card.querySelector("[data-upload-message]");

  if (!target) return;

  target.textContent = message;
  target.dataset.tone = tone;
}

function updateRangeOutput(target) {
  const control = target.closest(".control-card");
  const output = control?.querySelector(`[data-output="${target.dataset.field}"]`);

  if (!output) return;

  output.textContent =
    target.dataset.field === "speed"
      ? `${Number(target.value).toFixed(1)} s`
      : `${Number(target.value).toFixed(2)}x`;
}

elements.controlsGrid.addEventListener("input", (event) => {
  const target = event.target;
  const field = target.dataset.field;
  const card = target.closest(".control-card");

  if (!field || !card) return;

  if (field === "speed" || field === "scale") {
    updateSetting(card, field, Number(target.value));
    updateRangeOutput(target);
    renderCandidates();
  } else if (field === "accent" || field === "image") {
    updateSetting(card, field, target.value.trim());
    if (field === "accent") renderCandidates();
  }
});

elements.controlsGrid.addEventListener("change", async (event) => {
  const target = event.target;
  const field = target.dataset.field;
  const card = target.closest(".control-card");

  if (!field || !card) return;

  if (field === "enabled") {
    updateSetting(card, field, target.checked);
    renderCandidates();
    await saveSettings().catch((error) => setUploadMessage(card, error.message, "error"));
    return;
  }

  if (field === "animation") {
    updateSetting(card, field, target.value);
    renderCandidates();
    await saveSettings().catch((error) => setUploadMessage(card, error.message, "error"));
    return;
  }

  if (field === "speed" || field === "scale") {
    updateSetting(card, field, Number(target.value));
    updateRangeOutput(target);
    renderCandidates();
    await saveSettings().catch((error) => setUploadMessage(card, error.message, "error"));
    return;
  }

  if (field === "accent") {
    updateSetting(card, field, target.value.trim());
    renderCandidates();
    await saveSettings().catch((error) => setUploadMessage(card, error.message, "error"));
    return;
  }

  if (field === "image") {
    updateSetting(card, field, target.value.trim());
    renderCandidates();
    await saveSettings().catch((error) => setUploadMessage(card, error.message, "error"));
    return;
  }

  if (field === "imageFile") {
    await uploadCandidateImage(card, target.files?.[0]);
  }
});

async function uploadCandidateImage(card, file) {
  if (!file) return;

  setUploadMessage(card, "Subiendo imagen...");

  try {
    const body = new FormData();
    body.append("image", file);

    const response = await fetch(UPLOAD_ENDPOINT, {
      method: "POST",
      headers: adminHeaders(),
      body
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "No se pudo subir la imagen.");
    }

    updateSetting(card, "image", payload.data.url);
    const input = card.querySelector('[data-field="image"]');
    if (input) input.value = payload.data.url;
    renderCandidates();
    await saveSettings();
    setUploadMessage(card, "Imagen guardada y compartida.", "success");
  } catch (error) {
    setUploadMessage(card, error.message, "error");
  }
}

elements.refreshButton.addEventListener("click", refreshData);

elements.resetSettings.addEventListener("click", () => {
  localStorage.removeItem(SETTINGS_KEY);
  state.settings = {};
  saveSettings().catch((error) => {
    elements.adminLoginMessage.textContent = error.message;
  });
  render();
});

elements.adminToggle.addEventListener("click", () => {
  if (isAdmin()) {
    elements.adminPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  elements.adminLoginPanel.classList.toggle("is-hidden");
  if (!elements.adminLoginPanel.classList.contains("is-hidden")) {
    elements.adminLoginPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    elements.adminUser.focus();
  }
});

elements.adminLoginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const user = elements.adminUser.value.trim();
  const password = elements.adminPassword.value;

  if (user !== "admin" || password !== "admin") {
    setFormMessage("Usuario o clave incorrectos.", "error");
    return;
  }

  state.adminAuth = btoa(`${user}:${password}`);
  sessionStorage.setItem(ADMIN_SESSION_KEY, state.adminAuth);
  elements.adminLoginForm.reset();
  setFormMessage("");
  render();
  elements.adminPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

elements.logoutAdmin.addEventListener("click", () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  state.adminAuth = "";
  render();
});

elements.autoRefresh.addEventListener("change", () => {
  setupAutoRefresh();
});

function setupAutoRefresh() {
  if (state.timer) {
    window.clearInterval(state.timer);
    state.timer = null;
  }

  if (elements.autoRefresh.checked) {
    state.timer = window.setInterval(refreshData, 60000);
  }
}

function setupSettingsRefresh() {
  if (state.settingsTimer) {
    window.clearInterval(state.settingsTimer);
    state.settingsTimer = null;
  }

  state.settingsTimer = window.setInterval(() => {
    if (!isAdmin()) fetchSettings();
  }, 10000);
}

state.candidates = normalizeCandidates(state.candidates);
render();
fetchSettings();
refreshData();
setupAutoRefresh();
setupSettingsRefresh();
