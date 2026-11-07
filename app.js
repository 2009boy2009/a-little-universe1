const ACCESS_PASSWORD = "Muskan";
const $ = id => document.getElementById(id);
let notes = {};
let activeMusicButton = null;

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/* Small, fixed star counts: twinkle uses opacity/transform only. */
function makeStars(holderId, count, className) {
  const holder = $(holderId);
  if (!holder || holder.childElementCount) return;
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const star = document.createElement("i");
    star.className = className + (Math.random() > 0.91 ? " bright" : "");
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.setProperty("--twinkle", `${4 + Math.random() * 5}s`);
    star.style.animationDelay = `${Math.random() * 6}s`;
    fragment.appendChild(star);
  }
  holder.appendChild(fragment);
}

function makeDust() {
  const holder = $("universeDust");
  if (!holder || holder.childElementCount) return;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 14; i++) {
    const particle = document.createElement("i");
    particle.className = "dust-particle";
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${48 + Math.random() * 48}%`;
    particle.style.animationDelay = `${Math.random() * 18}s`;
    particle.style.animationDuration = `${17 + Math.random() * 9}s`;
    fragment.appendChild(particle);
  }
  holder.appendChild(fragment);
}

async function loadMessages() {
  const response = await fetch("messages.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("Messages file could not be loaded.");
  const data = await response.json();
  notes = data.messages || {};
  renderNotes();
  showTodayMessage();
}

function showTodayMessage() {
  const today = getTodayKey();
  const note = notes[today];

  $("todayDate").textContent = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric"
  });
  $("todayMessage").textContent = "";
  $("todayMessage").classList.add("hidden");

  if (!note) {
    $("todayTitle").textContent = "One small moment";
    $("todayMessage").textContent = "No note for today yet. Perhaps a new little memory will bloom soon ✧";
    $("todayMessage").classList.remove("hidden");
    $("revealButton").classList.add("hidden");
    setMusicButton($("todayMusic"), "");
    $("todayMusic").onclick = null;
    return;
  }

  $("todayTitle").textContent = note.title;
  $("todayMessage").textContent = note.message;
  $("revealButton").classList.remove("hidden");
  setMusicButton($("todayMusic"), note.music);

  $("revealButton").onclick = () => {
    $("todayMessage").classList.remove("hidden");
    $("revealButton").classList.add("hidden");
  };
  $("todayMusic").onclick = () => playMusic(note.music, $("todayMusic"));
}

function renderNotes() {
  const grid = $("archiveGrid");
  grid.innerHTML = "";
  const today = getTodayKey();

  Object.entries(notes)
    .filter(([date]) => date < today)
    .sort(([a], [b]) => b.localeCompare(a))
    .forEach(([date, note]) => {
      const card = document.createElement("button");
      card.className = "archive-card";
      card.type = "button";

      const decor = document.createElement("span");
      decor.className = "decor";
      decor.textContent = "⟶ ✧ ⟵";

      const dateEl = document.createElement("span");
      dateEl.className = "date";
      dateEl.textContent = note.dateLabel;

      const title = document.createElement("strong");
      title.textContent = note.title;

      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = "⌄";

      card.append(decor, dateEl, title, arrow);
      card.addEventListener("click", () => openNote(date, note));
      grid.appendChild(card);
    });
}

function openNote(date, note) {
  $("modalDate").textContent = note.dateLabel;
  $("modalTitle").textContent = note.title;
  $("modalMessage").textContent = note.message;
  setMusicButton($("modalMusic"), note.music);
  $("modalMusic").onclick = () => playMusic(note.music, $("modalMusic"));
  $("noteModal").classList.remove("hidden");
}

function resetMusicButtons() {
  document.querySelectorAll(".music-button").forEach(button => {
    button.classList.remove("playing");
    button.textContent = "♫";
  });
}

function stopArchiveMusicOnClose() {
  if (activeMusicButton === $("modalMusic")) {
    const audio = $("audioPlayer");
    audio.pause();
    audio.currentTime = 0;
    activeMusicButton = null;
    resetMusicButtons();
  }
}

function closeNote() {
  stopArchiveMusicOnClose();
  $("noteModal").classList.add("hidden");
}

function setMusicButton(button, path) {
  button.disabled = !path;
  button.title = path ? "Play music" : "Music will be added later";
  button.classList.remove("playing");
  button.textContent = "♫";
}

async function playMusic(path, button) {
  if (!path) return;
  const audio = $("audioPlayer");
  const absolutePath = new URL(path, location.href).href;

  if (audio.src !== absolutePath) {
    audio.pause();
    audio.src = path;
    activeMusicButton = null;
    resetMusicButtons();
  }

  if (audio.paused) {
    try {
      await audio.play();
      resetMusicButtons();
      button.classList.add("playing");
      button.textContent = "Ⅱ";
      activeMusicButton = button;
    } catch (error) {
      alert("Please check the MP3 file and its path.");
    }
  } else if (activeMusicButton === button) {
    audio.pause();
    button.classList.remove("playing");
    button.textContent = "♫";
    activeMusicButton = null;
  } else {
    /* A different music button was pressed while audio was already playing. */
    audio.pause();
    audio.currentTime = 0;
    audio.src = path;
    try {
      await audio.play();
      resetMusicButtons();
      button.classList.add("playing");
      button.textContent = "Ⅱ";
      activeMusicButton = button;
    } catch (error) {
      alert("Please check the MP3 file and its path.");
    }
  }
}

$("audioPlayer").addEventListener("ended", () => {
  activeMusicButton = null;
  resetMusicButtons();
});

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  if ($("passwordInput").value !== ACCESS_PASSWORD) {
    $("loginError").textContent = "That isn't the little secret. Try again ✧";
    return;
  }

  $("loginError").textContent = "";
  document.body.classList.add("entering");

  window.setTimeout(async () => {
    $("loginScreen").classList.add("hidden");
    $("universeScreen").classList.remove("hidden");
    window.__universeWorld = "heaven";
    document.dispatchEvent(new CustomEvent("universe:world", { detail: "heaven" }));
    makeStars("universeStars", 78, "universe-star");
    makeDust();

    try {
      await loadMessages();
    } catch (error) {
      alert("Could not load messages.json. Check that it is beside index.html.");
      console.error(error);
    }
  }, 650);
});

$("closeModal").addEventListener("click", closeNote);
$("modalBackdrop").addEventListener("click", closeNote);
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !$("noteModal").classList.contains("hidden")) closeNote();
});

makeStars("entranceStars", 54, "entrance-star");
