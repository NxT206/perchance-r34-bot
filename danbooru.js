// === Danbooru Integration - Step 2 ===
// Commands:
//   /db [tags...] [-n number] [-s] [-r g/s/q/e]
//   /furina   (same as /db)
(function () {
  // Prevent duplicate execution if re-loaded
  if (window.__DANBOORU_INITIALIZED__) return;
  window.__DANBOORU_INITIALIZED__ = true;
oc.thread.on("MessageAdded", async function ({ message }) {
  if (message.author !== "user") return;

  let text = message.content.trim();
  const lower = text.toLowerCase();

  // Only react to our commands
  if (!lower.startsWith("/db") && !lower.startsWith("/furina")) return;

  // Hide the command from the AI
  message.hiddenFrom = message.hiddenFrom || [];
  if (!message.hiddenFrom.includes("ai")) message.hiddenFrom.push("ai");

  try {
    // ---------- Parse arguments ----------
    let parts = text.slice(text.indexOf(" ") + 1).trim().split(/\s+/).filter(Boolean);
    if (lower === "/db" || lower === "/furina") parts = []; // no args

    let limit = 1;
    let useScore = false;          // false = random, true = highest score
    let rating = null;             // g / s / q / e
    const extraTags = [];

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].toLowerCase();

      if (p === "-n" && parts[i + 1]) {
        limit = Math.min(Math.max(parseInt(parts[i + 1], 10) || 1, 1), 5); // 1–5
        i++;
      } else if (p === "-s") {
        useScore = true;
      } else if (p === "-r" && parts[i + 1]) {
        const r = parts[i + 1].toLowerCase();
        if (["g", "s", "q", "e"].includes(r)) rating = r;
        i++;
      } else if (!p.startsWith("-")) {
        extraTags.push(parts[i]); // keep original case for tags
      }
    }

    // Base character tag
    const tags = ["furina_(genshin_impact)", ...extraTags];
    if (rating) tags.push(`rating:${rating}`);

    // Safety: anonymous users can only use 2 tags total
    if (tags.length > 2) {
      oc.thread.messages.push({
        author: "system",
        content: `Too many tags (max 2 without API key). You used: ${tags.join(" ")}`,
        expectsReply: false,
        hiddenFrom: ["ai"]
      });
      return;
    }

    // ---------- Build API request ----------
    const params = new URLSearchParams({
      tags: tags.join(" "),
      limit: useScore ? Math.max(limit * 3, 10) : limit, // fetch more when sorting by score
      random: useScore ? "false" : "true"
    });

    const url = `https://danbooru.donmai.us/posts.json?${params}`;

    const response = await fetch(url, {
      headers: { "User-Agent": "PerchanceFurinaBot/1.1" }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    let posts = await response.json();
    if (!Array.isArray(posts) || posts.length === 0) {
      oc.thread.messages.push({
        author: "system",
        content: `No posts found for: ${tags.join(" ")}`,
        expectsReply: false,
        hiddenFrom: ["ai"]
      });
      return;
    }

    // Sort by score if requested
    if (useScore) {
      posts.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    // Take only the number the user asked for
    posts = posts.slice(0, limit);

    // ---------- Display results ----------
    for (const post of posts) {
      const imageUrl = post.large_file_url || post.file_url || post.preview_file_url;
      if (!imageUrl) continue;

      const postLink = `https://danbooru.donmai.us/posts/${post.id}`;
      const ratingStr = (post.rating || "?").toUpperCase();
      const score = post.score ?? 0;
      const shortTags = (post.tag_string || "").split(" ").slice(0, 7).join(" ");

      const content = `
<img src="${imageUrl}" referrerpolicy="no-referrer" style="max-width:100%;max-height:480px;border-radius:10px;display:block;margin:6px 0;">

**Furina** · #${post.id} · ${ratingStr} · Score ${score}  
[Open on Danbooru](${postLink})  
\`${shortTags}\`
      `.trim();

      oc.thread.messages.push({
        author: "system",
        name: "Danbooru",
        content,
        expectsReply: false,
        hiddenFrom: ["ai"]
      });
    }

    // Update avatar to the first (best) image
    if (posts[0]) {
      const bestUrl = posts[0].large_file_url || posts[0].file_url || posts[0].preview_file_url;
      if (bestUrl) {
        oc.character.avatar = {
          url: bestUrl,
          size: oc.character.avatar?.size || 120,
          shape: oc.character.avatar?.shape || "circle"
        };
      }
    }

  } catch (err) {
    console.error("Danbooru error:", err);
    oc.thread.messages.push({
      author: "system",
      content: `Danbooru error: ${err.message}`,
      expectsReply: false,
      hiddenFrom: ["ai"]
    });
  }
});
  console.log("Danbooru Module initialized successfully.");
})();
