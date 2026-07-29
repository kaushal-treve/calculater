/* =========================================================================
   CALCULATOR — APPLICATION LOGIC
   All state lives in a single `state` object. Every user action (click or
   keypress) funnels through a small set of pure-ish functions that mutate
   state and then call updateDisplay() to sync the DOM. No logic is
   duplicated between the mouse and keyboard input paths.
   ========================================================================= */

(() => {
  "use strict";

  /* DOM REFERENCES */
  const expressionEl = document.getElementById("expression");
  const resultEl = document.getElementById("result");
  const consoleEl = document.getElementById("console");
  const historyPanel = document.getElementById("historyPanel");
  const historyList = document.getElementById("historyList");
  const historyToggleBtn = document.getElementById("historyToggle");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const copyBtn = document.getElementById("copyBtn");
  const copyLabel = document.getElementById("copyLabel");
  const memoryIndicator = document.getElementById("memoryIndicator");
  const themeToggleBtn = document.getElementById("themeToggle");
  const soundToggleBtn = document.getElementById("soundToggle");
  const srAnnouncer = document.getElementById("srAnnouncer");
  const keypad = document.querySelector(".keypad");
  const memoryRow = document.querySelector(".memory-row");

  /*  APPLICATION STATE */
  const state = {
    currentOperand: "0", // the number currently being typed / displayed
    previousOperand: null, // the operand captured before an operator was chosen
    operator: null, // "+", "−", "×", "÷"
    overwrite: true, // true => next digit press should replace currentOperand
    isError: false, // true while an error message is being shown
    memory: 0, // memory register value
    soundOn: true, // sound effects toggle
  };

  const MAX_DIGITS = 15; // guard against runaway display length

  /* AUDIO — a tiny synthesized "click" using the Web Audio API so no
     external sound assets are required.*/
  let audioCtx = null;

  function playSound(kind) {
    if (!state.soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      const freq = kind === "equals" ? 660 : kind === "error" ? 160 : 420;
      osc.type = kind === "error" ? "sawtooth" : "sine";
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.09);

      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch (err) {
      // Web Audio unavailable — fail silently, sound is a non-essential enhancement
    }
  }

  /* NUMBER FORMATTING */

  // Adds thousands separators to the integer part while typing, without
  // disturbing an in-progress decimal.
  function formatOperand(operand) {
    if (operand == null) return "";
    if (operand === "Error") return operand;

    // Very large/small results stringify in exponential notation (e.g.
    // "1e+21") — pass those through untouched rather than trying to
    // thousands-separate them.
    if (/e/i.test(operand)) return operand;

    const isNegative = operand.startsWith("-");
    const unsigned = isNegative ? operand.slice(1) : operand;
    const [intPart, decimalPart] = unsigned.split(".");

    let formattedInt = intPart;
    if (intPart !== "") {
      formattedInt = new Intl.NumberFormat("en-US").format(BigInt(intPart || "0"));
    }

    let out = formattedInt;
    if (decimalPart !== undefined) out += "." + decimalPart;
    if (isNegative) out = "-" + out;
    return out;
  }

  function operatorSymbolForExpression(op) {
    return op; // symbols are already display-ready (÷ × − +)
  }

  /* CORE INPUT HANDLERS */

  // Append a digit (0-9) to the current operand.
  function appendNumber(digit) {
    if (state.isError) clearAll();

    if (state.overwrite) {
      state.currentOperand = digit === "0" ? "0" : digit;
      state.overwrite = false;
      return updateDisplay();
    }

    // Prevent leading zeros like "007" while still allowing "0.5"
    if (state.currentOperand === "0") {
      state.currentOperand = digit;
    } else if (state.currentOperand.replace("-", "").replace(".", "").length < MAX_DIGITS) {
      state.currentOperand += digit;
    }
    updateDisplay();
  }

  // Insert a decimal point, guarding against duplicates.
  function appendDecimal() {
    if (state.isError) clearAll();

    if (state.overwrite) {
      state.currentOperand = "0.";
      state.overwrite = false;
      return updateDisplay();
    }
    if (!state.currentOperand.includes(".")) {
      state.currentOperand += ".";
    }
    updateDisplay();
  }

  // Choose (or switch) the pending operator.
  function appendOperator(nextOperator) {
    if (state.isError) clearAll();

    // Consecutive operator presses simply swap the pending operator
    // instead of producing an error — this matches how most calculators
    // handle "12 + × 3".
    if (state.operator && state.overwrite) {
      state.operator = nextOperator;
      return updateDisplay();
    }

    if (state.previousOperand !== null) {
      // A previous calculation is already pending — chain it.
      calculate({ silent: true });
    }

    state.previousOperand = state.currentOperand;
    state.operator = nextOperator;
    state.overwrite = true;
    updateDisplay();
  }

  // Evaluate previousOperand [operator] currentOperand.
  function calculate({ silent = false } = {}) {
    if (state.operator === null || state.overwrite) {
      return; // nothing pending — Enter/"=" with no operator is a no-op
    }

    const prev = parseFloat(state.previousOperand);
    const curr = parseFloat(state.currentOperand);

    if (Number.isNaN(prev) || Number.isNaN(curr)) {
      return showError("Invalid expression");
    }

    let result;
    switch (state.operator) {
      case "+":
        result = prev + curr;
        break;
      case "−":
        result = prev - curr;
        break;
      case "×":
        result = prev * curr;
        break;
      case "÷":
        if (curr === 0) {
          return showError("Cannot divide by zero");
        }
        result = prev / curr;
        break;
      default:
        return showError("Invalid operator");
    }

    // Guard against floating point artifacts (0.1 + 0.2 etc.)
    result = Math.round((result + Number.EPSILON) * 1e12) / 1e12;

    if (!Number.isFinite(result)) {
      return showError("Result is too large");
    }

    const expressionText = `${formatOperand(state.previousOperand)} ${state.operator} ${formatOperand(
      state.currentOperand
    )}`;

    if (!silent) {
      addToHistory(expressionText, formatOperand(String(result)));
      playSound("equals");
    }

    // Fold the result back into currentOperand and clear the pending
    // operator/previousOperand — this is correct for both a final "="
    // press and a silent chain (e.g. "5 + 3 −" reusing the running total).
    state.currentOperand = String(result);
    state.previousOperand = null;
    state.operator = null;
    state.overwrite = true;

    updateDisplay();
  }

  // AC — reset everything back to the initial state.
  function clearAll() {
    state.currentOperand = "0";
    state.previousOperand = null;
    state.operator = null;
    state.overwrite = true;
    state.isError = false;
    updateDisplay();
  }

  // Backspace — remove the last character of the current operand.
  function deleteLast() {
    if (state.isError) return clearAll();
    if (state.overwrite) return; // nothing to delete from a fresh operand

    state.currentOperand = state.currentOperand.slice(0, -1);
    if (state.currentOperand === "" || state.currentOperand === "-") {
      state.currentOperand = "0";
      state.overwrite = true;
    }
    updateDisplay();
  }

  // +/- — flip the sign of the current operand.
  function toggleSign() {
    if (state.isError) return clearAll();
    if (state.currentOperand === "0") return;

    state.currentOperand = state.currentOperand.startsWith("-")
      ? state.currentOperand.slice(1)
      : "-" + state.currentOperand;
    updateDisplay();
  }

  // % — behaves like a typical consumer calculator:
  //   • with a pending operator, treats the current value as a percentage
  //     of the previous operand (e.g. 200 + 10% = 200 + 20)
  //   • standalone, simply divides the current value by 100
  function percent() {
    if (state.isError) return clearAll();

    const curr = parseFloat(state.currentOperand);
    if (Number.isNaN(curr)) return;

    let result;
    if (state.operator && state.previousOperand !== null) {
      const prev = parseFloat(state.previousOperand);
      result = (prev * curr) / 100;
    } else {
      result = curr / 100;
    }

    state.currentOperand = String(Math.round((result + Number.EPSILON) * 1e12) / 1e12);
    state.overwrite = false;
    updateDisplay();
  }

  function showError(message) {
    state.isError = true;
    state.currentOperand = "Error";
    state.previousOperand = null;
    state.operator = null;
    state.overwrite = true;
    updateDisplay(message);
    playSound("error");
  }

  /* DISPLAY SYNC */
  function updateDisplay(errorMessage) {
    // Expression line: shows "previous operator" while an operator pending
    if (state.operator && state.previousOperand !== null) {
      expressionEl.textContent = `${formatOperand(state.previousOperand)} ${operatorSymbolForExpression(
        state.operator
      )}`;
    } else {
      expressionEl.textContent = "\u00A0";
    }

    if (state.isError) {
      resultEl.textContent = errorMessage || "Error";
      resultEl.classList.add("is-error");
      srAnnouncer.textContent = errorMessage || "Error";
    } else {
      resultEl.textContent = formatOperand(state.currentOperand);
      resultEl.classList.remove("is-error");
    }

    memoryIndicator.hidden = state.memory === 0;
  }

  /* MEMORY REGISTER */
  function handleMemory(action) {
    if (state.isError) clearAll();
    const curr = parseFloat(state.currentOperand) || 0;

    switch (action) {
      case "mc":
        state.memory = 0;
        break;
      case "mr":
        state.currentOperand = String(state.memory);
        state.overwrite = false;
        break;
      case "m+":
        state.memory = Math.round((state.memory + curr + Number.EPSILON) * 1e12) / 1e12;
        break;
      case "m-":
        state.memory = Math.round((state.memory - curr + Number.EPSILON) * 1e12) / 1e12;
        break;
    }
    updateDisplay();
  }

  /* HISTORY PANEL */
  function addToHistory(expressionText, resultText) {
    const emptyMarker = historyList.querySelector("[data-empty]");
    if (emptyMarker) emptyMarker.remove();

    const li = document.createElement("li");
    li.tabIndex = 0;
    li.innerHTML = `<span class="history-expr">${expressionText}</span><span class="history-val">${resultText}</span>`;
    li.addEventListener("click", () => {
      state.currentOperand = resultText.replace(/,/g, "");
      state.overwrite = false;
      state.isError = false;
      updateDisplay();
    });
    historyList.prepend(li);
  }

  function clearHistory() {
    historyList.innerHTML = '<li class="history-empty" data-empty>No calculations yet</li>';
  }

  function toggleHistoryPanel(forceState) {
    const willOpen = forceState !== undefined ? forceState : !consoleEl.classList.contains("history-open");
    consoleEl.classList.toggle("history-open", willOpen);
    historyPanel.setAttribute("aria-hidden", String(!willOpen));
    historyToggleBtn.setAttribute("aria-expanded", String(willOpen));
  }

  /* COPY RESULT */
  async function copyResult() {
    const value = state.isError ? "" : formatOperand(state.currentOperand);
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      copyLabel.textContent = "Copied";
      copyBtn.classList.add("copied");
      srAnnouncer.textContent = "Result copied to clipboard";
      setTimeout(() => {
        copyLabel.textContent = "Copy";
        copyBtn.classList.remove("copied");
      }, 1400);
    } catch (err) {
      srAnnouncer.textContent = "Could not copy result";
    }
  }

  /* THEME — persisted to localStorage, respects system preference on
     first visit. */
  const THEME_KEY = "calculator:theme";
  const SOUND_KEY = "calculator:sound";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeToggleBtn.setAttribute("aria-pressed", String(theme === "light"));
    localStorage.setItem(THEME_KEY, theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) {
      applyTheme(saved);
      return;
    }
    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    applyTheme(prefersLight ? "light" : "dark");
  }

  function initSound() {
    const saved = localStorage.getItem(SOUND_KEY);
    state.soundOn = saved === null ? true : saved === "on";
    soundToggleBtn.setAttribute("aria-pressed", String(state.soundOn));
  }

  function toggleSound() {
    state.soundOn = !state.soundOn;
    soundToggleBtn.setAttribute("aria-pressed", String(state.soundOn));
    localStorage.setItem(SOUND_KEY, state.soundOn ? "on" : "off");
    if (state.soundOn) playSound("tap");
  }

  /* RIPPLE / PRESS FEEDBACK */
  function spawnRipple(button, clientX, clientY) {
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement("span");
    const size = Math.max(rect.width, rect.height);
    const x = (clientX ?? rect.left + rect.width / 2) - rect.left - size / 2;
    const y = (clientY ?? rect.top + rect.height / 2) - rect.top - size / 2;

    ripple.className = "ripple";
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    button.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  }

  function pressFeedback(button) {
    button.classList.add("is-pressed");
    setTimeout(() => button.classList.remove("is-pressed"), 140);
  }

  /* ACTION ROUTER — a single place that maps a "command" to its handler.
     Used by both the click and keyboard input paths so logic is never
     duplicated. */
  function runAction(action, payload) {
    switch (action) {
      case "number":
        appendNumber(payload);
        break;
      case "decimal":
        appendDecimal();
        break;
      case "operator":
        appendOperator(payload);
        break;
      case "equals":
        calculate();
        break;
      case "clear":
        clearAll();
        break;
      case "delete":
        deleteLast();
        break;
      case "sign":
        toggleSign();
        break;
      case "percent":
        percent();
        break;
      default:
        return;
    }
    if (action !== "equals") playSound("tap");
  }

  /* EVENT WIRING — KEYPAD (mouse / touch / pointer) */
  keypad.addEventListener("click", (event) => {
    const button = event.target.closest(".key");
    if (!button) return;

    spawnRipple(button, event.clientX, event.clientY);
    pressFeedback(button);

    if (button.dataset.number !== undefined) {
      runAction("number", button.dataset.number);
    } else if (button.dataset.operator !== undefined) {
      runAction("operator", button.dataset.operator);
    } else if (button.dataset.action !== undefined) {
      runAction(button.dataset.action);
    }
  });

  memoryRow.addEventListener("click", (event) => {
    const button = event.target.closest(".mem-btn");
    if (!button) return;
    pressFeedback(button);
    handleMemory(button.dataset.memory);
    playSound("tap");
  });

  historyToggleBtn.addEventListener("click", () => toggleHistoryPanel());
  clearHistoryBtn.addEventListener("click", clearHistory);
  copyBtn.addEventListener("click", copyResult);
  themeToggleBtn.addEventListener("click", toggleTheme);
  soundToggleBtn.addEventListener("click", toggleSound);

  /* EVENT WIRING — KEYBOARD */
  const OPERATOR_KEY_MAP = {
    "+": "+",
    "-": "−",
    "*": "×",
    "/": "÷",
  };

  function handleKeyboardInput(event) {
    const { key } = event;

    if (key >= "0" && key <= "9") {
      event.preventDefault();
      runAction("number", key);
      flashKeyForKey(`[data-number="${key}"]`);
      return;
    }

    if (key === "." ) {
      event.preventDefault();
      runAction("decimal");
      flashKeyForKey('[data-action="decimal"]');
      return;
    }

    if (OPERATOR_KEY_MAP[key]) {
      event.preventDefault();
      runAction("operator", OPERATOR_KEY_MAP[key]);
      flashKeyForKey(`[data-operator="${OPERATOR_KEY_MAP[key]}"]`);
      return;
    }

    if (key === "%") {
      event.preventDefault();
      runAction("percent");
      flashKeyForKey('[data-action="percent"]');
      return;
    }

    if (key === "Enter" || key === "=") {
      event.preventDefault();
      calculate();
      flashKeyForKey('[data-action="equals"]');
      return;
    }

    if (key === "Backspace") {
      event.preventDefault();
      runAction("delete");
      flashKeyForKey('[data-action="delete"]');
      return;
    }

    if (key === "Delete" || key === "Escape") {
      event.preventDefault();
      runAction("clear");
      flashKeyForKey('[data-action="clear"]');
      return;
    }
  }

  // Briefly apply the pressed style to the on-screen key matching a
  // keyboard press, so keyboard and mouse input feel visually consistent.
  function flashKeyForKey(selector) {
    const button = keypad.querySelector(selector);
    if (!button) return;
    pressFeedback(button);
    spawnRipple(button);
  }

  document.addEventListener("keydown", handleKeyboardInput);

  /* INIT */
  initTheme();
  initSound();
  updateDisplay();
})();
