
const ACCESS_PASSWORD = "Muskan";

const $ = id => document.getElementById(id);

let notes = {};

/* DATE */
function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* WORLD ONE STARS */
function makeEntranceStars() {
  const holder = $("entranceStars");

  for (let i = 0; i < 110; i++) {
    const star = document.createElement("i");
    star.className = "entrance-star";

    if (Math.random() > 0.88) {
      star.classList.add("bright");
    }

    star.style.left = Math.random() * 100 + "%";
    star.style.top = Math.random() * 100 + "%";
    star.style.animationDelay = Math.random() * 5 + "s";

    holder.appendChild(star);
  }
}

/* WORLD TWO STARS */
function makeUniverseStars() {
  const holder = $("universeStars");

  for (let i = 230; i > 0; i--) {
    const star = document.createElement("i");
    star.className = "universe-star";

    const size = Math.random() > 0.9 ? 3 : Math.random() * 2 + 1;

    star.style.width = size + "px";
    star.style.height = size + "px";
    star.style.left = Math.random() * 100 + "%";
    star.style.top = Math.random() * 100 + "%";
    star.style.animationDelay = Math.random() * 5 + "s";
    star.style.animationDuration = (2 + Math.random() * 4) + "s";

    if (Math.random() > 0.9) {
      star.classList.add("bright");
    }

    holder.appendChild(star);
  }
}

/* FLOATING LIGHT PARTICLES */
function makeCosmicDust() {
  const holder = $("universeDust");

  for (let i = 0; i < 40; i++) {
    const particle = document.createElement("i");
    particle.className = "dust-particle";

    particle.style.left = Math.random() * 100 + "%";
    particle.style.top = (40 + Math.random() * 60) + "%";
    particle.style.animationDelay = Math.random() * 12 + "s";
    particle.style.animationDuration = (9 + Math.random() * 10) + "s";

    holder.appendChild(particle);
  }
}

/* LOAD ORIGINAL MESSAGES */
async function loadMessages() {
  const response = await fetch("messages.json");

  if (!response.ok) {
    throw new Error("Messages file could not be loaded.");
  }

  const data = await response.json();
  notes = data.messages || {};

  renderNotes();
  showTodayMessage();
}

/* TODAY'S MESSAGE */
function showTodayMessage() {
  const today = getTodayKey();
  const note = notes[today];

  $("todayDate").textContent = new Date().toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "long",
      year: "numeric"
    }
  );

  $("todayMessage").textContent = "";
  $("todayMessage").classList.add("hidden");

  if (!note) {
    $("todayTitle").textContent = "A little note for today";

    $("todayMessage").textContent =
      "No note for today yet. Perhaps a new little memory will bloom soon ✧";

    $("todayMessage").classList.remove("hidden");
    $("revealButton").classList.add("hidden");

    setMusicButton($("todayMusic"), "");
    $("todayMusic").onclick = null;

    return;
  }

  $("todayTitle").textContent = note.title;
  $("todayMessage").textContent = note.message;

  $("todayMessage").classList.add("hidden");
  $("revealButton").classList.remove("hidden");

  setMusicButton($("todayMusic"), note.music);

  $("revealButton").onclick = () => {
    $("todayMessage").classList.remove("hidden");
    $("revealButton").classList.add("hidden");
  };

  $("todayMusic").onclick = () =>
    playMusic(note.music, $("todayMusic"));
}

/* PREVIOUS NOTES */
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
      decor.textContent = "✧  ✦  ✧";

      const dateEl = document.createElement("span");
      dateEl.className = "date";
      dateEl.textContent = note.dateLabel;

      const title = document.createElement("strong");
      title.textContent = note.title;

      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = "⌄";

      card.append(decor, dateEl, title, arrow);

      card.onclick = () => openNote(date, note);

      grid.appendChild(card);
    });
}

/* OPEN OLD MESSAGE */
function openNote(date, note) {
  $("modalDate").textContent = note.dateLabel;
  $("modalTitle").textContent = note.title;
  $("modalMessage").textContent = note.message;

  setMusicButton($("modalMusic"), note.music);

  $("modalMusic").onclick = () =>
    playMusic(note.music, $("modalMusic"));

  $("noteModal").classList.remove("hidden");
}

function closeNote() {
  $("noteModal").classList.add("hidden");
}

/* MUSIC */
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

$("audioPlayer").addEventListener("ended", () => {
  document.querySelectorAll(".music-button").forEach(button => {
    button.classList.remove("playing");
    button.textContent = "♫";
  });
});

/* ENTER THE HEAVENLY WORLD */
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  if ($("passwordInput").value !== ACCESS_PASSWORD) {
    $("loginError").textContent =
      "That isn't the little secret. Try again ✧";
    return;
  }

  $("loginError").textContent = "";

  document.body.classList.add("entering");

  makeUniverseStars();
  makeCosmicDust();

  setTimeout(async () => {
    $("loginScreen").classList.add("hidden");
    $("universeScreen").classList.remove("hidden");

    document.body.classList.add("universe-active");

    try {
      await loadMessages();
    } catch (error) {
      alert("Could not load messages.json. Check that it is beside index.html.");
      console.error(error);
    }
  }, 1100);
});

/* CLOSE MEMORY */
$("closeModal").onclick = closeNote;
$("modalBackdrop").onclick = closeNote;

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeNote();
  }
});

/* START THE FIRST WORLD */
makeEntranceStars();
