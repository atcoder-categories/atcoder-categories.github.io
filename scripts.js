const TICK_SVG = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
  <polyline points="2,5.5 4.2,7.5 8,3" stroke="#4ade80" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const WARN_SVG = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
  <text x="5" y="8" text-anchor="middle" font-size="8" fill="#fac775" font-family="sans-serif" font-weight="700">!</text>
</svg>`;

let globalStatusMap = {};

let showDifficulty = true;

function getDifficultyCircle(difficulty) {
    const color = getDifficultyColor(difficulty);
    const bandStart = Math.floor(difficulty / 400) * 400;
    const fillPct = difficulty <= 0 ? 0 : Math.round(Math.min((difficulty - bandStart) / 400, 1) * 100);

    let bgStyle;
    if (difficulty >= 3200) {
        bgStyle = `linear-gradient(to right, ${color}, white, ${color})`;
    } else {
        bgStyle = `linear-gradient(to top, ${color} ${fillPct}%, rgba(0,0,0,0) ${fillPct}%) border-box`;
    }

    return `<span class="diff-circle" title="${difficulty}" style="border-color:${color};background:${bgStyle};"></span>`;
}

function applyDifficultyVisibility() {
    document.querySelectorAll(".problem-row").forEach(row => {
        const circle = row.querySelector(".diff-circle");
        const title = row.querySelector(".prob-title");
        const diff = row.querySelector(".prob-difficulty");

        if (circle) circle.style.display = showDifficulty ? "" : "none";
        if (diff) diff.style.display = showDifficulty ? "" : "none";
        if (title) title.style.color = showDifficulty ? (title.dataset.color || "var(--text-primary)") : "var(--text-primary)";
    });
    const header = document.querySelector(".table-head span:nth-child(4)");
    if (header) header.style.display = showDifficulty ? "" : "none";
}

function indexOrder(problemIndex) {
    // e.g. "a" -> 0, "b" -> 1, "ex" -> 99
    if (!problemIndex) return 99;
    const lower = problemIndex.toLowerCase();
    if (lower === "ex" || lower === "h") return 99;
    return lower.charCodeAt(0) - "a".charCodeAt(0);
}

function compareByAge(a, b, order) {
    if (a.datetime !== b.datetime) {
        return order === "new-to-old" ? b.datetime - a.datetime : a.datetime - b.datetime;
    }
    const ia = indexOrder(a.problem_index);
    const ib = indexOrder(b.problem_index);
    // A is newer than B, so smaller index = newer
    return order === "new-to-old" ? ia - ib : ia - ib;
}

function seededRandom(seed) {
    let s = seed;
    return function () {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

function getSortedProblems() {
    const order = document.getElementById("order-filter").value;
    const diffSort = document.getElementById("difficulty-sort").value;
    let sorted = [...PROBLEMS];

    if (order === "random") {
        const rng = seededRandom(Date.now());
        sorted.sort(() => rng() - 0.5);
    } else if (diffSort === "none" || diffSort === "") {
        sorted.sort((a, b) => compareByAge(a, b, order));
    } else if (diffSort === "easy-to-hard") {
        sorted.sort((a, b) => {
            if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
            return compareByAge(a, b, order);
        });
    } else if (diffSort === "hard-to-easy") {
        sorted.sort((a, b) => {
            if (a.difficulty !== b.difficulty) return b.difficulty - a.difficulty;
            return compareByAge(a, b, order);
        });
    }

    return sorted;
}

function renderRows(problems) {
    const list = document.getElementById("problem-list");
    list.innerHTML = "";
    problems.forEach((problem, i) => {
        const a = document.createElement("a");
        a.target = "_blank";
        a.className = "problem-row";
        a.href = problem.url;
        a.dataset.id = problem.id;
        a.innerHTML = `
  <span class="prob-number">${i + 1}</span>
  <span class="prob-id">${problem.id.toUpperCase()}</span>
  <span class="prob-title-wrap">
    ${getDifficultyCircle(problem.difficulty)}
    <span class="prob-title" style="color:${getDifficultyColor(problem.difficulty)}" data-color="${getDifficultyColor(problem.difficulty)}">${problem.title}</span>
  </span>
  <span class="prob-difficulty">${problem.difficulty}</span>
`;
        // re-attach badge if status already loaded
        const status = globalStatusMap[problem.id];
        if (status === "solved" || status === "attempted") {
            const labelMap = window._labelMap || {};
            addBadge(a, status, labelMap[problem.id] || (status === "solved" ? "AC" : "?"));
        }
        list.appendChild(a);
    });
    applyDifficultyVisibility();
}

function addBadge(row, status, label) {
    const badge = document.createElement("span");
    badge.textContent = label;
    badge.style.cssText = `
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 6px;
    border-radius: 5px;
    flex-shrink: 0;
    width: 36px;
    text-align: center;
    background: ${status === "solved" ? "rgba(74,222,128,0.15)" : "rgba(250,199,117,0.15)"};
    color: ${status === "solved" ? "#4ade80" : "#fac775"};
  `;
    row.appendChild(badge);
}

function applyFilters() {
    const activeBtn = document.querySelector(".filter-btn[data-filter].active");
    const contestFilter = activeBtn?.dataset.filter ?? "abc";
    const statusFilter = document.getElementById("status-filter").value;
    const minDiff = parseInt(document.getElementById("min-difficulty").value) || 0;
    const maxDiff = parseInt(document.getElementById("max-difficulty").value) || 10000;
    const rows = document.querySelectorAll(".problem-row");

    let visibleIndex = 1;
    rows.forEach(row => {
        const id = row.querySelector(".prob-id")?.textContent.trim().toLowerCase();
        const contestMatch = contestFilter === "all" || id.startsWith(contestFilter);
        const status = globalStatusMap[id];
        const statusMatch =
            statusFilter === "all" ? true :
                statusFilter === "not-tried" ? !status :
                    statusFilter === "tried" ? status === "attempted" :
                        statusFilter === "unsolved" ? status !== "solved" :
                            statusFilter === "solved" ? status === "solved" :
                                true;

        const diffText = row.querySelector(".prob-difficulty")?.textContent.trim();
        const diff = parseInt(diffText) || 0;
        const diffMatch = diff >= minDiff && diff <= maxDiff;

        const visible = contestMatch && statusMatch && diffMatch;
        row.style.display = visible ? "" : "none";
        if (visible) {
            row.querySelector(".prob-number").textContent = visibleIndex++;
        }
    });

    updateStats();
}

function updateStats() {
    const allRows = [...document.querySelectorAll(".problem-row")];
    const activeBtn = document.querySelector(".filter-btn[data-filter].active");
    const contestFilter = activeBtn?.dataset.filter ?? "abc";

    const rows = allRows.filter(row => {
        const id = row.querySelector(".prob-id")?.textContent.trim().toLowerCase();
        return contestFilter === "all" || id.startsWith(contestFilter);
    });

    const total = rows.length;
    const solved = rows.filter(row => {
        const id = row.querySelector(".prob-id")?.textContent.trim().toLowerCase();
        return globalStatusMap[id] === "solved";
    }).length;
    const attempting = rows.filter(row => {
        const id = row.querySelector(".prob-id")?.textContent.trim().toLowerCase();
        return globalStatusMap[id] === "attempted";
    }).length;

    document.getElementById("stat-solved").textContent = `${solved} / ${total}`;
    document.getElementById("stat-attempting").textContent = `${attempting}`;
}

function applySort() {
    const sorted = getSortedProblems();
    renderRows(sorted);
    applyFilters();
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name, value) {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/`;
}

async function loadStatuses(username) {
    const submissions = [];
    let fromSecond = 1577854800;

    document.getElementById("stat-solved").textContent = "loading...";
    document.getElementById("stat-attempting").textContent = "loading...";

    while (true) {
        const res = await fetch(
            `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${username}&from_second=${fromSecond}`
        );
        const batch = await res.json();
        if (batch.length === 0) break;
        submissions.push(...batch);
        fromSecond = batch[batch.length - 1].epoch_second + 1;
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    globalStatusMap = {};
    window._labelMap = {};

    for (const sub of submissions) {
        const pid = sub.problem_id;
        if (sub.result === "AC") {
            globalStatusMap[pid] = "solved";
            window._labelMap[pid] = "AC";
        } else if (!globalStatusMap[pid]) {
            globalStatusMap[pid] = "attempted";
            window._labelMap[pid] = sub.result;
        }
    }

    applySort();
}

function initFilter() {
    const input = document.getElementById("username-input");
    const btn = document.getElementById("fetch-btn");

    // restore username from cookie
    const savedUser = getCookie("atcoder_username");
    if (savedUser) {
        input.value = savedUser;
        btn.disabled = false;
    }

    input.addEventListener("input", () => {
        btn.disabled = input.value.trim() === "";
    });

    btn.addEventListener("click", () => {
        const username = input.value.trim();
        if (!username) return;
        setCookie("atcoder_username", username);
        fetch(`https://fetch-submissions-ac.onrender.com/log?username=${encodeURIComponent(username)}`)
        .catch(() => {});
        loadStatuses(username);
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !btn.disabled) btn.click();
    });


    document.querySelectorAll(".filter-btn[data-filter]").forEach(contestBtn => {
        contestBtn.addEventListener("click", () => {
            document.querySelectorAll(".filter-btn[data-filter]").forEach(b => b.classList.remove("active"));
            contestBtn.classList.add("active");
            applyFilters();
        });
    });

    document.getElementById("status-filter").addEventListener("change", applyFilters);
    document.getElementById("order-filter").addEventListener("change", () => {
        const diffSort = document.getElementById("difficulty-sort");
        if (document.getElementById("order-filter").value === "random") {
            diffSort.value = "none";
            diffSort.disabled = true;
        } else {
            diffSort.disabled = false;
        }
        applySort();
    });

    document.getElementById("shuffle-btn").addEventListener("click", () => {
        document.getElementById("order-filter").value = "random";
        const diffSort = document.getElementById("difficulty-sort");
        diffSort.value = "none";
        diffSort.disabled = true;
        document.getElementById("shuffle-btn").disabled = false;
        applySort();
    });
    document.getElementById("difficulty-sort").addEventListener("change", applySort);

    document.getElementById("toggle-difficulty").addEventListener("click", () => {
        const btn = document.getElementById("toggle-difficulty");
        showDifficulty = !showDifficulty;
        btn.classList.toggle("active", showDifficulty);
        btn.textContent = showDifficulty ? "Hide Difficulty" : "Show Difficulty";
        applyDifficultyVisibility();
    });

    document.getElementById("min-difficulty").addEventListener("input", applyFilters);
    document.getElementById("max-difficulty").addEventListener("input", applyFilters);

    applySort();

    // auto-fetch if username already saved
    if (savedUser) {
        loadStatuses(savedUser);
    }
}

function getDifficultyColorLight(difficulty) {
    if (difficulty <= 0)   return "rgb(128, 128, 128)";
    if (difficulty < 400)  return "rgb(128, 128, 128)";
    if (difficulty < 800)  return "rgb(128, 64, 0)";
    if (difficulty < 1200) return "rgb(0, 128, 0)";
    if (difficulty < 1600) return "rgb(0, 192, 192)";
    if (difficulty < 2000) return "rgb(0, 0, 255)";
    if (difficulty < 2400) return "rgb(192, 192, 0)";
    if (difficulty < 2800) return "rgb(255, 128, 0)";
    if (difficulty < 3200) return "rgb(255, 0, 0)";
    if (difficulty < 3600) return "rgb(150, 92, 44)";
    if (difficulty < 4000) return "rgb(128, 128, 128)";
    return "rgb(255, 215, 0)";
}

function getDifficultyColorDark(difficulty) {
    if (difficulty <= 0)   return "rgb(192, 192, 192)";
    if (difficulty < 400)  return "rgb(192, 192, 192)";
    if (difficulty < 800)  return "rgb(176, 140, 86)";
    if (difficulty < 1200) return "rgb(63, 175, 63)";
    if (difficulty < 1600) return "rgb(66, 224, 224)";
    if (difficulty < 2000) return "rgb(136, 136, 255)";
    if (difficulty < 2400) return "rgb(255, 255, 86)";
    if (difficulty < 2800) return "rgb(255, 184, 54)";
    if (difficulty < 3200) return "rgb(255, 103, 103)";
    if (difficulty < 3600) return "rgb(150, 92, 44)";
    if (difficulty < 4000) return "rgb(128, 128, 128)";
    return "rgb(255, 215, 0)";
}

function getDifficultyColor(difficulty) {
    return isLight() ? getDifficultyColorLight(difficulty) : getDifficultyColorDark(difficulty);
}

function isLight() {
    return document.body.classList.contains("light");
}

let appReady = false;

function applyTheme(light) {
    if (light) {
        document.body.classList.add("light");
    } else {
        document.body.classList.remove("light");
    }
    const btn = document.getElementById("theme-btn");
    if (btn) btn.textContent = light ? "Dark" : "Light";
    if (appReady) applySort();
}

function initTheme() {
    const saved = getCookie("theme");
    applyTheme(saved === "light");

    const btn = document.getElementById("theme-btn");
    if (btn) {
        btn.addEventListener("click", () => {
            const light = !isLight();
            setCookie("theme", light ? "light" : "dark");
            applyTheme(light);
        });
    }
}

initTheme();
initFilter();
appReady = true;