"use strict";

// The published site runs this same file read-only, from data/recipes.json instead of the Mac server.
const PUBLISHED = document.documentElement.dataset.mode === "published";
const SIZES = ["Small", "Medium", "Large", "Extra Large"];
const SIZE_LETTERS = { Small: "S", Medium: "M", Large: "L", "Extra Large": "XL" };
const TEMPERATURE_NAMES = { HOT: "HOT", ICED: "ICED", UNKNOWN: "온도 미확인" };
const MIN_ROWS = 4;
// Suggestions only: the 보조(단위) cell accepts any text.
const COUNTED_UNITS = [["pump", "pumps"], ["shot", "shots"], ["ts", "ts"], ["Tbs", "Tbs"], ["scoop", "scoops"]];
const OTHER_UNITS = ["spoon", "cup", "pc", "slice", "drop", "pinch", "dash", "oz", "ml", "g"];
const RECENT_COUNT = 8;
const app = document.getElementById("app");
const sidebar = document.getElementById("sidebar");
// The dashboard shows drinks or prep items. Prep items have no temperature: their one sheet is PREP.
const KIND_NAMES = { menu: "메뉴", prep: "프렙" };
const INFO_FIELDS = [["yield_text", "완성량"], ["storage_method", "보관 방법"], ["storage_period", "보관 기간"]];
const state = {
  table: null, guides: { menu: "", prep: "" }, categories: [], recipe: null, recipes: [],
  kind: "menu", filter: "all", category: "all", query: "", highlightId: null,
  temperature: "HOT", dirty: false, saveFailed: false, timer: null, queue: Promise.resolve(),
};

/* Fixed artwork and icons. These strings are constants, never user text. */
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  cup: '<path d="M5 9h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M9 3v2.5M13 3v2.5"/>',
  book: '<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z"/><path d="M5 20.5A2.5 2.5 0 0 0 7.5 21H19v-3"/>',
  flame: '<path d="M12 3c.5 3.5 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2 1-3.2 2-4 .2 1.5 1 2.3 2 2.5-.4-3 .2-6.5 1-9z"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  link: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  power: '<path d="M12 3v9"/><path d="M6.5 6.5a8 8 0 1 0 11 0"/>',
};
const HOT_ART = `<svg viewBox="0 0 200 130" aria-hidden="true">
  <g fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="4.5" stroke-linecap="round">
    <path d="M82 31c-7-7 7-12 0-20"/><path d="M102 31c-7-7 7-12 0-20"/><path d="M122 31c-7-7 7-12 0-20"/></g>
  <ellipse cx="102" cy="124" rx="74" ry="6" fill="#fff" fill-opacity=".55"/>
  <path d="M146 54h9a16 16 0 0 1 0 32h-12" fill="none" stroke="#fff" stroke-width="8"/>
  <path d="M58 44h88v34a42 42 0 0 1-42 42h-4a42 42 0 0 1-42-42z" fill="#fff"/>
  <ellipse cx="102" cy="44" rx="44" ry="8" fill="#8a5630"/>
  <ellipse cx="102" cy="44" rx="20" ry="3.5" fill="#e9cfae"/></svg>`;
const ICED_ART = `<svg viewBox="0 0 200 130" aria-hidden="true">
  <path d="M118 2l-9 40" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
  <path d="M66 28h68l-8 94a6 6 0 0 1-6 6H80a6 6 0 0 1-6-6z" fill="#fff" fill-opacity=".42"/>
  <path d="M69 62h62l-5 60a6 6 0 0 1-6 6H80a6 6 0 0 1-6-6z" fill="#f4e7d6"/>
  <path d="M69 62h62l-2.6 31c-17 7-40-5-56.8 1z" fill="#a9703f"/>
  <g fill="#fff" fill-opacity=".72">
    <rect x="78" y="40" width="20" height="20" rx="4" transform="rotate(-12 88 50)"/>
    <rect x="104" y="46" width="19" height="19" rx="4" transform="rotate(14 113 55)"/>
    <rect x="90" y="68" width="18" height="18" rx="4" transform="rotate(8 99 77)"/></g></svg>`;
const PREP_ART = `<svg viewBox="0 0 200 130" aria-hidden="true">
  <ellipse cx="100" cy="124" rx="60" ry="6" fill="#fff" fill-opacity=".5"/>
  <rect x="72" y="12" width="56" height="17" rx="5" fill="#8a5630"/>
  <path d="M66 33h68v75a14 14 0 0 1-14 14H80a14 14 0 0 1-14-14z" fill="#fff"/>
  <path d="M66 54h68v38H66z" fill="#f4e7d6"/>
  <path d="M83 73c6-7 11 7 17 0s11 7 17 0" fill="none" stroke="#a9703f" stroke-width="4" stroke-linecap="round"/>
  <rect x="74" y="29" width="52" height="6" rx="3" fill="#fff" fill-opacity=".75"/></svg>`;

function fromMarkup(markup) {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  return template.content.firstChild;
}

function icon(name) {
  return fromMarkup(`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`);
}

function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (key === "class") element.className = value;
    else if (key.startsWith("on")) element.addEventListener(key.slice(2), value);
    else if (key in element && key !== "list") element[key] = value;
    else element.setAttribute(key, value);
  }
  element.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return element;
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "요청을 처리하지 못했습니다");
  return body;
}

function sendJson(method, value) {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) };
}

function toast(message, duration = 2200) {
  const element = document.getElementById("toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), duration);
}

/* ---------- saving ---------- */

function setSaveState(text) {
  const element = document.getElementById("save-state");
  if (element) element.textContent = text;
}

function changed() {
  state.dirty = true;
  setSaveState("저장 중…");
  clearTimeout(state.timer);
  state.timer = setTimeout(save, 500);
}

function save() {
  clearTimeout(state.timer);
  if (!state.dirty || !state.recipe) return state.queue;
  state.dirty = false;
  const snapshot = JSON.stringify(state.recipe);
  const { id } = state.recipe;
  state.queue = state.queue.then(async () => {
    try {
      const saved = await api(`/api/recipes/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: snapshot,
      });
      state.saveFailed = false;
      if (state.recipe && state.recipe.id === id) state.recipe.md_name = saved.md_name;
      if (!state.dirty) setSaveState(`저장됨 · recipes/${saved.md_name}`);
      await loadRecipes();
      if (state.recipe && state.recipe.id === id) renderSidebar(id);
    } catch (error) {
      state.saveFailed = true;
      setSaveState(`저장 실패: ${error.message}`);
    }
  });
  return state.queue;
}

window.addEventListener("beforeunload", () => {
  if (state.dirty && state.recipe) {
    fetch(`/api/recipes/${state.recipe.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state.recipe), keepalive: true,
    });
  }
});

/* ---------- data source ---------- */

async function fetchPublished() {
  const response = await fetch("data/recipes.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("레시피를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.");
  return response.json();
}

async function readSetup() {
  if (PUBLISHED) {
    const data = await fetchPublished();
    return { table: data.sizes, guides: { menu: "", prep: "" }, categories: data.categories || [] };
  }
  const [table, guide, categories] = await Promise.all([api("/api/sizes"), api("/api/guide"), api("/api/categories")]);
  return { table, guides: { menu: guide.text, prep: guide.prep }, categories };
}

async function readRecipes() {
  return PUBLISHED ? (await fetchPublished()).recipes : api("/api/recipes");
}

async function readRecipe(id) {
  if (!PUBLISHED) return api(`/api/recipes/${id}`);
  const recipe = state.recipes.find((item) => item.id === Number(id));
  if (!recipe) throw new Error("레시피를 찾을 수 없습니다.");
  return recipe;
}

/* ---------- shared recipe list ---------- */

async function loadRecipes() {
  state.recipes = await readRecipes();
}

function temperaturesOf(recipe) {
  const found = (recipe.temperatures || "").split(",").filter(Boolean);
  return ["HOT", "ICED", "UNKNOWN"].filter((temperature) => found.includes(temperature));
}

function isPrep(recipe) {
  return recipe.kind === "prep";
}

// The same comparison as prep.name_key: spaces and letter case do not count.
function nameKey(name) {
  return (name || "").replace(/\s+/g, "").toLowerCase();
}

// Which prep each ingredient name stands for, worked out like storage._prep_ids:
// a prep's own name comes before its other names, and the older prep wins a tie.
function prepIndex() {
  if (prepIndex.source === state.recipes) return prepIndex.map;
  const preps = state.recipes.filter(isPrep).sort((a, b) => a.id - b.id);
  const map = new Map();
  const add = (name, prep) => {
    const key = nameKey(name);
    if (key && !map.has(key)) map.set(key, prep);
  };
  preps.forEach((prep) => add(prep.menu_name, prep));
  preps.forEach((prep) => (prep.aliases || []).forEach((alias) => add(alias, prep)));
  prepIndex.source = state.recipes;
  prepIndex.map = map;
  return map;
}

function linkedPrep(name) {
  const prep = prepIndex().get(nameKey(name));
  return prep && prep.id !== state.recipe.id ? prep : null;
}

// Korean particles follow the last syllable: 을/를, 과/와, 이/가, and 으로/로, where ㄹ also takes 로.
function josa(word, withFinal, withoutFinal) {
  const code = (word || "").trim().slice(-1).charCodeAt(0) - 0xac00;
  if (!(code >= 0 && code < 11172)) return withoutFinal;
  const final = code % 28;
  return final && !(withFinal === "으로" && final === 8) ? withFinal : withoutFinal;
}

// Enter that finishes a Korean syllable is not a submit. Safari reports it as key code 229.
function composing(event) {
  return event.isComposing || event.keyCode === 229;
}

function needsAttention(recipe) {
  return recipe.blank_count > 0 || recipe.review_count > 0 || recipe.variant_count === 0;
}

function sideDot(recipe) {
  if (isPrep(recipe)) return h("span", { class: "side-dot prep" });
  const temperatures = temperaturesOf(recipe);
  const hot = temperatures.includes("HOT");
  const iced = temperatures.includes("ICED");
  return h("span", { class: `side-dot ${hot && iced ? "both" : hot ? "hot" : iced ? "iced" : ""}` });
}

function renderSidebar(activeId) {
  const recent = state.recipes.slice(0, RECENT_COUNT);
  const parts = [
    h("a", { class: "brand", href: "#/" }, h("span", { class: "brand-mark" }, icon("cup")), PUBLISHED ? "Cafe Note" : "Cafe Recipe Note"),
    PUBLISHED ? null : h("button", { class: "new-button", onclick: openNewDialog }, icon("plus"), "새 레시피 작성"),
    h("nav", { class: "side-nav" },
      h("a", { class: `side-link ${activeId ? "" : "active"}`, href: "#/" }, icon("grid"), "Dashboard")),
    h("p", { class: "side-title" }, "최근 레시피"),
    h("div", { class: "side-list" }, recent.length
      ? recent.map((recipe) => h("a", {
        class: `side-link ${recipe.id === activeId ? "active" : ""}`, href: `#/recipe/${recipe.id}`,
      }, sideDot(recipe), h("span", { class: "side-name" }, recipe.menu_name || (isPrep(recipe) ? "프렙명 미확인" : "메뉴명 미확인"))))
      : h("p", { class: "side-empty" }, "아직 없습니다")),
    PUBLISHED ? null : h("button", { class: "publish-button", onclick: publishSite }, icon("phone"), "휴대폰에 게시"),
    PUBLISHED ? null : h("button", { class: "quit-button", onclick: quitApp }, icon("power"), "앱 종료"),
  ];
  sidebar.replaceChildren(...parts.filter(Boolean));
}

async function quitApp() {
  if (document.querySelector(".publish-button").disabled) {
    toast("게시가 끝난 뒤에 종료해 주세요.");
    return;
  }
  await save();
  if (state.saveFailed) {
    toast("저장하지 못한 내용이 있어 종료하지 않았습니다. 내용을 확인해 주세요.", 5000);
    return;
  }
  try {
    await api("/api/quit", { method: "POST" });
  } catch (error) {
    // No reply at all means the server is already off, as in a tab left open from earlier.
    if (!(error instanceof TypeError)) {
      toast(error.message, 5000);
      return;
    }
  }
  document.title = "Cafe Recipe Note 종료됨";
  document.getElementById("toast").classList.remove("show");
  document.querySelector(".shell").replaceChildren(h("main", { class: "quit-page" },
    h("h1", {}, "레시피 앱을 종료했습니다"),
    h("p", { class: "muted" }, "이 탭은 닫으셔도 됩니다. 다시 쓰려면 Cafe Note 앱을 실행하세요.")));
}

async function publishSite(event) {
  const button = event.currentTarget;
  if (!confirm("현재 레시피 전체를 공개 사이트에 올릴까요? 주소를 아는 사람은 누구나 볼 수 있습니다.")) return;
  button.disabled = true;
  try {
    await save();
    const { message } = await api("/api/publish", { method: "POST" });
    toast(message, 7000);
  } catch (error) {
    toast(error.message, 9000);
  } finally {
    button.disabled = false;
  }
}

/* ---------- dashboard ---------- */

const TILES = [
  { key: "all", label: "전체 메뉴", icon: "book", match: () => true },
  { key: "HOT", label: "HOT", icon: "flame", match: (r) => temperaturesOf(r).includes("HOT") },
  { key: "ICED", label: "ICED", icon: "snow", match: (r) => temperaturesOf(r).includes("ICED") },
  { key: "review", label: "확인 필요", icon: "alert", match: needsAttention },
].filter((item) => !PUBLISHED || item.key !== "review");

function renderDashboard() {
  document.title = PUBLISHED ? "Cafe Note" : "Cafe Recipe Dashboard";
  const content = h("div", { class: "content" });
  app.replaceChildren(content);
  if (!state.recipes.length) {
    content.append(
      h("div", { class: "page-head" }, h("div", {}, h("h1", {}, PUBLISHED ? "Cafe Note" : "Dashboard"))),
      h("div", { class: "empty" },
        artwork(["HOT", "ICED"]),
        h("h2", {}, PUBLISHED ? "아직 게시된 레시피가 없습니다" : "첫 레시피를 만들어 보세요"),
        h("p", {}, PUBLISHED
          ? "Mac 앱에서 '휴대폰에 게시'를 누르면 레시피가 이곳에 나타납니다."
          : "Gemini 요약을 넣으면 서식이 자동으로 채워지고, 레시피가 이곳에 카드로 나타납니다."),
        PUBLISHED ? null : h("button", { class: "button primary", onclick: openNewDialog }, icon("plus"), "새 레시피 작성")));
    return;
  }
  const switcher = h("div", { class: "kind-switch", role: "group", "aria-label": "메뉴와 프렙" });
  const tiles = h("div");
  const list = h("div");
  const paint = () => {
    switcher.replaceChildren(...["menu", "prep"].map(kindOption));
    tiles.className = state.kind === "prep" ? "chips" : "tiles";
    tiles.replaceChildren(...(state.kind === "prep" ? prepChips() : TILES.map(tile)));
    list.replaceChildren(...recipeSection());
  };
  renderDashboard.paint = paint;
  content.append(
    h("div", { class: "page-head" },
      h("div", {}, h("h1", {}, PUBLISHED ? "Cafe Note" : "Dashboard"),
        h("p", { class: "muted" }, PUBLISHED ? "게시한 레시피를 확인하세요" : "저장한 레시피를 한눈에 확인하세요")),
      h("label", { class: "search" }, icon("search"), h("input", {
        type: "search", placeholder: "이름, 채널 검색", "aria-label": "레시피 검색", value: state.query,
        oninput: (event) => { state.query = event.target.value; paint(); },
      }))),
    switcher, tiles, list);
  paint();
  const fresh = list.querySelector(".is-new");
  if (fresh) fresh.scrollIntoView({ block: "center", behavior: "smooth" });
}

function ofKind(kind) {
  return state.recipes.filter((recipe) => (isPrep(recipe) ? "prep" : "menu") === kind);
}

function kindOption(kind) {
  return h("button", {
    class: "kind-option", "aria-pressed": String(state.kind === kind),
    onclick: () => {
      state.kind = kind;
      state.filter = "all";
      state.category = "all";
      renderDashboard.paint();
    },
  }, KIND_NAMES[kind], h("span", { class: "kind-count" }, String(ofKind(kind).length)));
}

// Chips for prep items: every category in order, then the ones still waiting for one.
const UNSET = "unset";
const REVIEW = "review";

function prepChoices() {
  const choices = [{ key: "all", label: "전체", match: () => true },
    ...state.categories.map((name) => ({ key: name, label: name, match: (r) => r.category === name }))];
  if (ofKind("prep").some((r) => !r.category)) choices.push({ key: UNSET, label: "분류 미지정", match: (r) => !r.category });
  if (!PUBLISHED) choices.push({ key: REVIEW, label: "확인 필요", match: needsAttention });
  return choices;
}

function prepChips() {
  return prepChoices().map((choice) => h("button", {
    class: `chip ${choice.key === REVIEW || choice.key === UNSET ? "review" : ""}`,
    "aria-pressed": String(state.category === choice.key),
    onclick: () => { state.category = state.category === choice.key ? "all" : choice.key; renderDashboard.paint(); },
  }, choice.label, h("span", { class: "chip-count" }, String(ofKind("prep").filter(choice.match).length))));
}

function tile(item) {
  return h("button", {
    class: `tile ${item.key === "HOT" ? "hot" : item.key === "ICED" ? "iced" : item.key === "review" ? "review" : ""}`,
    "aria-pressed": String(state.filter === item.key),
    onclick: () => { state.filter = state.filter === item.key ? "all" : item.key; renderDashboard.paint(); },
  },
  h("span", { class: "tile-icon" }, icon(item.icon)),
  h("span", {},
    h("span", { class: "tile-label" }, item.label),
    h("span", { class: "tile-value" }, String(ofKind("menu").filter(item.match).length))));
}

function currentChoice() {
  if (state.kind === "menu") return TILES.find((item) => item.key === state.filter);
  return prepChoices().find((item) => item.key === state.category) || prepChoices()[0];
}

function visibleRecipes() {
  const { match } = currentChoice();
  const query = state.query.trim().toLowerCase();
  return ofKind(state.kind).filter((recipe) => match(recipe)
    && `${recipe.menu_name || ""} ${recipe.channel || ""} ${(recipe.aliases || []).join(" ")}`.toLowerCase().includes(query));
}

function recipeSection() {
  const recipes = visibleRecipes();
  const choice = currentChoice();
  const prep = state.kind === "prep";
  const empty = !ofKind(state.kind).length && prep
    ? (PUBLISHED ? "아직 게시된 프렙이 없습니다." : "아직 프렙이 없습니다. 새 레시피 작성에서 프렙 안내문을 쓰거나 빈 프렙 서식으로 시작하세요.")
    : "조건에 맞는 레시피가 없습니다.";
  return [
    h("div", { class: "section-head" }, h("h2", {}, choice.key === "all" ? `내 ${KIND_NAMES[state.kind]}` : choice.label),
      h("span", { class: "muted" }, `${recipes.length}개`)),
    recipes.length
      ? h("div", { class: "cards" }, recipes.map((recipe) => (isPrep(recipe) ? prepCard(recipe) : card(recipe))))
      : h("p", { class: "no-result" }, empty),
  ];
}

function artFrame(markup, photoUrl) {
  return h("div", { class: "art-frame" }, photoUrl ? h("img", { src: photoUrl, alt: "" }) : fromMarkup(markup));
}

function artwork(temperatures, photos = {}) {
  const hot = temperatures.includes("HOT");
  const iced = temperatures.includes("ICED");
  const kind = hot && iced ? "both" : hot ? "hot" : iced ? "iced" : "none";
  const hasPhoto = (hot && photos.HOT) || (iced && photos.ICED);
  const box = h("div", { class: `art art-${kind}` });
  if (hasPhoto) {
    if (hot) box.append(artFrame(HOT_ART, photos.HOT));
    if (iced) box.append(artFrame(ICED_ART, photos.ICED));
  } else if (kind === "iced") box.append(fromMarkup(ICED_ART));
  else if (kind === "both") box.append(fromMarkup(HOT_ART), fromMarkup(ICED_ART));
  else box.append(fromMarkup(HOT_ART));
  return box;
}

function temperatureTag(temperature) {
  const name = temperature.toLowerCase();
  return h("span", { class: `tag ${name}` },
    temperature === "UNKNOWN" ? null : icon(temperature === "HOT" ? "flame" : "snow"), TEMPERATURE_NAMES[temperature]);
}

function sizeLine(recipe, temperature) {
  const filled = recipe.sizes[temperature];
  if (!filled.length) return null;
  const name = temperature.toLowerCase();
  return h("div", { class: "size-line", "aria-label": `${temperature} 사이즈: ${filled.join(", ")}` },
    h("b", {}, temperature),
    SIZES.map((size) => h("span", { class: `pip ${filled.includes(size) ? `on ${name}` : ""}` }, SIZE_LETTERS[size])));
}

function statusOf(recipe) {
  if (recipe.variant_count === 0) return h("span", { class: "status draft" }, icon("pencil"), "작성 중");
  const parts = [];
  if (recipe.blank_count) parts.push(`빈칸 ${recipe.blank_count}`);
  if (isPrep(recipe) && !recipe.category) parts.push("분류 미지정");
  else if (recipe.review_count) parts.push(`확인 ${recipe.review_count}`);
  return parts.length
    ? h("span", { class: "status warn" }, icon("alert"), parts.join(" · "))
    : h("span", { class: "status good" }, icon("check"), "빈칸 없음");
}

function timeAgo(text) {
  const minutes = Math.floor((Date.now() - new Date(text).getTime()) / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`;
  if (minutes < 43200) return `${Math.floor(minutes / 1440)}일 전`;
  return text.slice(0, 10);
}

function card(recipe) {
  const temperatures = temperaturesOf(recipe);
  const art = artwork(temperatures, recipe.photos);
  art.append(h("div", { class: "art-tags" }, temperatures.map(temperatureTag)));
  const isNew = recipe.id === state.highlightId;
  if (isNew) art.append(h("span", { class: "new-tag" }, "방금 추가"));
  return h("a", { class: `card ${isNew ? "is-new" : ""}`, href: `#/recipe/${recipe.id}` },
    art,
    h("div", { class: "card-body" },
      h("div", { class: "card-title" }, recipe.menu_name || "메뉴명 미확인"),
      recipe.channel ? h("div", { class: "card-channel" }, recipe.channel) : null,
      sizeLine(recipe, "HOT"),
      sizeLine(recipe, "ICED"),
      h("div", { class: "card-foot" }, PUBLISHED ? null : statusOf(recipe), h("span", {}, timeAgo(recipe.updated_at)))));
}

function prepCard(recipe) {
  const url = recipe.photos.PREP;
  const art = h("div", { class: "art art-prep" }, url ? artFrame(PREP_ART, url) : fromMarkup(PREP_ART));
  art.append(h("div", { class: "art-tags" }, h("span", { class: "tag prep" }, recipe.category || "분류 미지정")));
  const isNew = recipe.id === state.highlightId;
  if (isNew) art.append(h("span", { class: "new-tag" }, "방금 추가"));
  return h("a", { class: `card ${isNew ? "is-new" : ""}`, href: `#/recipe/${recipe.id}` },
    art,
    h("div", { class: "card-body" },
      h("div", { class: "card-title" }, recipe.menu_name || "프렙명 미확인"),
      recipe.channel ? h("div", { class: "card-channel" }, recipe.channel) : null,
      h("div", { class: "card-foot" }, PUBLISHED ? null : statusOf(recipe), h("span", {}, timeAgo(recipe.updated_at)))));
}

function goToDashboard() {
  if (location.hash === "#/" || location.hash === "") route();
  else location.hash = "#/";
}

/* ---------- new recipe ---------- */

const newDialog = document.getElementById("new-dialog");
const newText = document.getElementById("new-text");
const newError = document.getElementById("new-error");
const newGuide = document.getElementById("new-guide");
const newPrepGuide = document.getElementById("new-prep-guide");
const GUIDE_LABELS = { menu: "메뉴 안내문 복사", prep: "프렙 안내문 복사" };

function showNewError(message) {
  newError.textContent = message;
  newError.hidden = !message;
}

function openNewDialog() {
  newText.value = "";
  showNewError("");
  newGuide.textContent = GUIDE_LABELS.menu;
  newPrepGuide.textContent = GUIDE_LABELS.prep;
  newDialog.showModal();
}

async function submitNew() {
  try {
    const recipe = await api("/api/recipes", sendJson("POST", { text: newText.value }));
    newDialog.close();
    state.highlightId = recipe.id;
    state.kind = isPrep(recipe) ? "prep" : "menu";
    state.filter = "all";
    state.category = "all";
    state.query = "";
    const name = recipe.menu_name || "메뉴명 미확인";
    toast(recipe.free_form
      ? `'${name}'를 추가했습니다. 카드를 열어 비어 있는 칸을 채워 주세요.`
      : `'${name}' 레시피를 대시보드에 추가했습니다.`);
    goToDashboard();
  } catch (error) {
    showNewError(error.message);
  }
}

// Safari only allows the copy if it starts directly from the click, so both texts are loaded beforehand.
async function copyGuide(kind = "menu") {
  try {
    await navigator.clipboard.writeText(state.guides[kind]);
    return "복사했습니다. Gemini에 붙여넣고 맨 아래에 YouTube 주소를 넣으세요.";
  } catch {
    return "복사하지 못했습니다. 다시 눌러 주세요.";
  }
}

async function readFile(file) {
  newText.value = await file.text();
  await submitNew();
}

// The published page has none of these elements.
function wireEditor() {
  // Inside the dialog a toast would be hidden behind it, so the link itself answers.
  newGuide.addEventListener("click", async () => {
    newGuide.textContent = await copyGuide("menu");
  });
  newPrepGuide.addEventListener("click", async () => {
    newPrepGuide.textContent = await copyGuide("prep");
  });
  document.getElementById("new-form").addEventListener("submit", (event) => {
    event.preventDefault();
    submitNew();
  });
  document.getElementById("new-cancel").addEventListener("click", () => newDialog.close());
  document.getElementById("new-file").addEventListener("change", (event) => {
    if (event.target.files[0]) readFile(event.target.files[0]);
    event.target.value = "";
  });
  const startBlank = async (kind) => {
    const recipe = await api("/api/recipes/blank", sendJson("POST", { kind }));
    newDialog.close();
    location.hash = `#/recipe/${recipe.id}`;
  };
  document.getElementById("new-blank").addEventListener("click", () => startBlank("menu"));
  document.getElementById("new-prep-blank").addEventListener("click", () => startBlank("prep"));
  newText.addEventListener("dragover", (event) => {
    event.preventDefault();
    newText.classList.add("dragging");
  });
  newText.addEventListener("dragleave", () => newText.classList.remove("dragging"));
  newText.addEventListener("drop", (event) => {
    event.preventDefault();
    newText.classList.remove("dragging");
    if (event.dataTransfer.files[0]) readFile(event.dataTransfer.files[0]);
  });
  const rawDialog = document.getElementById("raw-dialog");
  const rawGuide = document.getElementById("raw-guide");
  rawGuide.addEventListener("click", async () => {
    rawGuide.textContent = await copyGuide("menu");
  });
  const rawPrepGuide = document.getElementById("raw-prep-guide");
  rawPrepGuide.addEventListener("click", async () => {
    rawPrepGuide.textContent = await copyGuide("prep");
  });
  document.getElementById("raw-close").addEventListener("click", () => rawDialog.close());
  document.getElementById("raw-edit").addEventListener("click", editRaw);
  document.getElementById("raw-cancel").addEventListener("click", () => {
    if (state.recipe.raw_text) setRawEditing(false);
    else rawDialog.close();
  });
  document.getElementById("raw-apply").addEventListener("click", applyRaw);
  document.getElementById("raw-undo").addEventListener("click", undoRaw);
  document.getElementById("aux-options").replaceChildren(
    ...[
      ...COUNTED_UNITS.flatMap(([one, many]) => [`1 ${one}`, `2 ${many}`, `3 ${many}`]),
      "1/2 ts", "1/2 Tbs",
      ...COUNTED_UNITS.map(([one]) => one),
      ...OTHER_UNITS,
    ].map((value) => h("option", { value })),
  );
}

/* ---------- recipe sheet ---------- */

async function showRecipe(id) {
  try {
    state.recipe = await readRecipe(id);
  } catch (error) {
    app.replaceChildren(h("p", { class: "error" }, error.message), h("a", { href: "#/" }, "Dashboard"));
    return;
  }
  chooseTemperature();
  renderRecipe();
}

function chooseTemperature() {
  if (isPrep(state.recipe)) {
    state.temperature = "PREP";
    return;
  }
  const [first] = usedTemperatures().length ? usedTemperatures() : tabTemperatures();
  state.temperature = first || "HOT";
}

function renderPublishedRecipe() {
  const { recipe } = state;
  const link = /^https?:\/\//.test(recipe.source_url || "")
    ? h("a", { class: "button", href: recipe.source_url, target: "_blank", rel: "noreferrer" }, icon("link"), "출처 영상")
    : null;
  app.replaceChildren(h("div", { class: "recipe-page" },
    h("div", { class: "recipe-head" },
      h("a", { class: "button", href: "#/" }, icon("back"), "목록"),
      recipe.channel ? h("span", { class: "muted" }, recipe.channel) : null,
      h("span", { class: "spacer" }),
      link),
    isPrep(recipe) ? prepSheet(true) : sheet(state.temperature, true),
    isPrep(recipe) ? null : publishedUnknownPanel()));
}

function publishedUnknownPanel() {
  const { recipe } = state;
  const loose = recipe.variants.filter((v) => v.temperature === "UNKNOWN");
  const steps = recipe.steps.UNKNOWN;
  if (!loose.length && !steps.length) return null;
  return h("section", { class: "panel" },
    h("h3", {}, "온도 미확인"),
    loose.map((variant) => h("ul", {}, variant.ingredients.map((row) =>
      h("li", {}, [row.name, row.amount, row.aux, row.note].filter(Boolean).join(" · "))))),
    steps.length ? h("div", { class: "plain" }, stepsText(steps)) : null);
}

function renderRecipe() {
  const { recipe } = state;
  closePop();
  document.title = recipe.menu_name || (isPrep(recipe) ? "프렙" : "레시피");
  if (PUBLISHED) {
    renderPublishedRecipe();
    return;
  }
  const prep = isPrep(recipe);
  const link = /^https?:\/\//.test(recipe.source_url || "")
    ? h("a", { class: "button", href: recipe.source_url, target: "_blank", rel: "noreferrer" }, icon("link"), "영상 열기")
    : null;
  app.replaceChildren(h("div", { class: "recipe-page" },
    h("div", { class: "recipe-head" },
      h("a", { class: "button", href: "#/" }, icon("back"), "Dashboard"),
      h("span", { id: "save-state" }, recipe.md_name ? `저장됨 · recipes/${recipe.md_name}` : ""),
      h("span", { class: "spacer" }),
      h("button", { class: "button", onclick: showRaw }, icon("file"), "Gemini 원문"),
      h("button", { class: "button", onclick: printRecipe }, icon("printer"), "인쇄/PDF"),
      h("button", { class: "button danger", onclick: deleteRecipe }, icon("trash"), "삭제")),
    h("div", { class: "meta" },
      field("source_url", "출처 YouTube 주소"), link, field("channel", "채널")),
    prep ? prepSheet(false) : sheet(state.temperature, false),
    freeFormPanel(),
    prep ? null : loosePanel(),
    unreadPanel()));
  document.querySelectorAll("#app textarea").forEach(grow);
}

function field(key, placeholder) {
  return h("input", {
    value: state.recipe[key] || "", placeholder,
    oninput: (event) => { state.recipe[key] = event.target.value; changed(); },
  });
}

function grow(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight + 2}px`;
}

function sheet(temperature, readonly) {
  const { recipe } = state;
  return h("section", { class: "sheet" },
    h("div", { class: "title-row" },
      h("div", {}, "메뉴명"),
      h("div", {}, readonly
        ? recipe.menu_name || ""
        : h("input", {
          value: recipe.menu_name || "", placeholder: "메뉴명 입력",
          oninput: (event) => { recipe.menu_name = event.target.value; changed(); },
        }))),
    readonly && !PUBLISHED ? h("div", { class: "temperature-title" }, temperature) : tabs(temperature),
    bodyRow(temperature, readonly),
    h("div", { class: "section-bar" }, `제조방법 (${temperature})`),
    stepsArea(temperature, readonly),
    h("div", { class: "section-bar" }, "메모"),
    memoArea(readonly));
}

function bodyRow(temperature, readonly) {
  const picture = photo(temperature, readonly);
  return h("div", { class: `body-row ${picture ? "" : "no-photo"}` }, picture, sizeTable(temperature, readonly));
}

/* ---------- prep sheet ---------- */

// A prep item's one sheet: no temperature tabs or cup sizes, just its info line and batch tables.
function prepSheet(readonly) {
  const { recipe } = state;
  return h("section", { class: "sheet prep-sheet" },
    h("div", { class: "title-row" },
      h("div", {}, "프렙명"),
      h("div", {}, readonly
        ? [recipe.menu_name || "", aliasLine()]
        : h("input", {
          value: recipe.menu_name || "", placeholder: "프렙명 입력",
          oninput: (event) => { recipe.menu_name = event.target.value; changed(); },
        }))),
    readonly ? null : aliasRow(),
    prepInfo(readonly),
    prepBody(readonly),
    h("div", { class: "section-bar" }, "제조방법"),
    stepsArea("PREP", readonly),
    usedIn(),
    h("div", { class: "section-bar" }, "메모"),
    memoArea(readonly));
}

// Other names the prep goes by in menus, like 아인슈페너 크림 for 수제크림. They are typed here or come from a
// menu's [+프렙], never from a Gemini answer, so refilling and undo leave them alone.
function aliasLine() {
  const aliases = state.recipe.aliases || [];
  return aliases.length ? h("div", { class: "alias-line" }, `다른 이름 · ${aliases.join(", ")}`) : null;
}

function aliasRow() {
  const recipe = state.recipe;
  const input = h("input", { class: "alias-input", placeholder: "다른 이름 입력 후 Enter", "aria-label": "다른 이름 추가" });
  const add = async () => {
    const name = input.value.trim();
    if (!name) return;
    if (await linkPrep(recipe, name)) {
      const next = document.querySelector(".alias-input");
      if (next) next.focus();
    }
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !composing(event)) {
      event.preventDefault();
      add();
    }
  });
  return h("div", { class: "alias-row" },
    h("div", { class: "alias-label" }, "다른 이름"),
    h("div", { class: "alias-list" },
      (recipe.aliases || []).map((name) => h("span", { class: "alias-chip" }, name, h("button", {
        type: "button", class: "alias-remove", title: `'${name}' 빼기`, "aria-label": `${name} 빼기`,
        onclick: () => unlinkPrep(recipe, name),
      }, "×"))),
      input,
      h("button", { type: "button", class: "button small", onclick: add }, "추가")));
}

// Only what the video said is kept here, so the phone hides an empty field instead of showing a blank.
function prepInfo(readonly) {
  const { recipe } = state;
  if (readonly) {
    const shown = [["분류", recipe.category || (PUBLISHED ? null : "미지정")],
      ...INFO_FIELDS.map(([key, title]) => [title, recipe[key]])].filter(([, value]) => value || !PUBLISHED);
    if (!shown.length) return null;
    return h("div", { class: `prep-info cols-${shown.length}` }, shown.map(([title, value]) =>
      h("div", {}, h("span", { class: "info-label" }, title), h("span", { class: "info-value" }, value || ""))));
  }
  const select = h("select", {
    "aria-label": "분류",
    onchange: () => {
      recipe.category = select.value || null;
      select.parentElement.classList.toggle("unset", !recipe.category);
      changed();
    },
  },
  h("option", { value: "", selected: !recipe.category }, "분류 미지정"),
  state.categories.map((name) => h("option", { value: name, selected: recipe.category === name }, name)));
  return h("div", { class: "prep-info" },
    h("div", { class: recipe.category ? "" : "unset" }, h("span", { class: "info-label" }, "분류"), select),
    INFO_FIELDS.map(([key, title]) => h("div", {}, h("span", { class: "info-label" }, title), h("input", {
      value: recipe[key] || "", placeholder: "미확인", "aria-label": title,
      oninput: (event) => { recipe[key] = event.target.value; changed(); },
    }))));
}

function prepBody(readonly) {
  const picture = photo("PREP", readonly);
  return h("div", { class: `body-row ${picture ? "" : "no-photo"}` }, picture, batchTable(readonly));
}

// One slot per batch. A blank prep gets one empty slot that becomes a batch when typed into.
function batchSlot(variant) {
  return {
    label: "배합",
    find: () => variant || state.recipe.variants.find((v) => v.temperature === "PREP"),
    make: () => {
      const made = { temperature: "PREP", size: null, status: "unset", label: null, note: null, ingredients: [] };
      state.recipe.variants.push(made);
      return made;
    },
  };
}

function batchTable(readonly) {
  const batches = state.recipe.variants.filter((v) => v.temperature === "PREP");
  const slots = batches.length ? batches.map(batchSlot) : [batchSlot(null)];
  const rows = [];
  slots.forEach((slot, position) => {
    const variant = slot.find();
    rows.push(batchHeader(slot, variant, readonly));
    if (position === 0) {
      rows.push(h("tr", { class: "col-head" },
        ["재료명", "분량(단위)", "보조(단위)", "비고"].map((name) => h("th", {}, name)),
        readonly ? null : h("th", { class: "row-end" })));
    }
    const count = variant ? variant.ingredients.length : 0;
    const total = readonly ? Math.max(count, 1) : Math.max(count + 1, MIN_ROWS);
    for (let index = 0; index < total; index += 1) rows.push(ingredientRow(slot, index, readonly, index === total - 1));
  });
  return h("table", { class: "sizes" },
    h("colgroup", {},
      h("col", { style: "width:25%" }), h("col", { style: "width:19%" }),
      h("col", { style: "width:30%" }), h("col"), readonly ? null : h("col", { style: "width:24px" })),
    h("tbody", {}, rows));
}

// The batch basis is the video's own words, such as "휘핑크림 1팩 기준". Nothing is scaled from it.
function batchHeader(slot, variant, readonly) {
  const label = variant ? variant.label : null;
  return h("tr", { class: "size-row" },
    h("th", {}, "배합"),
    h("th", { colSpan: readonly ? 3 : 4 }, readonly
      ? h("span", { class: label ? "" : "original" }, label || "배합 기준 미확인")
      : h("input", {
        value: label || "", placeholder: "배합 기준 (예: 휘핑크림 1팩 기준)", "aria-label": "배합 기준",
        oninput: (event) => { (slot.find() || slot.make()).label = event.target.value; changed(); },
      })));
}

function useWhere(use) {
  if (use.kind === "prep") return "프렙";
  if (use.temperature === "UNKNOWN") return "온도 미확인";
  return [use.temperature, use.size].filter(Boolean).join(" ");
}

// Drinks whose ingredient name is this prep's name or one of its other names, worked out by the Mac app when it loads.
function usedIn() {
  const { recipe } = state;
  const uses = recipe.used_in || [];
  if (PUBLISHED && !uses.length) return null;
  const via = (use) => (use.name && nameKey(use.name) !== nameKey(recipe.menu_name)
    ? `'${use.name}'${josa(use.name, "으로", "로")} 연결` : null);
  return [h("div", { class: "section-bar" }, "이 프렙을 쓰는 메뉴"),
    uses.length
      ? h("ul", { class: "used-in" }, uses.map((use) => h("li", {},
        h("a", { href: `#/recipe/${use.id}` }, use.menu_name || "메뉴명 미확인"),
        h("span", { class: "muted" }, [useWhere(use), use.amount, use.aux, via(use)].filter(Boolean).join(" · ")))))
      : h("p", { class: "used-empty muted" },
        "아직 이 프렙을 재료로 쓰는 메뉴가 없습니다. 메뉴 재료표에서 재료명 옆 [+프렙]을 누르거나, 재료명을 프렙명이나 다른 이름과 똑같이 쓰면 여기에 연결됩니다.")];
}

function usedTemperatures() {
  const { variants, steps } = state.recipe;
  return ["HOT", "ICED"].filter((t) => steps[t].length || variants.some((v) => v.temperature === t));
}

// A photo alone earns a tab, so it can be seen; printing still follows usedTemperatures.
function tabTemperatures() {
  const used = usedTemperatures();
  return ["HOT", "ICED"].filter((t) => used.includes(t) || state.recipe.photos[t]);
}

function tabs(active) {
  const shown = PUBLISHED && tabTemperatures().length ? tabTemperatures() : ["HOT", "ICED"];
  return h("div", { class: "tabs" }, shown.map((temperature) =>
    h("button", {
      class: `tab ${temperature.toLowerCase()} ${temperature === active ? "active" : ""}`,
      onclick: () => { state.temperature = temperature; renderRecipe(); },
    }, icon(temperature === "HOT" ? "flame" : "snow"), temperature)));
}

function photo(temperature, readonly) {
  const url = state.recipe.photos[temperature];
  if (readonly && PUBLISHED && !url) return null;
  if (readonly) return h("div", { class: "photo" }, url ? h("img", { src: url, alt: "" }) : null);
  const input = h("input", {
    type: "file", accept: "image/jpeg,image/png,image/webp", hidden: true,
    onchange: () => { if (input.files[0]) uploadPhoto(temperature, input.files[0]); },
  });
  const box = h("div", {
    class: "photo",
    onclick: () => input.click(),
    ondragover: (event) => { event.preventDefault(); box.classList.add("dragging"); },
    ondragleave: () => box.classList.remove("dragging"),
    ondrop: (event) => {
      event.preventDefault();
      box.classList.remove("dragging");
      if (event.dataTransfer.files[0]) uploadPhoto(temperature, event.dataTransfer.files[0]);
    },
  }, input, url
    ? [h("img", { src: url, alt: `${photoName(temperature)} 사진` }),
      h("button", { class: "button small", onclick: (event) => { event.stopPropagation(); removePhoto(temperature); } }, "사진 삭제")]
    : `${photoName(temperature)} 사진 넣기 (선택)`);
  return box;
}

function photoName(temperature) {
  return temperature === "PREP" ? "완성" : temperature;
}

async function uploadPhoto(temperature, file) {
  try {
    const { url } = await api(`/api/recipes/${state.recipe.id}/photos/${temperature}`, {
      method: "POST", headers: { "Content-Type": file.type }, body: file,
    });
    state.recipe.photos[temperature] = url;
    renderRecipe();
  } catch (error) {
    toast(error.message);
  }
}

async function removePhoto(temperature) {
  await api(`/api/recipes/${state.recipe.id}/photos/${temperature}`, { method: "DELETE" });
  delete state.recipe.photos[temperature];
  renderRecipe();
}

function findVariant(temperature, size) {
  return state.recipe.variants.find((v) => v.temperature === temperature && v.size === size);
}

function ensureRow(variant, index) {
  while (variant.ingredients.length <= index) {
    variant.ingredients.push({ name: null, amount: null, aux: null, note: null, evidence: null });
  }
  return variant.ingredients[index];
}

// A slot is one block of the table: a fixed size, or ingredients still waiting for a size.
function sizeSlot(temperature, size) {
  return {
    label: size,
    find: () => findVariant(temperature, size),
    make: () => {
      const variant = { temperature, size, status: "confirmed", label: null, note: null, ingredients: [] };
      state.recipe.variants.push(variant);
      return variant;
    },
    header: (variant, readonly) => sizeHeader(temperature, size, variant, readonly),
  };
}

function looseSlot(variant) {
  return {
    label: "미지정",
    find: () => variant,
    make: () => variant,
    header: (_, readonly) => looseHeader(variant, readonly),
  };
}

function sizeTable(temperature, readonly) {
  const loose = state.recipe.variants.filter((v) => v.temperature === temperature && !v.size);
  const sizes = PUBLISHED ? SIZES.filter((size) => findVariant(temperature, size)) : SIZES;
  const slots = [...loose.map(looseSlot), ...sizes.map((size) => sizeSlot(temperature, size))];
  const rows = [];
  if (!slots.length) rows.push(h("tr", {}, h("td", { colSpan: 4, class: "no-rows" }, "재료 정보가 없습니다")));
  slots.forEach((slot, position) => {
    const variant = slot.find();
    rows.push(slot.header(variant, readonly));
    if (position === 0) {
      rows.push(h("tr", { class: "col-head" },
        ["재료명", "분량(단위)", "보조(단위)", "비고"].map((name) => h("th", {}, name)),
        readonly ? null : h("th", { class: "row-end" })));
    }
    const count = variant ? variant.ingredients.length : 0;
    const total = readonly ? Math.max(count, 1) : Math.max(count + 1, MIN_ROWS);
    for (let index = 0; index < total; index += 1) rows.push(ingredientRow(slot, index, readonly, index === total - 1));
  });
  return h("table", { class: "sizes" },
    h("colgroup", {},
      h("col", { style: "width:25%" }), h("col", { style: "width:19%" }),
      h("col", { style: "width:30%" }), h("col"), readonly ? null : h("col", { style: "width:24px" })),
    h("tbody", {}, rows));
}

function volumeText(temperature, size) {
  const row = state.table[temperature].find((item) => item.size === size);
  return `${row.oz} fl oz / ${row.ml} mL`;
}

function sizeHeader(temperature, size, variant, readonly) {
  const tools = [];
  if (variant && variant.status === "suggested" && !PUBLISHED) {
    tools.push(h("span", { class: "badge" }, `확인 필요 · 영상 표기 ${variant.label || "미확인"} `));
    if (!readonly) {
      tools.push(h("button", {
        class: "button small",
        onclick: () => { variant.status = "confirmed"; variant.note = null; changed(); renderRecipe(); },
      }, "확정"), " ");
    }
  } else if (variant && variant.label) {
    tools.push(h("span", { class: "original" }, `영상 표기 ${variant.label} `));
  }
  if (variant && !readonly) tools.push(moveSelect(variant));
  return h("tr", { class: "size-row" },
    h("th", {}, "Size"),
    h("th", { colSpan: readonly ? 3 : 4 },
      h("span", { class: "size-name" }, size),
      h("span", { class: "size-volume" }, volumeText(temperature, size)),
      tools.length ? h("span", { class: "size-tools" }, tools) : null));
}

function looseHeader(variant, readonly) {
  return h("tr", { class: "size-row unset" },
    h("th", {}, "Size"),
    h("th", { colSpan: readonly ? 3 : 4 },
      h("span", { class: "size-name" }, "사이즈 미지정"),
      h("span", { class: "size-volume" }, `영상 표기 ${variant.label || "미확인"}`),
      h("span", { class: "size-tools" },
        variant.note ? h("span", { class: "original" }, `${variant.note} `) : null,
        readonly ? null : moveSelect(variant))));
}

function moveSelect(variant) {
  const select = h("select", {
    "aria-label": "사이즈 옮기기",
    onchange: () => {
      if (select.value) moveVariant(variant, variant.temperature, select.value === "none" ? null : select.value);
    },
  },
  h("option", { value: "", selected: true }, variant.size ? "옮기기…" : "사이즈 선택…"),
  SIZES.filter((size) => size !== variant.size).map((size) => h("option", { value: size }, size)),
  variant.size ? h("option", { value: "none" }, "미지정으로") : null);
  return select;
}

function moveVariant(variant, temperature, size) {
  const other = size && state.recipe.variants.find((v) => v !== variant && v.temperature === temperature && v.size === size);
  if (other && other.ingredients.some(hasContent)) {
    toast("그 사이즈 칸에는 이미 내용이 있습니다.");
    renderRecipe();
    return;
  }
  if (other) state.recipe.variants.splice(state.recipe.variants.indexOf(other), 1);
  variant.temperature = temperature;
  variant.size = size;
  variant.status = size ? "confirmed" : "unset";
  variant.note = null;
  changed();
  renderRecipe();
}

function hasContent(row) {
  return row.name || row.amount || row.aux || row.note;
}

// Each table block has one + on its last empty row; it adds a row below. Blank rows above take typing directly.
function ingredientRow(slot, index, readonly, last) {
  const variant = slot.find();
  const row = variant ? variant.ingredients[index] : null;
  if (readonly) {
    return h("tr", {}, ["name", "amount", "aux", "note"].map((key) => h("td", {}, (row && row[key]) || "",
      key === "name" ? prepLink(row) : null)));
  }
  const paintBlank = (cell) => {
    const current = slot.find() ? slot.find().ingredients[index] : null;
    cell.classList.toggle("blank", Boolean(current && current.name && !current.amount));
  };
  const chip = h("span", { class: "chip-slot" });
  const paintChip = () => {
    const current = slot.find() ? slot.find().ingredients[index] : null;
    chip.replaceChildren(...[prepChip(current && current.name)].filter(Boolean));
  };
  const cells = ["name", "amount", "aux", "note"].map((key) => h("td", {}, h(key === "note" ? "textarea" : "input", {
    value: (row && row[key]) || "",
    rows: key === "note" ? 1 : null,
    title: row && row.evidence && (key === "amount" || key === "aux") ? `근거: ${row.evidence}` : "",
    list: key === "aux" ? "aux-options" : null,
    "aria-label": `${slot.label} ${key}`,
    oninput: (event) => {
      ensureRow(slot.find() || slot.make(), index)[key] = event.target.value;
      if (key === "note") grow(event.target);
      if (key === "name") paintChip();
      paintBlank(cells[1]);
      changed();
    },
  })));
  cells[0].classList.add("name-cell");
  cells[0].append(chip);
  paintChip();
  paintBlank(cells[1]);
  // A blank row needs no ×: saving drops it anyway.
  const end = h("td", { class: "row-end" }, row && hasContent(row)
    ? h("button", {
      class: "row-tool row-delete", title: "행 삭제", "aria-label": "행 삭제",
      onclick: () => {
        variant.ingredients.splice(index, 1);
        if (!variant.ingredients.length) state.recipe.variants.splice(state.recipe.variants.indexOf(variant), 1);
        changed();
        renderRecipe();
      },
    }, "×")
    : last ? h("button", {
      class: "row-tool row-add", title: "행 추가", "aria-label": "행 추가",
      onclick: () => { ensureRow(slot.find() || slot.make(), index); renderRecipe(); },
    }, "+") : null);
  return h("tr", {}, cells, end);
}

// On the read-only sheet an ingredient that stands for a prep links to it.
function prepLink(row) {
  const prep = row && row.name ? linkedPrep(row.name) : null;
  if (!prep) return null;
  return h("a", { class: "prep-link", href: `#/recipe/${prep.id}`, title: "프렙 레시피 열기" }, "프렙");
}

/* ---------- linking ingredients to prep items ---------- */

function otherPreps() {
  return state.recipes.filter((recipe) => isPrep(recipe) && recipe.id !== state.recipe.id);
}

// Similar names are only offered, never linked: one name holds the other, like 크림 and 수제크림.
function similarPreps(name) {
  const key = nameKey(name);
  if (key.length < 2) return [];
  return otherPreps().filter((prep) => [prep.menu_name, ...(prep.aliases || [])].some((other) => {
    const otherKey = nameKey(other);
    return otherKey.length >= 2 && (otherKey.includes(key) || key.includes(otherKey));
  }));
}

// [프렙] on a linked row, [+프렙] on an unlinked one. [+프렙] shows on hover unless a similar prep exists.
function prepChip(name) {
  const text = (name || "").trim();
  if (!text) return null;
  const prep = linkedPrep(text);
  if (prep) {
    return h("button", {
      type: "button", class: "prep-link", title: `${prep.menu_name || "프렙"} · 열기 또는 연결 풀기`,
      onclick: (event) => openLinkMenu(event.currentTarget, text, prep),
    }, "프렙");
  }
  if (!otherPreps().length) return null;
  const similar = similarPreps(text);
  return h("button", {
    type: "button", class: `prep-add ${similar.length ? "suggested" : ""}`,
    title: similar.length ? `비슷한 프렙: ${similar.map((p) => p.menu_name).join(", ")}` : "프렙과 연결",
    onclick: (event) => openPrepPicker(event.currentTarget, text),
  }, similar.length ? "+프렙 후보" : "+프렙");
}

let pop = null;

function closePop() {
  if (pop) pop.remove();
  pop = null;
}

function openPop(anchor, ...children) {
  closePop();
  pop = h("div", { class: "prep-pop", role: "dialog" }, ...children);
  pop.anchor = anchor;
  document.body.append(pop);
  const box = anchor.getBoundingClientRect();
  const height = pop.offsetHeight;
  const left = Math.min(Math.max(8, box.left), document.documentElement.clientWidth - pop.offsetWidth - 8);
  const below = box.bottom + 4 + height <= window.innerHeight || box.top - 4 - height < 0;
  pop.style.left = `${left + window.scrollX}px`;
  pop.style.top = `${(below ? box.bottom + 4 : box.top - 4 - height) + window.scrollY}px`;
  const first = pop.querySelector("input, button");
  if (first) first.focus();
}

document.addEventListener("mousedown", (event) => {
  if (pop && !pop.contains(event.target) && !pop.anchor.contains(event.target)) closePop();
});
document.addEventListener("keydown", (event) => {
  if (pop && event.key === "Escape") closePop();
});

function openPrepPicker(anchor, name) {
  if (pop && pop.anchor === anchor) {
    closePop();
    return;
  }
  const preps = otherPreps();
  const similar = similarPreps(name);
  const list = h("div", { class: "pop-list" });
  const item = (prep) => h("button", { type: "button", class: "pop-item", onclick: () => linkPrep(prep, name) },
    h("span", {}, prep.menu_name || "프렙명 미확인"),
    prep.aliases && prep.aliases.length ? h("span", { class: "pop-aliases" }, prep.aliases.join(", ")) : null);
  const search = h("input", {
    type: "search", placeholder: "프렙 검색", "aria-label": "프렙 검색",
    oninput: () => paint(),
    onkeydown: (event) => {
      if (event.key !== "Enter" || composing(event)) return;
      event.preventDefault();
      const first = list.querySelector(".pop-item");
      if (first) first.click();
    },
  });
  const paint = () => {
    const query = nameKey(search.value);
    const shown = (prep) => !query || [prep.menu_name, ...(prep.aliases || [])].some((n) => nameKey(n).includes(query));
    const groups = [
      ...(query ? [] : [["비슷한 이름", similar]]),
      ...state.categories.map((category) => [category, preps.filter((p) => p.category === category)]),
      ["분류 미지정", preps.filter((p) => !p.category)],
    ].map(([title, items]) => [title, items.filter(shown)]).filter(([, items]) => items.length);
    list.replaceChildren(...(groups.length
      ? groups.flatMap(([title, items]) => [h("p", { class: "pop-group" }, title), ...items.map(item)])
      : [h("p", { class: "pop-empty" }, "맞는 프렙이 없습니다.")]));
  };
  paint();
  openPop(anchor,
    h("p", { class: "pop-title" }, `'${name}'${josa(name, "과", "와")} 연결할 프렙`),
    search, list,
    h("p", { class: "pop-note" }, `고른 프렙의 다른 이름에 '${name}'${josa(name, "이", "가")} 들어갑니다.`));
}

function openLinkMenu(anchor, name, prep) {
  if (pop && pop.anchor === anchor) {
    closePop();
    return;
  }
  const byAlias = nameKey(name) !== nameKey(prep.menu_name);
  openPop(anchor,
    h("p", { class: "pop-title" }, `프렙 · ${prep.menu_name || "프렙명 미확인"}`),
    byAlias ? h("p", { class: "pop-note" }, `다른 이름 '${name}'${josa(name, "으로", "로")} 연결되어 있습니다.`) : null,
    h("button", {
      type: "button", class: "pop-item",
      onclick: () => { closePop(); location.hash = `#/recipe/${prep.id}`; },
    }, "프렙 열기"),
    byAlias
      ? h("button", { type: "button", class: "pop-item danger", onclick: () => unlinkPrep(prep, name) }, "연결 풀기")
      : h("p", { class: "pop-note" }, "재료명이 프렙 이름과 같아서 연결되어 있습니다. 풀려면 재료명을 바꾸세요."));
}

// Other recipes with this ingredient name: a link or unlink changes them too, so they are named first.
async function usesElsewhere(name, prep) {
  try {
    const uses = await api(`/api/uses?name=${encodeURIComponent(name)}`);
    return uses.filter((use) => use.id !== state.recipe.id && use.id !== prep.id)
      .map((use) => use.menu_name || (isPrep(use) ? "프렙명 미확인" : "메뉴명 미확인"));
  } catch (error) {
    toast(error.message, 5000);
    return null;
  }
}

async function changeAlias(method, prep, name, message) {
  try {
    const saved = await api(`/api/recipes/${prep.id}/aliases`, sendJson(method, { name }));
    if (state.recipe && state.recipe.id === saved.id) {
      state.recipe.aliases = saved.aliases;
      state.recipe.used_in = saved.used_in;
      state.recipe.md_name = saved.md_name;
    }
    await loadRecipes();
    renderRecipe();
    toast(message, 3500);
    return true;
  } catch (error) {
    toast(error.message, 5000);
    return false;
  }
}

// A name that already stands for a prep is answered at once, before any question about other recipes.
// The server checks the same rules again.
function takenMessage(name, prep) {
  const owner = prepIndex().get(nameKey(name));
  if (!owner) return null;
  if (owner.id !== prep.id) return `이미 '${owner.menu_name || "프렙명 미확인"}' 프렙에 연결된 이름입니다: ${name}`;
  return nameKey(name) === nameKey(prep.menu_name)
    ? "프렙 이름과 같은 이름은 따로 넣지 않아도 연결됩니다."
    : `'${name}'${josa(name, "은", "는")} 이미 이 프렙의 다른 이름입니다.`;
}

async function linkPrep(prep, name) {
  closePop();
  await save(); // Saving reloads the recipe list, so the checks below see the latest names.
  const taken = takenMessage(name, prep);
  if (taken) {
    toast(taken, 4000);
    return false;
  }
  const others = await usesElsewhere(name, prep);
  if (others === null) return false;
  const prepName = prep.menu_name || "프렙명 미확인";
  if (others.length && !confirm(`'${name}'${josa(name, "을", "를")} '${prepName}'의 다른 이름으로 넣으면, 이 이름을 쓰는 다른 레시피 ${others.length}곳도 함께 연결됩니다.\n\n${others.join(", ")}\n\n연결할까요?`)) return false;
  return changeAlias("POST", prep, name, `'${name}'${josa(name, "을", "를")} '${prepName}'의 다른 이름에 넣었습니다.`);
}

async function unlinkPrep(prep, name) {
  closePop();
  await save();
  const others = await usesElsewhere(name, prep);
  if (others === null) return false;
  const prepName = prep.menu_name || "프렙명 미확인";
  if (others.length && !confirm(`'${name}'${josa(name, "을", "를")} '${prepName}'의 다른 이름에서 빼면, 이 이름을 쓰는 다른 레시피 ${others.length}곳도 함께 연결이 풀립니다.\n\n${others.join(", ")}\n\n뺄까요?`)) return false;
  return changeAlias("DELETE", prep, name, `'${name}'${josa(name, "을", "를")} '${prepName}'의 다른 이름에서 뺐습니다.`);
}

function stepsText(steps) {
  let number = 0;
  return steps.map((step) => {
    if (step.startsWith("- ")) return `   ${step}`;
    number += 1;
    return `${number}. ${step}`;
  }).join("\n");
}

function stepsArea(temperature, readonly) {
  const text = stepsText(state.recipe.steps[temperature]);
  if (readonly) return h("div", { class: "plain" }, text);
  return h("textarea", {
    value: text, placeholder: "1. 첫 번째 단계",
    oninput: (event) => {
      grow(event.target);
      state.recipe.steps[temperature] = event.target.value.split("\n")
        .map((line) => line.trim().replace(/^\d+[.)]\s*/, ""))
        .filter(Boolean);
      changed();
    },
  });
}

function memoArea(readonly) {
  const { recipe } = state;
  if (readonly) return h("div", { class: "plain" }, recipe.memo || "");
  return h("textarea", {
    value: recipe.memo || "", placeholder: "메모 입력",
    oninput: (event) => { grow(event.target); recipe.memo = event.target.value; changed(); },
  });
}

function freeFormPanel() {
  const { recipe } = state;
  if (!recipe.raw_text || recipe.variants.length) return null;
  return h("section", { class: "panel" },
    h("h3", {}, "재료표가 비어 있습니다"),
    h("p", {}, "요약글의 문장 속 분량은 추측하지 않고 비워 둡니다. 직접 입력하거나, 양식 안내문을 함께 넣어 Gemini 답변을 다시 받으면 자동으로 채워집니다."),
    h("button", { class: "link", onclick: async () => toast(await copyGuide(isPrep(recipe) ? "prep" : "menu")) },
      isPrep(recipe) ? "프렙 안내문 복사" : "메뉴 안내문 복사"));
}

function loosePanel() {
  const { recipe } = state;
  const loose = recipe.variants.filter((v) => v.temperature === "UNKNOWN");
  const steps = recipe.steps.UNKNOWN;
  if (!loose.length && !steps.length) return null;
  return h("section", { class: "panel" },
    h("h3", {}, "온도 미지정: HOT이나 ICED를 골라 서식으로 옮기세요"),
    loose.map(looseVariant),
    steps.length ? h("div", { class: "loose" },
      h("strong", {}, "제조방법 (온도 미확인)"),
      h("div", { class: "plain" }, stepsText(steps)),
      h("div", { class: "loose-tools" },
        h("button", { class: "button small", onclick: () => moveSteps(["HOT"]) }, "HOT으로"),
        h("button", { class: "button small", onclick: () => moveSteps(["ICED"]) }, "ICED로"),
        h("button", { class: "button small", onclick: () => moveSteps(["HOT", "ICED"]) }, "둘 다"))) : null);
}

function moveSteps(targets) {
  const { steps } = state.recipe;
  targets.forEach((temperature) => steps[temperature].push(...steps.UNKNOWN));
  steps.UNKNOWN = [];
  changed();
  renderRecipe();
}

function looseVariant(variant) {
  const temperature = h("select", {},
    ["HOT", "ICED"].map((t) => h("option", { value: t, selected: variant.temperature === t }, t)));
  const size = h("select", {}, SIZES.map((name) => h("option", { value: name }, name)));
  return h("div", { class: "loose" },
    h("strong", {}, `${TEMPERATURE_NAMES[variant.temperature]} · 영상 표기 ${variant.label || "미확인"}`),
    variant.note ? h("div", { class: "muted" }, variant.note) : null,
    h("ul", {}, variant.ingredients.map((row) =>
      h("li", {}, [row.name, row.amount, row.aux, row.note].filter(Boolean).join(" · ")))),
    h("div", { class: "loose-tools" }, temperature, size,
      h("button", { class: "button small", onclick: () => moveVariant(variant, temperature.value, size.value) }, "서식으로 옮기기"),
      h("button", {
        class: "button small danger",
        onclick: () => {
          state.recipe.variants.splice(state.recipe.variants.indexOf(variant), 1);
          changed();
          renderRecipe();
        },
      }, "삭제")));
}

function unreadPanel() {
  const { unread } = state.recipe;
  if (!unread) return null;
  return h("section", { class: "panel" }, h("h3", {}, "서식에 넣지 못한 내용"), h("pre", {}, unread));
}

function showRawError(message) {
  const element = document.getElementById("raw-error");
  element.textContent = message;
  element.hidden = !message;
}

function setRawEditing(editing) {
  const shown = {
    "raw-editor": editing, "raw-cancel": editing, "raw-apply": editing,
    "raw-text": !editing, "raw-edit": !editing, "raw-close": !editing,
    "raw-undo": !editing && state.recipe.can_undo,
  };
  Object.entries(shown).forEach(([id, visible]) => { document.getElementById(id).hidden = !visible; });
  showRawError("");
}

function showRaw() {
  const text = state.recipe.raw_text;
  document.getElementById("raw-text").textContent = text;
  document.getElementById("raw-input").value = text || "";
  document.getElementById("raw-guide").textContent = GUIDE_LABELS.menu;
  document.getElementById("raw-prep-guide").textContent = GUIDE_LABELS.prep;
  setRawEditing(!text);
  document.getElementById("raw-dialog").showModal();
}

function editRaw() {
  document.getElementById("raw-input").value = state.recipe.raw_text;
  setRawEditing(true);
}

async function showChanged(recipe) {
  state.recipe = recipe;
  chooseTemperature();
  document.getElementById("raw-dialog").close();
  renderRecipe();
  await loadRecipes();
  renderSidebar(recipe.id);
}

async function applyRaw() {
  if (!confirm("재료표와 제조방법을 이 내용으로 바꿀까요? 사진은 그대로 두고, 결과가 이상하면 Gemini 원문 창의 [되돌리기]로 바로 전 상태로 돌아갈 수 있습니다.")) return;
  await save(); // A pending autosave must land first, or it would overwrite the new sheet.
  try {
    const text = document.getElementById("raw-input").value;
    const recipe = await api(`/api/recipes/${state.recipe.id}/answer`, sendJson("PUT", { text }));
    await showChanged(recipe);
    toast(recipe.free_form ? "서식을 다시 채웠습니다. 비어 있는 칸을 확인해 주세요." : "서식을 다시 채웠습니다.");
  } catch (error) {
    showRawError(error.message);
  }
}

async function undoRaw() {
  if (!confirm("서식을 다시 채우기 전 상태로 되돌릴까요? 다시 채운 뒤에 직접 고친 내용은 사라집니다.")) return;
  await save();
  try {
    await showChanged(await api(`/api/recipes/${state.recipe.id}/answer/undo`, { method: "POST" }));
    toast("이전 상태로 되돌렸습니다.");
  } catch (error) {
    showRawError(error.message);
  }
}

function printRecipe() {
  const root = document.getElementById("print-root");
  if (isPrep(state.recipe)) root.replaceChildren(prepSheet(true));
  else {
    const used = usedTemperatures();
    root.replaceChildren(...(used.length ? used : ["HOT"]).map((t) => sheet(t, true)));
  }
  window.print();
}

async function deleteRecipe() {
  const name = state.recipe.menu_name || "이 레시피";
  if (!confirm(`'${name}'를 삭제할까요? 저장된 .md와 사진도 함께 지워지고 되돌릴 수 없습니다.`)) return;
  clearTimeout(state.timer);
  state.dirty = false;
  await state.queue;
  await api(`/api/recipes/${state.recipe.id}`, { method: "DELETE" });
  location.hash = "#/";
}

/* ---------- routing ---------- */

async function route() {
  closePop();
  await save();
  try {
    await loadRecipes();
  } catch (error) {
    if (!state.recipes.length) {
      app.replaceChildren(h("p", { class: "no-result" }, error.message));
      return;
    }
  }
  const match = location.hash.match(/^#\/recipe\/(\d+)$/);
  if (match) {
    state.highlightId = null;
    renderSidebar(Number(match[1]));
    await showRecipe(match[1]);
  } else {
    state.recipe = null;
    renderSidebar(null);
    renderDashboard();
  }
}

window.addEventListener("hashchange", route);
if (!PUBLISHED) wireEditor();
if (PUBLISHED && "serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");

readSetup().then(({ table, guides, categories }) => {
  state.table = table;
  state.guides = guides;
  state.categories = categories;
  route();
}).catch((error) => {
  app.replaceChildren(h("p", { class: "no-result" }, error.message));
});
