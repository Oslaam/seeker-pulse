type Verdict = "aligned" | "watch" | "at_risk" | "idle";
interface Category { id: string; label: string; verdict: Verdict; detail: string; value: number; unit: string; }
interface Suggestion { text: string; }
interface LookupData { address: string; skrDomain: string | null; isSeekerWallet: boolean; scorecard: { overallVerdict: Verdict; categories: Category[]; suggestions: Suggestion[] }; nextResetUtc: string; }
interface DomainSuggestionResponse { domains: Array<{ domain: string | null; address: string }>; }

const form = document.getElementById("lookup-form") as HTMLFormElement;
const input = document.getElementById("lookup-input") as HTMLInputElement;
const scanBtn = document.getElementById("scan-btn") as HTMLButtonElement;
const formError = document.getElementById("form-error") as HTMLDivElement;
const loadingEl = document.getElementById("loading") as HTMLElement;
const resultEl = document.getElementById("result") as HTMLElement;
const identityBanner = document.getElementById("identity-banner") as HTMLElement;
const ringsGrid = document.getElementById("rings-grid") as HTMLElement;
const verdictBanner = document.getElementById("verdict-banner") as HTMLElement;
const suggestionsList = document.getElementById("suggestions-list") as HTMLUListElement;
const metaAddress = document.getElementById("meta-address") as HTMLElement;
const metaCountdown = document.getElementById("meta-countdown") as HTMLElement;
const domainSuggestions = document.getElementById("domain-suggestions") as HTMLDivElement;
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let suggestionRequest: ReturnType<typeof setTimeout> | null = null;
let suggestionRequestId = 0;

input.addEventListener("input", () => scheduleDomainSuggestions(input.value));
input.addEventListener("focus", () => scheduleDomainSuggestions(input.value));
input.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideDomainSuggestions();
});
document.addEventListener("click", (event) => {
  if (!form.contains(event.target as Node)) hideDomainSuggestions();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) return;
  const lookupQuery = normalizeLookupQuery(query);
  setLoading(true); formError.hidden = true; resultEl.hidden = true;
  try {
    const response = await fetch(`/api/lookup?q=${encodeURIComponent(lookupQuery)}`);
    const data = await response.json() as LookupData & { error?: string };
    if (!response.ok) throw new Error(data.error || "Lookup failed.");
    hideDomainSuggestions();
    render(data);
  } catch (error) { formError.textContent = error instanceof Error ? error.message : "Lookup failed."; formError.hidden = false; }
  finally { setLoading(false); }
});

function normalizeLookupQuery(query: string): string {
  const name = query.toLowerCase();
  return /^[a-z0-9-]{2,63}$/.test(name) ? `${name}.skr` : query;
}

function scheduleDomainSuggestions(value: string): void {
  if (suggestionRequest) clearTimeout(suggestionRequest);
  const requestId = ++suggestionRequestId;
  suggestionRequest = setTimeout(() => loadDomainSuggestions(value, requestId), 350);
}

async function loadDomainSuggestions(value: string, requestId: number): Promise<void> {
  const normalized = value.trim().toLowerCase().replace(/\.skr$/, "");
  if (!/^[a-z0-9-]{2,63}$/.test(normalized)) {
    hideDomainSuggestions();
    return;
  }

  try {
    const response = await fetch(`/api/domain-suggestions?name=${encodeURIComponent(normalized)}`);
    const data = await response.json() as DomainSuggestionResponse;
    if (requestId !== suggestionRequestId || input.value.trim().toLowerCase().replace(/\.skr$/, "") !== normalized) return;
    renderDomainSuggestions(data.domains.map((suggestion) => suggestion.domain).filter((domain): domain is string => Boolean(domain)));
  } catch {
    if (requestId === suggestionRequestId) hideDomainSuggestions();
  }
}

function renderDomainSuggestions(domains: string[]): void {
  domainSuggestions.innerHTML = "";
  if (domains.length === 0) {
    hideDomainSuggestions();
    return;
  }

  for (const domain of domains) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "domain-suggestion";
    option.setAttribute("role", "option");
    option.textContent = domain;
    option.addEventListener("click", () => {
      input.value = domain;
      hideDomainSuggestions();
      input.focus();
    });
    domainSuggestions.appendChild(option);
  }
  domainSuggestions.hidden = false;
}

function hideDomainSuggestions(): void {
  domainSuggestions.hidden = true;
}

function setLoading(isLoading: boolean): void { loadingEl.hidden = !isLoading; scanBtn.disabled = isLoading; }
function render(data: LookupData): void { renderBanner(data); renderCategories(data.scorecard.categories); renderSuggestions(data.scorecard.suggestions); metaAddress.textContent = data.skrDomain || shortenAddress(data.address); startCountdown(data.nextResetUtc); resultEl.hidden = false; resultEl.scrollIntoView({ behavior: "smooth", block: "start" }); }
function renderBanner(data: LookupData): void { identityBanner.innerHTML = ""; const badge = document.createElement("span"); badge.className = "badge"; badge.textContent = data.isSeekerWallet ? "SEEKER ID" : "UNKNOWN"; identityBanner.className = `identity-banner ${data.isSeekerWallet ? "confirmed" : "unknown"}`; identityBanner.append(badge, textNode(data.isSeekerWallet ? (data.skrDomain ? `Confirmed Seeker wallet — ${data.skrDomain}` : "Confirmed Seeker wallet.") : "No .skr Seeker ID detected for this wallet — showing raw on-chain activity only. Official Seeker eligibility can't be confirmed here.")); const verdict = data.scorecard.overallVerdict; verdictBanner.className = `verdict-banner ${verdict}`; const title = document.createElement("strong"); title.textContent = verdict === "aligned" ? "✅ Looks aligned with natural use" : verdict === "watch" ? "⚠️ Some patterns worth a look" : verdict === "idle" ? "⏸️ Not enough recent activity" : "🔴 This looks like manufactured activity"; const explanation = document.createElement("span"); explanation.className = "verdict-explanation"; explanation.textContent = verdict === "aligned" ? "Your recent activity is varied and spread out. We found no strong repetition, burst, or dust-transfer pattern." : verdict === "watch" ? "One or more signals appeared recently. That is ambiguous, not a judgment, but varied activity is worth prioritizing." : verdict === "idle" ? "There are no recent transactions or dApp interactions to assess. Idle is neutral: it is not a risk signal." : "Repeated actions combined with burst timing or negligible transfers resemble activity made to grind a score."; verdictBanner.replaceChildren(title, explanation); }
function textNode(value: string): HTMLSpanElement { const span = document.createElement("span"); span.textContent = value; return span; }
function renderCategories(categories: Category[]): void { ringsGrid.innerHTML = ""; for (const category of categories) { const card = document.createElement("article"); card.className = `category-card ${category.verdict}`; const heading = document.createElement("div"); heading.className = "category-heading"; const label = document.createElement("h2"); label.textContent = category.label; const badge = document.createElement("span"); badge.className = "verdict-badge"; badge.textContent = verdictLabel(category.verdict); heading.append(label, badge); const raw = document.createElement("div"); raw.className = "category-raw"; raw.textContent = `${category.value} ${category.unit}`; const detail = document.createElement("p"); detail.className = "category-detail"; detail.textContent = category.detail; card.append(heading, raw, detail); ringsGrid.appendChild(card); } }
function verdictLabel(verdict: Verdict): string { return verdict === "aligned" ? "Aligned" : verdict === "watch" ? "Watch" : verdict === "idle" ? "Idle" : "At risk"; }
function renderSuggestions(suggestions: Suggestion[]): void { suggestionsList.innerHTML = ""; for (const suggestion of suggestions) { const item = document.createElement("li"); item.textContent = suggestion.text; suggestionsList.appendChild(item); } }
function shortenAddress(address: string): string { return !address || address.length < 10 ? address : `${address.slice(0, 4)}…${address.slice(-4)}`; }
function startCountdown(nextResetIso: string): void { if (countdownTimer) clearInterval(countdownTimer); const target = new Date(nextResetIso).getTime(); const tick = () => { const diff = target - Date.now(); if (diff <= 0) { metaCountdown.textContent = "resetting…"; if (countdownTimer) clearInterval(countdownTimer); return; } const hours = String(Math.floor(diff / 3_600_000)).padStart(2, "0"); const minutes = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, "0"); const seconds = String(Math.floor((diff % 60_000) / 1000)).padStart(2, "0"); metaCountdown.textContent = `${hours}:${minutes}:${seconds} UTC`; }; tick(); countdownTimer = setInterval(tick, 1000); }