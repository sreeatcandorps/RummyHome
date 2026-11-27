(() => {
  const query = new URLSearchParams(location.search);
  const direction = query.get("direction") || "mahal";
  const mode = query.get("mode") || "light";
  const width = Number(query.get("w") || 412);
  const height = Number(query.get("h") || 915);
  const fontScale = Number(query.get("fs") || 1);
  const small = width <= 360 || fontScale > 1;

  const icon = (name, className = "") =>
    `<i class="mi ${className}" aria-hidden="true">${String.fromCodePoint(window.ICONS[name])}</i>`;

  const games = [
    {
      id: "P2",
      date: "Fri, Nov 27",
      time: "5:10 PM",
      type: "Pool",
      players: 6,
      scores: [["Sree", 32], ["Omar", 51], ["Priya", 74]],
    },
    {
      id: "S3",
      date: "Fri, Nov 27",
      time: "3:18 PM",
      type: "Points",
      players: 5,
      scores: [["Meena", 86], ["Sree", 92], ["Arjun", 114]],
    },
    {
      id: "S2",
      date: "Fri, Nov 27",
      time: "1:48 PM",
      type: "Points",
      players: 4,
      scores: [["Lakshmi", 40], ["Harish", 58], ["Sree", 67]],
    },
  ];

  const gameCard = (game) => {
    const score = game.scores
      .map(([name, value]) => `<strong>${name}</strong> ${value}`)
      .join(`<span class="score-dot">·</span>`);
    return `
      <article class="game-card">
        <div class="game-id">${game.id}</div>
        <div class="game-top">
          <span class="game-title">${game.date}</span>
          <span class="game-time">${game.time}</span>
        </div>
        <div class="game-tags">
          <span class="tag active">${icon("circle-medium")}Active</span>
          <span class="tag creator">${icon("crown-outline")}Creator</span>
          <span class="game-kind">${game.type}</span>
        </div>
        <div class="score-line">${score}</div>
        <span class="players">${icon("account-multiple-outline")}${game.players}</span>
        <span class="chevron">${icon("chevron-right")}</span>
      </article>`;
  };

  document.getElementById("root").innerHTML = `
    <div class="phone ${direction} ${mode} ${small ? "small" : ""}"
         style="--w:${width}px;--h:${height}px;--fs:${fontScale}">
      <header class="status" aria-label="Phone status">
        <span>6:42</span>
        <span class="status-icons">
          ${icon("wifi-strength-4")}
          ${icon("signal-cellular-3")}
          ${icon("battery-80")}
        </span>
      </header>

      <div class="screen">
        <section class="hero">
          <div class="brand-row">
            <span class="app-mark"><img src="../../../assets/icon.png" alt=""></span>
            <span class="brand">EZ Score: Rummy</span>
            <span class="help" aria-label="Help">${icon("help-circle-outline")}</span>
          </div>

          <h1 class="hello">Hi Sree</h1>
          <p class="hello-sub">Your table is ready</p>

          <div class="new-game">${icon("plus")}<span>New game</span></div>

          <div class="quick-actions">
            <div class="quick">
              ${icon("podium")}
              <span class="quick-label">Results</span>
            </div>
            <div class="quick">
              ${icon("account-group")}
              <span class="quick-label">My players</span>
              <span class="quick-count">43</span>
            </div>
          </div>
        </section>

        <section class="body">
          <div class="games-panel">
            <div class="section-head">
              <span class="section-suit">${icon("cards-playing-outline")}</span>
              <span class="section-title">Live <span class="section-count">· 3</span></span>
              <span class="info" aria-label="About live games">${icon("information-outline")}</span>
            </div>
            <div class="game-list">${games.map(gameCard).join("")}</div>
          </div>
        </section>
      </div>

      <nav class="tabbar" aria-label="Main navigation">
        <span class="tab on" aria-label="Home">${icon("home-variant")}</span>
        <span class="tab" aria-label="Profile"><span class="avatar">ST</span></span>
        <span class="gesture"></span>
      </nav>
    </div>`;
})();
