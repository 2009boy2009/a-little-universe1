const ACCESS_PASSWORD = "Muskan";
const $ = id => document.getElementById(id);
let notes = {};

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}

function makeStars(holderId, count, className) {
  const holder = $(holderId);
  if (!holder || holder.childElementCount) return;
  for (let i = 0; i < count; i++) {
    const star = document.createElement("i");
    star.className = className + (Math.random() > .91 ? " bright" : "");
    star.style.left = Math.random() * 100 + "%";
    star.style.top = Math.random() * 100 + "%";
    star.style.animationDelay = Math.random() * 5 + "s";
    holder.appendChild(star);
  }
}

async function loadMessages() {
  const response = await fetch("messages.json");
  if (!response.ok) throw new Error("Messages file could not be loaded.");
  const data = await response.json();
  notes = data.messages || {};
  renderNotes();
  showTodayMessage();
}

function showTodayMessage() {
  const today = getTodayKey();
  const note = notes[today];
  $("todayDate").textContent = new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
  $("todayMessage").textContent = "";
  $("todayMessage").classList.add("hidden");

  if (!note) {
    $("todayTitle").textContent = "A little note for today";
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
  const entries = Object.entries(notes).filter(([date]) => date < today).sort(([a],[b]) => b.localeCompare(a));
  $("archiveCount").textContent = `${entries.length} ${entries.length === 1 ? "note" : "notes"}`;

  entries.forEach(([date,note]) => {
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
    card.append(decor,dateEl,title,arrow);
    card.addEventListener("click", () => openNote(note));
    grid.appendChild(card);
  });
}

function openNote(note) {
  $("modalDate").textContent = note.dateLabel;
  $("modalTitle").textContent = note.title;
  $("modalMessage").textContent = note.message;
  setMusicButton($("modalMusic"), note.music);
  $("modalMusic").onclick = () => playMusic(note.music, $("modalMusic"));
  $("noteModal").classList.remove("hidden");
}

function stopMusic() {
  const audio = $("audioPlayer");
  audio.pause();
  audio.currentTime = 0;
  document.querySelectorAll(".music-button").forEach(button => {
    button.classList.remove("playing");
    button.textContent = "♫";
  });
}

function closeNote() {
  stopMusic();
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
  if (audio.src !== new URL(path, location.href).href) {
    audio.pause();
    audio.src = path;
  }
  if (audio.paused) {
    try {
      await audio.play();
      document.querySelectorAll(".music-button").forEach(b => {
        b.classList.remove("playing");
        b.textContent = "♫";
      });
      button.classList.add("playing");
      button.textContent = "Ⅱ";
    } catch (error) {
      alert("Please check the MP3 file and its path.");
    }
  } else {
    audio.pause();
    button.classList.remove("playing");
    button.textContent = "♫";
  }
}

$("audioPlayer").addEventListener("ended", stopMusic);

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  if ($("passwordInput").value !== ACCESS_PASSWORD) {
    $("loginError").textContent = "That isn't the little secret. Try again ✧";
    return;
  }
  $("loginError").textContent = "";
  document.body.classList.add("entering");
  makeStars("universeStars", 105, "universe-star");
  window.setTimeout(async () => {
    $("loginScreen").classList.add("hidden");
    $("universeScreen").classList.remove("hidden");
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

makeStars("entranceStars", 70, "entrance-star");
    
