// ====================
// SHARED HELPER FUNCTIONS
// ====================
(function () {
  // Prevent duplicate execution if re-loaded
  // anilist.js
if (window.__ANILIST_INITIALIZED__) return;
  window.__ANILIST_INITIALIZED__ = true;
async function queryAniList(query, variables = {}) {
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });
  
  const json = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message);
  }
  return json.data;
}

function pushMessage(content) {
  oc.thread.messages.push({ author: "system", expectsReply: false, content });
}

function getCurrentSeason() {
  const month = new Date().getMonth(); // 0-11
  if (month >= 0 && month <= 2) return "WINTER";
  if (month >= 3 && month <= 5) return "SPRING";
  if (month >= 6 && month <= 8) return "SUMMER";
  return "FALL";
}

// ====================
// MAIN EVENT HANDLER
// ====================
oc.thread.on("messageadded", async function({ message }) {
  if (message.author !== "user") return;

  const text = message.content.trim();
  if (!text.toLowerCase().startsWith("!ani")) return;

  // Split entire message into parts: ["!ani", "subcommand", "arg1", "arg2"...]
  const parts = text.split(/\s+/).filter(Boolean);
  
  // Need at least !ani and a subcommand
  if (parts.length < 2) return;

  const type = parts[1].toLowerCase(); // Subcommand (anime, char, season, top, etc.)
  const args = parts.slice(2);         // Everything after subcommand

  try {
    // --------------------
    // 1. ANIME (!ani anime <name> or !ani a <name>)
    // --------------------
    if (type === "anime" || type === "a") {
      const search = args.join(" ").trim();
      if (!search) return pushMessage("⚠️ Please provide an anime name.");

      const data = await queryAniList(`
        query ($search: String) {
          Media(search: $search, type: ANIME) {
            title { english romaji }
            averageScore episodes genres siteUrl
          }
        }
      `, { search });

      const a = data.Media;
      if (!a) return pushMessage(`❌ No anime found for "${search}".`);

      pushMessage(`📺 **[${a.title.english || a.title.romaji}](${a.siteUrl})**\n\n⭐ Score: ${a.averageScore || "N/A"}%\n📺 Episodes: ${a.episodes || "Unknown"}\n🎭 Genres: ${a.genres?.join(", ") || "N/A"}`);
    }

    // --------------------
    // 2. CHARACTER (!ani character <name> or !ani c <name>)
    // --------------------
    else if (type === "character" || type === "char" || type === "c") {
      const search = args.join(" ").trim();
      if (!search) return pushMessage("⚠️ Please provide a character name.");

      const data = await queryAniList(`
        query ($search: String) {
          Character(search: $search) {
            name { full native }
            description(asHtml: false)
            siteUrl
          }
        }
      `, { search });

      const c = data.Character;
      if (!c) return pushMessage(`❌ No character found for "${search}".`);

      let bio = (c.description || "No bio available.").replace(/~![\s\S]*?!~/g, "").replace(/<[^>]*>?/gm, "").trim();
      if (bio.length > 300) bio = bio.substring(0, 300) + "...";

      pushMessage(`👤 **[${c.name.full}](${c.siteUrl})** (${c.native || ""})\n\n📝 ${bio}`);
    }

    // --------------------
    // 3. RECOMMEND (!ani recommend <name> or !ani r <name>)
    // --------------------
    else if (type === "recommend" || type === "rec" || type === "r") {
      const search = args.join(" ").trim();
      if (!search) return pushMessage("⚠️ Please provide an anime name.");

      const data = await queryAniList(`
        query ($search: String) {
          Media(search: $search, type: ANIME) {
            title { english romaji }
            recommendations(perPage: 3, sort: RATING_DESC) {
              nodes {
                mediaRecommendation { title { english romaji } averageScore siteUrl }
              }
            }
          }
        }
      `, { search });

      const recs = data.Media?.recommendations?.nodes?.filter(n => n.mediaRecommendation);
      if (!recs || recs.length === 0) return pushMessage(`❌ No recommendations found for "${search}".`);

      const list = recs.map((r, i) => {
        const m = r.mediaRecommendation;
        return `${i + 1}. **[${m.title.english || m.title.romaji}](${m.siteUrl})** (⭐ ${m.averageScore || "N/A"}%)`;
      }).join("\n");

      pushMessage(`💡 **If you liked "${data.Media.title.english || data.Media.title.romaji}", try:**\n\n${list}`);
    }

    // --------------------
    // 4. SEASON
    // --------------------
    else if (type === "season" || type === "s") {
      let seasonInput = args[0] ? args[0].toUpperCase() : null;
      let yearInput = parseInt(args[1], 10);

      const validSeasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
      
      const targetSeason = validSeasons.includes(seasonInput) ? seasonInput : getCurrentSeason();
      const targetYear = (!isNaN(yearInput) && yearInput > 1960) ? yearInput : new Date().getFullYear();

      const data = await queryAniList(
        "query ($season: MediaSeason, $year: Int) { Page(page: 1, perPage: 5) { media(season: $season, seasonYear: $year, type: ANIME, sort: POPULARITY_DESC, isAdult: false) { title { english romaji } averageScore siteUrl } } }",
        { season: targetSeason, year: targetYear }
      );

      const animeList = data.Page && data.Page.media ? data.Page.media : [];
      
      if (animeList.length === 0) {
        return pushMessage("❌ No anime found for " + targetSeason + " " + targetYear + ".");
      }

      let list = "";
      for (let i = 0; i < animeList.length; i++) {
        const m = animeList[i];
        const title = m.title.english || m.title.romaji || "Unknown";
        const score = m.averageScore || "N/A";
        list += (i + 1) + ". **[" + title + "](" + m.siteUrl + ")** — ⭐ " + score + "%\n";
      }

      pushMessage("🌸 **Top Popular Anime - " + targetSeason + " " + targetYear + ":**\n\n" + list);
    }

    // --------------------
    // 5. TOP ANIME
    // --------------------
    else if (type === "top" || type === "t" || type === "topanime") {
      const data = await queryAniList(
        "query { Page(page: 1, perPage: 5) { media(type: ANIME, sort: SCORE_DESC, isAdult: false) { title { english romaji } averageScore siteUrl } } }"
      );

      const animeList = data.Page && data.Page.media ? data.Page.media : [];
      
      if (animeList.length === 0) {
        return pushMessage("❌ Could not retrieve top anime.");
      }

      let list = "";
      for (let i = 0; i < animeList.length; i++) {
        const m = animeList[i];
        const title = m.title.english || m.title.romaji || "Unknown";
        const score = m.averageScore || "N/A";
        list += (i + 1) + ". **[" + title + "](" + m.siteUrl + ")** — ⭐ " + score + "%\n";
      }

      pushMessage("🏆 **Top Highest Rated Anime:**\n\n" + list);
    }
    // --------------------
    // 6. FIND BY GENRES
    // --------------------
    else if (type === "find" || type === "f") {

  const genreInput = args.join(" ").trim();

  if (!genreInput) {
    return pushMessage("⚠️ Please provide at least one genre.\n\nExample:\n`!ani find romance + fantasy`");
  }

  const genres = genreInput
    .split("+")
    .map(g => g.trim())
    .filter(Boolean);

  if (genres.length === 0) {
    return pushMessage("⚠️ No valid genres found.");
  }

  const data = await queryAniList(`
    query ($genre: String) {
      Page(page: 1, perPage: 50) {
        media(
          type: ANIME
          genre: $genre
          sort: SCORE_DESC
          isAdult: false
        ) {
          title {
            english
            romaji
          }
          genres
          averageScore
          siteUrl
        }
      }
    }
  `, { genre: genres[0] });

  const animeList = data.Page?.media || [];

  const filtered = animeList.filter(anime =>
    genres.every(g =>
      anime.genres.some(
        ag => ag.toLowerCase() === g.toLowerCase()
      )
    )
  );

  if (filtered.length === 0) {
    return pushMessage(
      `❌ No anime found matching:\n${genres.join(" + ")}`
    );
  }

  const results = filtered.slice(0, 5);

  const list = results.map((anime, i) => {
    const title = anime.title.english || anime.title.romaji;
    return `${i + 1}. **[${title}](${anime.siteUrl})** (⭐ ${anime.averageScore || "N/A"}%)`;
  }).join("\n");

  pushMessage(
    `🔍 **Anime matching:** ${genres.join(" + ")}\n\n${list}`
  );
}
    // --------------------
// 8. MANGA (!ani manga <name> or !ani m <name>)
// --------------------
else if (type === "manga" || type === "m") {

  const search = args.join(" ").trim();

  if (!search) {
    return pushMessage("⚠️ Please provide a manga name.");
  }

  const data = await queryAniList(`
    query ($search: String) {
      Media(search: $search, type: MANGA) {
        title {
          english
          romaji
        }
        averageScore
        chapters
        volumes
        genres
        siteUrl
      }
    }
  `, { search });

  const m = data.Media;

  if (!m) {
    return pushMessage(`❌ No manga found for "${search}".`);
  }

  pushMessage(
    `📖 **[${m.title.english || m.title.romaji}](${m.siteUrl})**\n\n` +
    `⭐ Score: ${m.averageScore || "N/A"}%\n` +
    `📚 Chapters: ${m.chapters || "Unknown"}\n` +
    `📦 Volumes: ${m.volumes || "Unknown"}\n` +
    `🎭 Genres: ${m.genres?.join(", ") || "N/A"}`
  );
}
    // --------------------
// 7. AIRING
// --------------------
else if (type === "airing" || type === "air") {

  // !ani airing
  if (args.length === 0) {

    const data = await queryAniList(`
      query {
        Page(page: 1, perPage: 5) {
          media(
            type: ANIME
            status: RELEASING
            sort: POPULARITY_DESC
            isAdult: false
          ) {
            title {
              english
              romaji
            }
            averageScore
            siteUrl
          }
        }
      }
    `);

    const animeList = data.Page?.media || [];

    if (animeList.length === 0) {
      return pushMessage("❌ No currently airing anime found.");
    }

    const list = animeList.map((anime, i) => {
      const title = anime.title.english || anime.title.romaji;
      return `${i + 1}. **[${title}](${anime.siteUrl})** (⭐ ${anime.averageScore || "N/A"}%)`;
    }).join("\n");

    return pushMessage(
      `📺 **Currently Airing Anime**\n\n${list}`
    );
  }

  // !ani airing <anime name>
  const search = args.join(" ").trim();

  const data = await queryAniList(`
    query ($search: String) {
      Media(search: $search, type: ANIME) {
        title {
          english
          romaji
        }
        status
        siteUrl
        nextAiringEpisode {
          episode
          timeUntilAiring
        }
      }
    }
  `, { search });

  const anime = data.Media;

  if (!anime) {
    return pushMessage(`❌ No anime found for "${search}".`);
  }

  if (!anime.nextAiringEpisode) {
    return pushMessage(
      `📺 **[${anime.title.english || anime.title.romaji}](${anime.siteUrl})**\n\n` +
      `This anime is not currently airing.`
    );
  }

  const seconds = anime.nextAiringEpisode.timeUntilAiring;

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  pushMessage(
    `📺 **[${anime.title.english || anime.title.romaji}](${anime.siteUrl})**\n\n` +
    `🎬 Next Episode: ${anime.nextAiringEpisode.episode}\n` +
    `⏳ Airs in: ${days}d ${hours}h ${minutes}m`
  );
}
    // --------------------
// 8. TASTE
// --------------------
else if (type === "taste") {

  const animeNames = args.join(" ")
    .split(",")
    .map(a => a.trim())
    .filter(Boolean);

  if (animeNames.length < 2) {
    return pushMessage(
      "⚠️ Please provide at least 2 anime.\n\nExample:\n`!ani taste frieren, re:zero, mushoku tensei`"
    );
  }

  const genreCounts = {};
  const analyzedTitles = [];
  const enteredTitles = new Set();

  // Analyze entered anime
  for (const name of animeNames) {

    const data = await queryAniList(`
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          title {
            english
            romaji
          }
          genres
        }
      }
    `, { search: name });

    const anime = data.Media;

    if (!anime) continue;

    const title =
      anime.title.english ||
      anime.title.romaji;

    analyzedTitles.push(title);

    enteredTitles.add(title.toLowerCase());

    for (const genre of anime.genres || []) {
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    }
  }

  if (analyzedTitles.length === 0) {
    return pushMessage("❌ Could not analyze any anime.");
  }

  // Sort genres by popularity
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1]);

  const bestGenres = topGenres.slice(0, 3);

  if (bestGenres.length === 0) {
    return pushMessage("❌ Could not determine genre preferences.");
  }

  const primaryGenre = bestGenres[0][0];

  // Get recommendations
  const recData = await queryAniList(`
    query ($genre: String) {
      Page(page: 1, perPage: 20) {
        media(
          type: ANIME
          genre: $genre
          sort: SCORE_DESC
          isAdult: false
        ) {
          title {
            english
            romaji
          }
          averageScore
          siteUrl
        }
      }
    }
  `, { genre: primaryGenre });

  const candidates = recData.Page?.media || [];

  const recommendations = candidates
    .filter(anime => {
      const title =
        (anime.title.english || anime.title.romaji || "")
          .toLowerCase();

      return !enteredTitles.has(title);
    })
    .slice(0, 5);

  const genreText = bestGenres
    .map((g, i) => `${i + 1}. ${g[0]} (${g[1]})`)
    .join("\n");

  const recText = recommendations.length > 0
    ? recommendations.map((anime, i) => {
        const title =
          anime.title.english ||
          anime.title.romaji;

        return `${i + 1}. **[${title}](${anime.siteUrl})** (⭐ ${anime.averageScore || "N/A"}%)`;
      }).join("\n")
    : "No recommendations found.";

  pushMessage(
    `🎭 **Taste Analysis**\n\n` +
    `📺 Analyzed:\n• ${analyzedTitles.join("\n• ")}\n\n` +
    `🏷️ Top Genres:\n${genreText}\n\n` +
    `💡 Recommendations:\n${recText}`
  );
}
    // --------------------
// HELP
// --------------------
else if (type === "help" || type === "h") {

  pushMessage(
`📚 **AniList Commands**

🔎 Search
• \`!ani anime <name>\` (or \`a\`)
• \`!ani manga <name>\` (or \`m\`)
• \`!ani character <name>\` (or \`c\`)

💡 Discovery
• \`!ani recommend <anime>\` (or \`r\`)
• \`!ani top\` (or \`t\`)
• \`!ani season [SEASON] [YEAR]\` (or \`s\`)

📺 Airing
• \`!ani airing\`
• \`!ani airing <anime>\` (or \`air\`)

🎭 Taste Analysis
• \`!ani taste anime1, anime2, anime3\`

❓ Help
• \`!ani help\` (or \`h\`)`
  );
}
    else {
  pushMessage(
    "⚠️ Unknown command.\n\nUse `!ani help` to see all available commands."
  );
}

  } catch (err) {
    pushMessage(`❌ Error: ${err.message}`);
  }
});
console.log("anilist Module initialized successfully.");
})();
