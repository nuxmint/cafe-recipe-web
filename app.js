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
const state = {
  table: null, guide: "", recipe: null, recipes: [], filter: "all", query: "", highlightId: null,
  temperature: "HOT", dirty: false, timer: null, queue: Promise.resolve(),
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
      if (state.recipe && state.recipe.id === id) state.recipe.md_name = saved.md_name;
      if (!state.dirty) setSaveState(`저장됨 · recipes/${saved.md_name}`);
      await loadRecipes();
      if (state.recipe && state.recipe.id === id) renderSidebar(id);
    } catch (error) {
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
  if (PUBLISHED) return { table: (await fetchPublished()).sizes, guide: "" };
  const [table, guide] = await Promise.all([api("/api/sizes"), api("/api/guide")]);
  return { table, guide: guide.text };
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

function needsAttention(recipe) {
  return recipe.blank_count > 0 || recipe.review_count > 0 || recipe.variant_count === 0;
}

function sideDot(recipe) {
  const temperatures = temperaturesOf(recipe);
  const hot = temperatures.includes("HOT");
  const iced = temperatures.includes("ICED");
  return h("span", { class: `side-dot ${hot && iced ? "both" : hot ? "hot" : iced ? "iced" : ""}` });
}

function renderSidebar(activeId) {
  const recent = state.recipes.slice(0, RECENT_COUNT);
  const parts = [
    h("a", { class: "brand", href: "#/" }, h("span", { class: "brand-mark" }, icon("cup")), "레시피 노트"),
    PUBLISHED ? null : h("button", { class: "new-button", onclick: openNewDialog }, icon("plus"), "새 레시피 작성"),
    h("nav", { class: "side-nav" },
      h("a", { class: `side-link ${activeId ? "" : "active"}`, href: "#/" }, icon("grid"), "대시보드")),
    h("p", { class: "side-title" }, "최근 레시피"),
    h("div", { class: "side-list" }, recent.length
      ? recent.map((recipe) => h("a", {
        class: `side-link ${recipe.id === activeId ? "active" : ""}`, href: `#/recipe/${recipe.id}`,
      }, sideDot(recipe), h("span", { class: "side-name" }, recipe.menu_name || "메뉴명 미확인")))
      : h("p", { class: "side-empty" }, "아직 없습니다")),
    PUBLISHED ? null : h("button", { class: "publish-button", onclick: publishSite }, icon("phone"), "휴대폰에 게시"),
  ];
  sidebar.replaceChildren(...parts.filter(Boolean));
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
  { key: "all", label: "전체 레시피", icon: "book", match: () => true },
  { key: "HOT", label: "HOT", icon: "flame", match: (r) => temperaturesOf(r).includes("HOT") },
  { key: "ICED", label: "ICED", icon: "snow", match: (r) => temperaturesOf(r).includes("ICED") },
  { key: "review", label: "확인 필요", icon: "alert", match: needsAttention },
].filter((item) => !PUBLISHED || item.key !== "review");

function renderDashboard() {
  document.title = PUBLISHED ? "레시피 노트" : "레시피 대시보드";
  const content = h("div", { class: "content" });
  app.replaceChildren(content);
  if (!state.recipes.length) {
    content.append(
      h("div", { class: "page-head" }, h("div", {}, h("h1", {}, PUBLISHED ? "레시피 노트" : "대시보드"))),
      h("div", { class: "empty" },
        artwork(["HOT", "ICED"]),
        h("h2", {}, PUBLISHED ? "아직 게시된 레시피가 없습니다" : "첫 레시피를 만들어 보세요"),
        h("p", {}, PUBLISHED
          ? "Mac 앱에서 '휴대폰에 게시'를 누르면 레시피가 이곳에 나타납니다."
          : "Gemini 요약을 넣으면 서식이 자동으로 채워지고, 레시피가 이곳에 카드로 나타납니다."),
        PUBLISHED ? null : h("button", { class: "button primary", onclick: openNewDialog }, icon("plus"), "새 레시피 작성")));
    return;
  }
  const tiles = h("div", { class: "tiles" });
  const list = h("div");
  const paint = () => {
    tiles.replaceChildren(...TILES.map(tile));
    list.replaceChildren(...recipeSection());
  };
  renderDashboard.paint = paint;
  content.append(
    h("div", { class: "page-head" },
      h("div", {}, h("h1", {}, PUBLISHED ? "레시피 노트" : "대시보드"),
        h("p", { class: "muted" }, PUBLISHED ? "게시한 레시피를 확인하세요" : "저장한 레시피를 한눈에 확인하세요")),
      h("label", { class: "search" }, icon("search"), h("input", {
        type: "search", placeholder: "메뉴명, 채널 검색", "aria-label": "레시피 검색", value: state.query,
        oninput: (event) => { state.query = event.target.value; paint(); },
      }))),
    tiles, list);
  paint();
  const fresh = list.querySelector(".is-new");
  if (fresh) fresh.scrollIntoView({ block: "center", behavior: "smooth" });
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
    h("span", { class: "tile-value" }, String(state.recipes.filter(item.match).length))));
}

function visibleRecipes() {
  const { match } = TILES.find((item) => item.key === state.filter);
  const query = state.query.trim().toLowerCase();
  return state.recipes.filter((recipe) => match(recipe)
    && `${recipe.menu_name || ""} ${recipe.channel || ""}`.toLowerCase().includes(query));
}

function recipeSection() {
  const recipes = visibleRecipes();
  const { label } = TILES.find((item) => item.key === state.filter);
  return [
    h("div", { class: "section-head" }, h("h2", {}, state.filter === "all" ? "내 레시피" : label),
      h("span", { class: "muted" }, `${recipes.length}개`)),
    recipes.length
      ? h("div", { class: "cards" }, recipes.map(card))
      : h("p", { class: "no-result" }, "조건에 맞는 레시피가 없습니다."),
  ];
}

function artwork(temperatures, photoUrl) {
  const hot = temperatures.includes("HOT");
  const iced = temperatures.includes("ICED");
  const kind = hot && iced ? "both" : hot ? "hot" : iced ? "iced" : "none";
  const box = h("div", { class: `art art-${kind}` });
  if (photoUrl) box.append(h("img", { src: photoUrl, alt: "" }));
  else if (kind === "iced") box.append(fromMarkup(ICED_ART));
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
  if (recipe.review_count) parts.push(`확인 ${recipe.review_count}`);
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
  const art = artwork(temperatures, recipe.photo);
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

function goToDashboard() {
  if (location.hash === "#/" || location.hash === "") route();
  else location.hash = "#/";
}

/* ---------- new recipe ---------- */

const newDialog = document.getElementById("new-dialog");
const newText = document.getElementById("new-text");
const newError = document.getElementById("new-error");
const newGuide = document.getElementById("new-guide");

function showNewError(message) {
  newError.textContent = message;
  newError.hidden = !message;
}

function openNewDialog() {
  newText.value = "";
  showNewError("");
  newGuide.textContent = "Gemini에 함께 넣을 양식 안내문 복사";
  newDialog.showModal();
}

async function submitNew() {
  try {
    const recipe = await api("/api/recipes", sendJson("POST", { text: newText.value }));
    newDialog.close();
    state.highlightId = recipe.id;
    state.filter = "all";
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

// Safari only allows the copy if it starts directly from the click, so the text is loaded beforehand.
async function copyGuide() {
  try {
    await navigator.clipboard.writeText(state.guide);
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
    newGuide.textContent = await copyGuide();
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
  document.getElementById("new-blank").addEventListener("click", async () => {
    const recipe = await api("/api/recipes/blank", { method: "POST" });
    newDialog.close();
    location.hash = `#/recipe/${recipe.id}`;
  });
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
  document.getElementById("raw-close").addEventListener("click", () => document.getElementById("raw-dialog").close());
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
    app.replaceChildren(h("p", { class: "error" }, error.message), h("a", { href: "#/" }, "대시보드로"));
    return;
  }
  const { variants, steps } = state.recipe;
  const hasHot = variants.some((v) => v.temperature === "HOT") || steps.HOT.length;
  const hasIced = variants.some((v) => v.temperature === "ICED") || steps.ICED.length;
  state.temperature = hasHot || !hasIced ? "HOT" : "ICED";
  renderRecipe();
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
    sheet(state.temperature, true),
    publishedUnknownPanel()));
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
  document.title = recipe.menu_name || "레시피";
  if (PUBLISHED) {
    renderPublishedRecipe();
    return;
  }
  const link = /^https?:\/\//.test(recipe.source_url || "")
    ? h("a", { class: "button", href: recipe.source_url, target: "_blank", rel: "noreferrer" }, icon("link"), "영상 열기")
    : null;
  app.replaceChildren(h("div", { class: "recipe-page" },
    h("div", { class: "recipe-head" },
      h("a", { class: "button", href: "#/" }, icon("back"), "대시보드"),
      h("span", { id: "save-state" }, recipe.md_name ? `저장됨 · recipes/${recipe.md_name}` : ""),
      h("span", { class: "spacer" }),
      recipe.raw_text ? h("button", { class: "button", onclick: showRaw }, icon("file"), "Gemini 원문") : null,
      h("button", { class: "button", onclick: printRecipe }, icon("printer"), "인쇄/PDF"),
      h("button", { class: "button danger", onclick: deleteRecipe }, icon("trash"), "삭제")),
    h("div", { class: "meta" },
      field("source_url", "출처 YouTube 주소"), link, field("channel", "채널")),
    sheet(state.temperature, false),
    freeFormPanel(),
    loosePanel(),
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

function usedTemperatures() {
  const { variants, steps } = state.recipe;
  return ["HOT", "ICED"].filter((t) => steps[t].length || variants.some((v) => v.temperature === t));
}

function tabs(active) {
  const shown = PUBLISHED && usedTemperatures().length ? usedTemperatures() : ["HOT", "ICED"];
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
    ? [h("img", { src: url, alt: `${temperature} 사진` }),
      h("button", { class: "button small", onclick: (event) => { event.stopPropagation(); removePhoto(temperature); } }, "사진 삭제")]
    : `${temperature} 사진 넣기 (선택)`);
  return box;
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
    for (let index = 0; index < total; index += 1) rows.push(ingredientRow(slot, index, readonly));
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

function ingredientRow(slot, index, readonly) {
  const variant = slot.find();
  const row = variant ? variant.ingredients[index] : null;
  if (readonly) {
    return h("tr", {}, ["name", "amount", "aux", "note"].map((key) => h("td", {}, (row && row[key]) || "")));
  }
  const paintBlank = (cell) => {
    const current = slot.find() ? slot.find().ingredients[index] : null;
    cell.classList.toggle("blank", Boolean(current && current.name && !current.amount));
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
      paintBlank(cells[1]);
      changed();
    },
  })));
  paintBlank(cells[1]);
  const end = h("td", { class: "row-end" }, row
    ? h("button", {
      class: "row-delete", title: "행 삭제",
      onclick: () => {
        variant.ingredients.splice(index, 1);
        if (!variant.ingredients.length) state.recipe.variants.splice(state.recipe.variants.indexOf(variant), 1);
        changed();
        renderRecipe();
      },
    }, "×")
    : h("button", {
      class: "row-delete", title: "행 추가",
      onclick: () => { ensureRow(slot.find() || slot.make(), index); renderRecipe(); },
    }, "+"));
  return h("tr", {}, cells, end);
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
    h("button", { class: "link", onclick: async () => toast(await copyGuide()) }, "양식 안내문 복사"));
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

function showRaw() {
  document.getElementById("raw-text").textContent = state.recipe.raw_text;
  document.getElementById("raw-dialog").showModal();
}

function printRecipe() {
  const used = usedTemperatures();
  document.getElementById("print-root").replaceChildren(...(used.length ? used : ["HOT"]).map((t) => sheet(t, true)));
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

readSetup().then(({ table, guide }) => {
  state.table = table;
  state.guide = guide;
  route();
}).catch((error) => {
  app.replaceChildren(h("p", { class: "no-result" }, error.message));
});
