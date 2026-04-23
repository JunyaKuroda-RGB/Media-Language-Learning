const DAILY_COUNT = 10;

let questions = [];
let quiz = [];
let idx = 0;
let correctCount = 0;
let locked = false;
let wrongs = [];
let mode = "phone";

// DOM
const elQ = document.getElementById("question");
const elChoices = document.getElementById("choices");
const elProgress = document.getElementById("progress");
const elScore = document.getElementById("score");
const elFeedback = document.getElementById("feedback");
const elNext = document.getElementById("nextBtn");
const elRestart = document.getElementById("restartBtn");
const elMode = document.getElementById("modeBtn");
const elWrongList = document.getElementById("wrongList");
const elCsvFile = document.getElementById("csvFile");

// footer のCSV表示
const elFooterCsv = document.querySelector("footer.foot span");

// ==============================
// モード
// ==============================
function setMode(m) {
  mode = m;
  document.body.classList.toggle("mode-class", mode === "class");
}

// ==============================
// ユーティリティ
// ==============================
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// CSVの簡易パーサ
function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // "" を " として扱う
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCSV(text) {
  if (!text) return [];
  // BOM除去
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  if (!lines.length) return [];

  const header = splitCSVLine(lines.shift()).map((h) => h.trim());
  const rows = [];

  for (const line of lines) {
    const cols = splitCSVLine(line);
    const obj = {};
    header.forEach((h, k) => (obj[h] = (cols[k] ?? "").trim()));
    rows.push(obj);
  }
  return rows;
}

function normalizeQuestions(rows) {
  return rows
    .map((r) => {
      const type = (r.type ?? "").trim().toLowerCase();

      const qText = (r.question ?? "").replace(/^"|"$/g, "").trim();

      const c1 = (r.choice1 ?? "").replace(/^"|"$/g, "").trim();
      const c2 = (r.choice2 ?? "").replace(/^"|"$/g, "").trim();
      const c3 = (r.choice3 ?? "").replace(/^"|"$/g, "").trim();
      const c4 = (r.choice4 ?? "").replace(/^"|"$/g, "").trim();

      const choices = [c1, c2, c3, c4].filter((x) => x.length > 0);
      const ans = Number(String(r.answer ?? "").trim());

      return {
        id: (r.id ?? "").trim(),
        type,
        question: qText,
        choices,
        answer: ans,
        explain: (r.explain ?? "").replace(/^"|"$/g, "").trim(),
      };
    })
    .filter((q) => {
      if (!q.question) return false;

      if (q.type === "tf") {
        // tfは〇×固定で answer=1 or 2
        return q.answer === 1 || q.answer === 2;
      }
      if (q.type === "mc" || q.type === "fill") {
        if (q.choices.length < 2) return false;
        return q.answer >= 1 && q.answer <= q.choices.length;
      }
      return false;
    });
}

function getChoices(q) {
  if (q.type === "tf") return ["〇", "×"];
  return q.choices;
}

// ==============================
// クイズ
// ==============================
function pickDailySet() {
  const shuffled = shuffle(questions);
  quiz = shuffled.slice(0, Math.min(DAILY_COUNT, shuffled.length));
  idx = 0;
  correctCount = 0;
  locked = false;
  wrongs = [];
  renderWrongList();
  render();

  // CSV読み込み後に有効化
  elRestart.disabled = false;
}

function render() {
  if (quiz.length === 0) {
    elQ.textContent = "問題がありません（CSVを確認してください）。";
    elChoices.innerHTML = "";
    elNext.disabled = true;
    return;
  }

  const q = quiz[idx];
  const choices = getChoices(q);

  elProgress.textContent = `${idx + 1} / ${quiz.length}`;
  elScore.textContent = `正解：${correctCount}`;
  elFeedback.textContent = "";
  elNext.disabled = true;
  locked = false;

  elQ.textContent = q.question;
  elChoices.innerHTML = "";

  choices.forEach((c, i) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.type = "button";
    btn.textContent = c;

    // クリックで採点
    btn.addEventListener("click", () => choose(i + 1));

    elChoices.appendChild(btn);
  });
}

function choose(selected) {
  if (locked) return;
  locked = true;

  const q = quiz[idx];
  const correct = q.answer;
  const choices = getChoices(q);

  const buttons = [...document.querySelectorAll(".choice")];
  const isCorrect = selected === correct;

  buttons.forEach((b, i) => {
    const n = i + 1;
    if (n === correct) b.classList.add("correct");
    if (n === selected && !isCorrect) b.classList.add("wrong");
    b.disabled = true;
  });

  if (isCorrect) {
    correctCount += 1;
    elFeedback.textContent = `正解。${q.explain ? q.explain : ""}`.trim();
  } else {
    elFeedback.textContent = `不正解。正解は「${choices[correct - 1] ?? ""}」。${
      q.explain ? q.explain : ""
    }`.trim();
    wrongs.push(q);
    renderWrongList();
  }

  elScore.textContent = `正解：${correctCount}`;
  elNext.disabled = false;
}

function renderWrongList() {
  if (wrongs.length === 0) {
    elWrongList.textContent = "まだありません。";
    return;
  }
  elWrongList.innerHTML = wrongs
    .map((w) => {
      const ans = getChoices(w)[w.answer - 1] ?? "";
      return `<div>・${escapeHTML(w.question)}（正解：${escapeHTML(ans)}）</div>`;
    })
    .join("");
}

function next() {
  if (idx < quiz.length - 1) {
    idx += 1;
    render();
  } else {
    finish();
  }
}

function finish() {
  elQ.textContent = `終了。${quiz.length}問中、${correctCount}問 正解。`;
  elChoices.innerHTML = "";

  // 間違い復習ボタン
  const reviewBtn = document.createElement("button");
  reviewBtn.className = "btn ghost";
  reviewBtn.type = "button";
  reviewBtn.textContent = "まちがいだけ復習";
  reviewBtn.addEventListener("click", () => {
    if (wrongs.length === 0) {
      elFeedback.textContent = "まちがいがありません。";
      return;
    }
    quiz = shuffle(wrongs);
    idx = 0;
    correctCount = 0;
    locked = false;
    wrongs = [];
    renderWrongList();
    render();
  });

  elChoices.appendChild(reviewBtn);

  elNext.disabled = true;
  elFeedback.textContent = "「最初から」でランダムにもう一度できます。";
}

// ==============================
// CSV 読み込み（共通）
// ==============================
function applyCSVText(text, labelForFooter) {
  questions = normalizeQuestions(parseCSV(text));

  if (elFooterCsv) elFooterCsv.textContent = `CSV: ${labelForFooter}`;

  if (!questions.length) {
    elQ.textContent = "CSVは読みましたが、有効な問題が0件です。";
    elFeedback.textContent =
      "列名（id,type,question,choice1,choice2,choice3,answer,explain）と、answerの数字を確認してください。";
    elChoices.innerHTML = "";
    elNext.disabled = true;
    elRestart.disabled = true;
    return false;
  }

  pickDailySet();
  return true;
}

// 自動で questions1.csv を読む
async function loadDefaultCSV() {
  try {
    const res = await fetch("questions1.csv", { cache: "no-store" });
    if (!res.ok) throw new Error(`questions1.csv の取得に失敗: ${res.status}`);

    const text = await res.text();
    applyCSVText(text, "questions1.csv");
  } catch (err) {
    // 自動読込が失敗したら、従来どおり手動選択を案内
    elQ.textContent = "自動でCSVを読み込めませんでした。";
    elFeedback.textContent =
      "「CSVをえらぶ」から読み込んでください。 " + String(err);
    elRestart.disabled = true;
    elNext.disabled = true;
  }
}

// ==============================
// イベント
// ==============================
elNext.addEventListener("click", next);

elRestart.addEventListener("click", () => {
  if (!questions.length) {
    elFeedback.textContent = "先にCSVをえらんでください。";
    return;
  }
  pickDailySet();
});

elMode.addEventListener("click", () =>
  setMode(mode === "phone" ? "class" : "phone")
);

// CSVファイル選択で読み込む（手動差し替え用：残す）
elCsvFile?.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    applyCSVText(text, file.name);
  } catch (err) {
    elQ.textContent = "CSVの読み込みに失敗しました。";
    elFeedback.textContent = String(err);
  }
});

// ==============================
// 初期表示
// ==============================
setMode("phone");
elRestart.disabled = true;
elQ.textContent = "読み込み中…";
elChoices.innerHTML = "";
elNext.disabled = true;
renderWrongList();

// ★追加：最初に questions1.csv を自動読み込み
loadDefaultCSV();
