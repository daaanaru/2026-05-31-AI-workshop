/* =============================================================
   AI勉強会 事前フォーム — interactive controller
   ============================================================= */
(function () {
  "use strict";

  const STORAGE_KEY = "ai-workshop-form-v1";
  const PREFS_KEY = "ai-workshop-prefs-v1";
  const STEPS = 6; // form steps (summit is step 7)
  const form = document.getElementById("workshop-form");
  const body = document.body;

  // -----------------------------------------------------------
  // Splash — first-view fullscreen mountain
  // -----------------------------------------------------------
  (function splash() {
    const splash = document.getElementById("splash");
    if (!splash) return;
    body.classList.add("splash-open");

    const cta = document.getElementById("sp-cta");
    const skip = document.getElementById("sp-skip");

    let dismissed = false;
    function dismiss(scrollToForm) {
      if (dismissed) return;
      dismissed = true;
      splash.classList.add("leaving");
      body.classList.remove("splash-open");
      setTimeout(() => { splash.classList.add("done"); }, 950);
      if (scrollToForm) {
        setTimeout(() => {
          const t = document.getElementById("step-1");
          if (t) {
            const top = t.getBoundingClientRect().top + window.scrollY - 8;
            window.scrollTo({ top, behavior: "smooth" });
          }
        }, 500);
      }
    }

    cta.addEventListener("click", () => dismiss(true));
    skip.addEventListener("click", () => dismiss(false));

    // allow Enter / Space / any click on splash after CTA appears
    let clickable = false;
    setTimeout(() => { clickable = true; }, 3800);
    splash.addEventListener("click", (e) => {
      if (!clickable) return;
      if (e.target === cta || e.target === skip) return;
      if (cta.contains(e.target) || skip.contains(e.target)) return;
      dismiss(true);
    });

    // scroll / keyboard to dismiss after a moment
    const onScroll = () => { if (clickable) dismiss(false); window.removeEventListener("wheel", onScroll); window.removeEventListener("touchmove", onScroll); };
    window.addEventListener("wheel", onScroll, { passive: true });
    window.addEventListener("touchmove", onScroll, { passive: true });
    document.addEventListener("keydown", (e) => {
      if (!clickable) return;
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "Escape") {
        dismiss(e.key !== "Escape");
      }
    }, { once: false });
  })();


  // -----------------------------------------------------------
  // Preferences (time-of-day / map / motion)
  // -----------------------------------------------------------
  const prefs = Object.assign(
    { time: "dawn", motion: "full" },
    safeParse(localStorage.getItem(PREFS_KEY))
  );

  function applyPrefs() {
    body.dataset.time = prefs.time;
    body.dataset.map = "on";
    body.dataset.motion = prefs.motion;
    savePrefs();
  }
  function savePrefs() {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }
  applyPrefs();

  // auto-apply time of day based on current hour on first load
  (function autoDayTheme() {
    if (localStorage.getItem(PREFS_KEY)) return;
    const h = new Date().getHours();
    if (h >= 5 && h < 10) prefs.time = "dawn";
    else if (h >= 10 && h < 16) prefs.time = "noon";
    else if (h >= 16 && h < 19) prefs.time = "dusk";
    else prefs.time = "night";
    applyPrefs();
  })();

  // Respect user's OS-level reduced motion preference
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    prefs.motion = "reduced";
    applyPrefs();
  }

  // -----------------------------------------------------------
  // Draft persistence
  // -----------------------------------------------------------
  function currentFormData() {
    const data = {};
    const fd = new FormData(form);
    for (const [key, value] of fd.entries()) {
      if (data[key] === undefined) data[key] = value;
      else if (Array.isArray(data[key])) data[key].push(value);
      else data[key] = [data[key], value];
    }
    // collect all checkbox groups (even unchecked keys need to exist for array fields)
    form.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      if (!cb.name) return;
      if (cb.name === "pcRequired") return; // single confirm
      if (!(cb.name in data)) data[cb.name] = [];
      else if (!Array.isArray(data[cb.name])) data[cb.name] = [data[cb.name]];
    });
    return data;
  }

  function restoreDraft() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = safeParse(raw);
    if (!data) return;
    for (const [name, val] of Object.entries(data)) {
      if (name === "_meta") continue;
      const inputs = form.querySelectorAll(`[name="${CSS.escape(name)}"]`);
      if (!inputs.length) continue;
      if (inputs[0].type === "radio") {
        inputs.forEach((r) => { r.checked = (r.value === val); });
      } else if (inputs[0].type === "checkbox" && name !== "pcRequired") {
        const arr = Array.isArray(val) ? val : (val ? [val] : []);
        inputs.forEach((c) => { c.checked = arr.includes(c.value); });
      } else if (inputs[0].type === "checkbox" && name === "pcRequired") {
        inputs[0].checked = !!val;
      } else {
        inputs[0].value = val;
      }
    }
    updateCounters();
    refreshSubmitState();
    // Sync tool-matrix row highlights
    form.querySelectorAll(".tool-row").forEach((row) => {
      const selected = row.querySelector('input[type="radio"]:checked');
      row.classList.toggle("has-answer", !!(selected && selected.value !== "none"));
    });
  }

  let saveTimer;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const data = currentFormData();
      data._meta = { savedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      flashSaved();
      refreshSubmitState();
    }, 550);
  }

  const saveChip = document.getElementById("save-chip");
  let chipTimer;
  function flashSaved() {
    saveChip.classList.add("show");
    clearTimeout(chipTimer);
    chipTimer = setTimeout(() => saveChip.classList.remove("show"), 1600);
    const lastSaved = document.getElementById("last-saved");
    if (lastSaved) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      lastSaved.textContent = `LAST SAVED · ${hh}:${mm}`;
    }
  }

  form.addEventListener("input", (e) => {
    scheduleSave();
    if (e.target.matches("textarea, input")) updateFieldCount(e.target);
    clearFieldError(e.target);
  });
  form.addEventListener("change", (e) => {
    scheduleSave();
    // Tool-matrix: highlight rows with a non-"none" answer
    if (e.target.matches('.tool-row input[type="radio"]')) {
      const row = e.target.closest(".tool-row");
      if (row) row.classList.toggle("has-answer", e.target.value !== "none");
    }
  });

  // -----------------------------------------------------------
  // Prompt generation — "AIに相談するプロンプトをコピー"
  // -----------------------------------------------------------
  const FAMILIARITY_LABEL = {
    none: "使ってない",
    curious: "気になってる",
    occasional: "たまに",
    weekly: "週数回",
    work: "仕事で",
    heavy: "めちゃ使う"
  };

  function collectToolUsage(d) {
    // Pull every usage_* key and surface the tools with non-"none" answers
    const used = [];
    Object.keys(d).forEach((k) => {
      if (!k.startsWith("usage_")) return;
      const v = d[k];
      if (!v || v === "none") return;
      const tool = document.querySelector(`input[name="${k}"]`)?.closest(".tool-row")?.dataset.tool || k.slice(6);
      used.push(`${tool}(${FAMILIARITY_LABEL[v] || v})`);
    });
    return used;
  }

  function ctx() {
    const d = currentFormData();
    const arr = (v) => Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);
    const lines = [];
    if (d.displayName) lines.push(`- 呼ばれ方: ${d.displayName}`);
    if (d.skills) lines.push(`- 得意領域: ${String(d.skills).replace(/\n+/g, " / ")}`);
    if (d.pcType) lines.push(`- 使うPC: ${d.pcType}${d.pcDetail ? `(${d.pcDetail})` : ""}`);
    const env = arr(d.environment);
    if (env.length) lines.push(`- 使える環境: ${env.join(", ")}`);
    const tools = collectToolUsage(d);
    if (tools.length) lines.push(`- 使っているAI: ${tools.join(", ")}${d.otherAiTools ? ` / ${d.otherAiTools}` : ""}`);
    const interests = arr(d.interests);
    if (interests.length) lines.push(`- 気になるテーマ: ${interests.join(", ")}`);
    if (d.goal) lines.push(`- AIで達成したいこと: ${String(d.goal).replace(/\n+/g, " / ")}`);
    if (d.deafWorkflowPain) lines.push(`- 変えたい場面: ${String(d.deafWorkflowPain).replace(/\n+/g, " / ")}`);
    if (d.homeworkExample) lines.push(`- 最近のAIエピソード: ${String(d.homeworkExample).replace(/\n+/g, " / ")}`);
    return lines.join("\n");
  }

  const PROMPTS = {
    skills: () => `あなたは、あるエンジニアの自己紹介をまとめるコーチです。
以下のメモから、「得意技術・普段の開発領域」を3〜5個の箇条書きにしてください。
他のエンジニアが読んで1分でチーム分けに使えるくらい、具体的に。

# これまでに私が答えた内容
${ctx() || "(まだほとんど入力していません)"}

# 出力形式
- 箇条書き3〜5個
- 各項目は15〜30字
- 抽象語だけにならないこと(例: 「フロント」ではなく「Next.js + TypeScriptで管理画面を作る」)`,

    goal: () => `あなたは、AIの使い道を一緒に考えるパートナーです。
「AIで何を達成したいか」を、私のこれまでの回答を踏まえて3案、提案してください。
聞こえる前提で設計された開発・会議・情報共有を、AIで作り替えることに興味があります。

# これまでに私が答えた内容
${ctx() || "(まだほとんど入力していません)"}

# 出力形式
1. 【タイトル】ひとことで言うと / なぜそれか(2文)
2. 同上
3. 同上
- どれも私の得意領域と今使っているAIツールで手が届く範囲にしてください
- 最後に「一番挑戦的な1つ」を選んで理由を1行`,

    pain: () => `あなたは、デフ(ろう・難聴)エンジニアの働き方を観察するUXリサーチャーです。
私のこれまでの回答をもとに、「聞こえる前提で設計された開発・会議・情報共有」で
不便・もったいない場面を5つ、具体的なシーンとして書き出してください。

# これまでに私が答えた内容
${ctx() || "(まだほとんど入力していません)"}

# 出力形式
- 各項目: 【場面】どこで起きるか / 【何が流れてしまうか】 / 【AIで置き換えられそうな部分】
- 抽象論は禁止。必ず「ある日の〇〇中」のシーンから始めること
- 私自身が気づいていなさそうな盲点を1つは混ぜてください`,

    homework: () => `あなたは、AI使用経験の振り返りを手伝うコーチです。
私のこれまでの回答をもとに、「最近AIを使って助かった / 失敗した」エピソードを1つ思い出すのを手伝ってください。
ただし、あなたは答えを作らず、私が話せるように質問だけ投げてください。

# これまでに私が答えた内容
${ctx() || "(まだほとんど入力していません)"}

# 出力形式
- 最初に「直近2週間で、以下のツールのどれを一番使いましたか?」と私の使っているツールを並べる
- そこから段階的に質問を6つ。各質問は1文、やさしい日本語
- 最後に「このエピソードを3〜5分で話すなら、こう構成すると良いです」と短い骨子を提示`,

    build: () => `あなたは、1日ハッカソンのテーマ出しを手伝うメンターです。
私のこれまでの回答をもとに、「当日12時間で作れる / 明日から運用できる」アイデアを3つ出してください。
デフエンジニア向け勉強会(2026/05/31)で発表する前提です。

# これまでに私が答えた内容
${ctx() || "(まだほとんど入力していません)"}

# 出力形式
各案について:
1. 【名前】キャッチーに
2. 【解決する場面】私の回答のどれを受けているか
3. 【最小構成】使うAIツール・環境 / 12時間で作れるMVP
4. 【発表での見せ方】1分でインパクトを出す方法
- 3案は「保守的 / バランス / 挑戦的」に散らしてください`
  };

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (er) {}
      document.body.removeChild(ta);
      return true;
    }
  }

  document.querySelectorAll(".prompt-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.promptFor;
      const fn = PROMPTS[key];
      if (!fn) return;
      const text = fn();
      await copyText(text);
      btn.classList.add("copied");
      const label = btn.querySelector(".pb-label");
      const hint = btn.querySelector(".pb-hint");
      const origLabel = label.textContent;
      const origHint = hint ? hint.textContent : "";
      label.textContent = "✓ プロンプトをコピーしました";
      if (hint) hint.textContent = "ChatGPT / Claude等に貼り付け";
      setTimeout(() => {
        btn.classList.remove("copied");
        label.textContent = origLabel;
        if (hint) hint.textContent = origHint;
      }, 2400);
    });
  });

  // -----------------------------------------------------------
  // Counters
  // -----------------------------------------------------------
  function updateFieldCount(input) {
    const field = input.closest(".field");
    if (!field) return;
    const counter = field.querySelector(".counter");
    if (!counter) return;
    const now = counter.querySelector(".now");
    const max = parseInt(counter.textContent.split("/").pop(), 10) || 0;
    const len = (input.value || "").length;
    if (now) now.textContent = len;
    counter.classList.toggle("near", max && len > max * 0.9);
  }
  function updateCounters() {
    form.querySelectorAll(".field").forEach((f) => {
      const ta = f.querySelector("textarea, input[type=text]");
      if (ta) updateFieldCount(ta);
    });
  }

  // -----------------------------------------------------------
  // Validation
  // -----------------------------------------------------------
  function validateStep(stepNum) {
    const step = form.querySelector(`#step-${stepNum}`);
    if (!step) return true;
    let ok = true;
    step.querySelectorAll("[required]").forEach((el) => {
      if (el.type === "checkbox") {
        if (!el.checked) { markError(el); ok = false; }
      } else if (el.type === "radio") {
        const group = step.querySelectorAll(`[name="${el.name}"]`);
        if (![...group].some((r) => r.checked)) {
          group.forEach(markError);
          ok = false;
        }
      } else if (!el.value.trim()) {
        markError(el); ok = false;
      }
    });
    return ok;
  }
  function markError(el) {
    const field = el.closest(".field") || el.closest("fieldset") || el.closest(".confirm");
    if (field) field.classList.add("has-error");
  }
  function clearFieldError(el) {
    if (!el) return;
    const field = el.closest(".field") || el.closest("fieldset") || el.closest(".confirm");
    if (field) field.classList.remove("has-error");
  }

  function refreshSubmitState() {
    const reqs = Array.from(form.querySelectorAll("[required]"));
    let filled = 0, total = 0;
    const radioGroupsSeen = new Set();
    reqs.forEach((el) => {
      if (el.type === "radio") {
        if (radioGroupsSeen.has(el.name)) return;
        radioGroupsSeen.add(el.name);
        total++;
        const group = form.querySelectorAll(`[name="${el.name}"]`);
        if ([...group].some((r) => r.checked)) filled++;
      } else if (el.type === "checkbox") {
        total++;
        if (el.checked) filled++;
      } else {
        total++;
        if (el.value.trim()) filled++;
      }
    });
    const lbl = document.getElementById("state-label");
    if (lbl) {
      if (filled === total) {
        lbl.innerHTML = `準備完了 <span style="color:var(--route);">●</span>`;
      } else {
        lbl.innerHTML = `残り ${total - filled} 項目 <span class="missing">●</span>`;
      }
    }
  }

  // -----------------------------------------------------------
  // Step navigation + progress
  // -----------------------------------------------------------
  let currentStep = 0; // 0 = hero / intro

  document.querySelectorAll("[data-jump]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const target = parseInt(btn.dataset.jump, 10);
      if (btn.classList.contains("next") && !validateStep(currentStep || target - 1)) {
        e.preventDefault();
        flashSaved();
        // find first error in current step and focus
        const first = form.querySelector(`#step-${currentStep} .has-error input, #step-${currentStep} .has-error textarea, #step-${currentStep} .has-error select`);
        if (first) first.focus();
        return;
      }
      goToStep(target);
    });
  });

  function goToStep(n) {
    const t = document.getElementById(`step-${n}`);
    if (!t) return;
    const top = t.getBoundingClientRect().top + window.scrollY - 8;
    window.scrollTo({ top, behavior: prefs.motion === "reduced" ? "auto" : "smooth" });
  }

  // IntersectionObserver — detect active step
  const stepEls = document.querySelectorAll(".form-step, .summit-band");
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && e.intersectionRatio > 0.3) {
        const n = parseInt(e.target.dataset.step, 10);
        if (!isNaN(n)) setActive(n);
      }
    });
  }, { threshold: [0.3, 0.6] });
  stepEls.forEach((el) => obs.observe(el));

  function setActive(n) {
    if (currentStep === n) return;
    currentStep = n;
    updateClimber(n);
  }

  // -----------------------------------------------------------
  // Route map animation
  // -----------------------------------------------------------
  const tracePath = document.getElementById("trace-route");
  const plannedPath = document.getElementById("planned-route");
  const climber = document.getElementById("climber");
  const stations = document.querySelectorAll("#stations .station");
  const summitFlag = document.getElementById("summit-flag");

  // compute lengths
  let totalLen = 500;
  try { totalLen = plannedPath.getTotalLength(); } catch (e) {}
  tracePath.style.setProperty("--len", totalLen);
  tracePath.style.setProperty("--off", totalLen);

  // collect station positions along the path
  // Use the station translates as anchor points; compute their length-along-path
  const stationPoints = [];
  stations.forEach((s) => {
    const tr = s.getAttribute("transform") || "";
    const m = /translate\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/.exec(tr);
    if (m) stationPoints.push({ step: parseInt(s.dataset.step, 10), x: +m[1], y: +m[2], el: s });
  });

  function lenAtStep(step) {
    // Walk the path and find closest point to station
    if (step <= 0) return 0;
    if (step >= 7) return totalLen;
    const target = stationPoints.find((p) => p.step === step);
    if (!target) return 0;
    // Sample the path
    let bestLen = 0, bestDist = Infinity;
    const samples = 160;
    for (let i = 0; i <= samples; i++) {
      const L = (totalLen * i) / samples;
      const pt = plannedPath.getPointAtLength(L);
      const dx = pt.x - target.x, dy = pt.y - target.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; bestLen = L; }
    }
    return bestLen;
  }

  // precompute step -> length
  const stepLens = {};
  for (let i = 0; i <= 7; i++) stepLens[i] = lenAtStep(i);

  function updateClimber(step) {
    // station states
    stations.forEach((s) => {
      const n = parseInt(s.dataset.step, 10);
      s.classList.toggle("reached", n > 0 && n <= step);
      s.classList.toggle("active", n === step);
    });
    // route trace
    const L = stepLens[Math.max(0, Math.min(step, 7))] || 0;
    tracePath.style.setProperty("--off", Math.max(0, totalLen - L));
    // climber position
    if (L > 0) {
      const p = plannedPath.getPointAtLength(L);
      climber.setAttribute("transform", `translate(${p.x} ${p.y})`);
    } else {
      const first = stationPoints.find((s) => s.step === 0);
      if (first) climber.setAttribute("transform", `translate(${first.x} ${first.y})`);
    }
    // summit flag
    if (step >= 7) summitFlag.classList.add("up");
    else summitFlag.classList.remove("up");

    // mobile progress
    const mobBar = document.getElementById("mobile-progress-bar");
    const mobLbl = document.getElementById("mobile-progress-label");
    if (mobBar) mobBar.style.width = `${Math.min(100, (step / 6) * 100)}%`;
    if (mobLbl) {
      const names = ["Base Camp", "現在地", "装備", "道具", "稜線", "宿題", "当日準備", "山頂"];
      mobLbl.textContent = `STEP ${String(step).padStart(2, "0")} / 06 — ${names[step] || ""}`;
    }
  }
  updateClimber(0);

  // -----------------------------------------------------------
  // Station click navigation
  // -----------------------------------------------------------
  stations.forEach((s) => {
    s.style.cursor = "pointer";
    s.addEventListener("click", () => {
      const n = parseInt(s.dataset.step, 10);
      if (n === 0) window.scrollTo({ top: 0, behavior: prefs.motion === "reduced" ? "auto" : "smooth" });
      else goToStep(n);
    });
  });

  // -----------------------------------------------------------
  // Submit / Summit
  // -----------------------------------------------------------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    // validate all steps
    let firstBad = null;
    for (let i = 1; i <= STEPS; i++) {
      if (!validateStep(i) && firstBad === null) firstBad = i;
    }
    if (firstBad !== null) {
      goToStep(firstBad);
      setTimeout(() => {
        const f = form.querySelector(`#step-${firstBad} .has-error input, #step-${firstBad} .has-error textarea, #step-${firstBad} .has-error select`);
        if (f) f.focus();
      }, 500);
      return;
    }
    showSummit();
  });

  function buildJson() {
    const data = currentFormData();
    data._meta = {
      savedAt: new Date().toISOString(),
      workshop: "Deaf Engineers AI Workshop Vol.01",
      workshopDate: "2026-05-31"
    };
    return data;
  }

  // ------- Email composition -------
  const FIELD_LABELS = {
    displayName: "呼ばれ方",
    github: "GitHub",
    email: "連絡用メール",
    skills: "普段の開発領域・得意技術",
    pcType: "持ってくるPC",
    pcDetail: "PCの補足",
    environment: "当日使えそうな環境",
    otherAiTools: "その他使っているAI",
    interests: "関心があるテーマ",
    goal: "AIで達成したいこと",
    deafWorkflowPain: "聞こえる前提で変えたい場面",
    homeworkExample: "最近のAIエピソード",
    buildIdea: "当日つくってみたいもの",
    notes: "運営への連絡"
  };

  function buildEmailBody() {
    const d = currentFormData();
    const rows = [];
    rows.push("AI勉強会 事前フォーム 回答控え");
    rows.push("================================");
    rows.push("");

    // tool usage — flatten into one readable block
    const tools = collectToolUsage(d);
    Object.keys(FIELD_LABELS).forEach((k) => {
      if (!(k in d)) return;
      const v = d[k];
      if (v == null || v === "") return;
      const label = FIELD_LABELS[k];
      if (Array.isArray(v)) {
        if (!v.length) return;
        rows.push(`■ ${label}`);
        v.forEach((x) => rows.push(`  ・${x}`));
        rows.push("");
      } else if (typeof v === "string" && v.includes("\n")) {
        rows.push(`■ ${label}`);
        v.split(/\n+/).forEach((ln) => rows.push(`  ${ln}`));
        rows.push("");
      } else {
        rows.push(`■ ${label}`);
        rows.push(`  ${v}`);
        rows.push("");
      }
    });

    if (tools.length) {
      rows.push("■ 使っているAIツール");
      tools.forEach((t) => rows.push(`  ・${t}`));
      // paid
      const paid = Object.keys(d)
        .filter((k) => k.startsWith("paid_") && d[k] === "yes")
        .map((k) => document.querySelector(`input[name="${k}"]`)?.closest(".tool-row")?.dataset.tool || k.slice(5));
      if (paid.length) rows.push(`  (課金中: ${paid.join(", ")})`);
      rows.push("");
    }

    rows.push("--------------------------------");
    rows.push(`送信日時: ${new Date().toLocaleString("ja-JP")}`);
    rows.push("Deaf Engineers AI Workshop Vol.01 · 2026.05.31");
    return rows.join("\n");
  }

  function openMailto() {
    const d = currentFormData();
    const to = (d.email || "").trim();
    const subject = `[AI勉強会] 事前フォーム 回答控え - ${d.displayName || "名前未入力"}`;
    const body = buildEmailBody();
    const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    // mailto has URL length limits — guard around ~2000 chars total
    if (href.length > 1900) {
      // truncate body safely
      const slim = body.slice(0, 1500) + "\n\n…(長文のため省略。全文はフォームからコピーしてください)";
      const href2 = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(slim)}`;
      window.location.href = href2;
    } else {
      window.location.href = href;
    }
  }

  function showSummit() {
    const overlay = document.getElementById("summit-overlay");
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    // climber to summit
    currentStep = 7;
    updateClimber(7);
    // populate email receipt
    try {
      const email = (currentFormData().email || "").trim();
      const receipt = document.getElementById("email-receipt");
      const toEl = document.getElementById("receipt-to");
      if (receipt && toEl) {
        if (email) {
          toEl.textContent = email;
          receipt.hidden = false;
        } else {
          receipt.hidden = true;
        }
      }
    } catch (e) {}
    // Increment crew count (applied engineers)
    try {
      const cur = parseInt(localStorage.getItem(CREW_KEY) || "0", 10) || 0;
      localStorage.setItem(CREW_KEY, String(Math.min(CREW_MAX, cur + 1)));
      updateCrew();
    } catch (e) {}
    // focus trap — focus email button first (main CTA)
    setTimeout(() => {
      const btn = document.getElementById("summit-email") || document.getElementById("summit-close");
      if (btn) btn.focus();
    }, 520);
  }

  function closeSummit() {
    const overlay = document.getElementById("summit-overlay");
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
  }

  document.getElementById("summit-close").addEventListener("click", closeSummit);
  document.getElementById("summit-edit").addEventListener("click", closeSummit);
  document.getElementById("summit-overlay").addEventListener("click", (e) => {
    if (e.target.id === "summit-overlay") closeSummit();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSummit();
  });

  // Email + JSON buttons on the summit card
  const summitEmailBtn = document.getElementById("summit-email");
  if (summitEmailBtn) {
    summitEmailBtn.addEventListener("click", () => {
      openMailto();
      const orig = summitEmailBtn.querySelector("span").textContent;
      summitEmailBtn.querySelector("span").textContent = "メーラーを開きました";
      setTimeout(() => { summitEmailBtn.querySelector("span").textContent = orig; }, 2200);
    });
  }
  const summitCopyJsonBtn = document.getElementById("summit-copy-json");
  if (summitCopyJsonBtn) {
    summitCopyJsonBtn.addEventListener("click", () => copyJson(summitCopyJsonBtn));
  }

  function copyJson(btn) {
    const data = buildJson();
    const text = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = "✓ コピーしました";
      setTimeout(() => { btn.textContent = orig; }, 1600);
    }).catch(() => {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      btn.textContent = "✓ コピーしました";
    });
  }

  document.getElementById("clear-draft").addEventListener("click", () => {
    if (!confirm("下書きを破棄して入力をクリアしますか?")) return;
    localStorage.removeItem(STORAGE_KEY);
    form.reset();
    updateCounters();
    refreshSubmitState();
    document.getElementById("last-saved").textContent = "—";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // -----------------------------------------------------------
  // JSON syntax highlight (very light)
  // -----------------------------------------------------------
  function highlight(json) {
    return json
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (m) => {
          let cls = "n";
          if (/^"/.test(m)) cls = /:$/.test(m) ? "k" : "s";
          else if (/true|false/.test(m)) cls = "b";
          else if (/null/.test(m)) cls = "b";
          return `<span class="${cls}">${m}</span>`;
        });
  }

  // -----------------------------------------------------------
  // Crew counter — applied engineers
  // -----------------------------------------------------------
  const CREW_KEY = "ai-workshop-crew-count";
  const CREW_MAX = 6;
  function updateCrew() {
    const n = parseInt(localStorage.getItem(CREW_KEY) || "0", 10) || 0;
    const a = document.getElementById("crew-count");
    const b = document.getElementById("crew-count-hero");
    if (a) a.textContent = n;
    if (b) b.textContent = n;
  }
  updateCrew();
  window.addEventListener("storage", (e) => { if (e.key === CREW_KEY) updateCrew(); });

  // -----------------------------------------------------------
  // Custom tool rows (add your own)
  // -----------------------------------------------------------
  const addBtn = document.getElementById("add-tool-btn");
  const rowsWrap = document.querySelector(".tool-rows");
  const LEVELS = [
    ["lv0","none","使ってない"],
    ["lv1","curious","気になってる"],
    ["lv2","occasional","たまに"],
    ["lv3","weekly","週数回"],
    ["lv4","heavy","めっちゃ"],
    ["lv5","work","仕事で"],
  ];
  let customIdx = 0;
  function renderCustomRow(idx, initialName = "") {
    const id = `Custom${idx}`;
    const row = document.createElement("div");
    row.className = "tool-row tool-row-custom";
    row.dataset.tool = initialName || `(未入力)`;
    row.dataset.custom = "1";
    row.innerHTML = `
      <span class="tr-name tr-name-input">
        <input type="text" class="tr-name-edit" name="customTool_${id}" value="${initialName.replace(/"/g,'&quot;')}" aria-label="ツール名" placeholder="ツール名を入力" />
        <button type="button" class="tr-remove" aria-label="削除">×</button>
      </span>
      <div class="tr-scale" role="radiogroup" aria-label="カスタムツールの使用感">
        ${LEVELS.map(([cls,val,lbl])=>`<label class="lv ${cls}"><input type="radio" name="usage_${id}" value="${val}"${val==='none'?' checked':''} /><span class="dot"></span><span class="lv-label">${lbl}</span></label>`).join('')}
      </div>
      <label class="tr-paid" title="課金している(任意)">
        <input type="checkbox" name="paid_${id}" value="yes" />
        <span class="paid-chip" aria-hidden="true">¥</span>
        <span class="sr-only">このツールに課金している</span>
      </label>`;
    rowsWrap.appendChild(row);
    const nameInput = row.querySelector(".tr-name-edit");
    nameInput.addEventListener("input", () => {
      row.dataset.tool = nameInput.value || "(未入力)";
      scheduleSave();
    });
    row.querySelector(".tr-remove").addEventListener("click", () => {
      row.remove();
      scheduleSave();
    });
    if (!initialName) setTimeout(() => nameInput.focus(), 50);
  }
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      customIdx++;
      renderCustomRow(customIdx);
    });
  }

  // -----------------------------------------------------------
  // Boot
  // -----------------------------------------------------------
  function safeParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

  restoreDraft();
  updateCounters();
  refreshSubmitState();

  // Populate last-saved if draft exists
  const draftRaw = safeParse(localStorage.getItem(STORAGE_KEY));
  if (draftRaw && draftRaw._meta && draftRaw._meta.savedAt) {
    const d = new Date(draftRaw._meta.savedAt);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    document.getElementById("last-saved").textContent = `LAST SAVED · ${hh}:${mm}`;
  }
})();
