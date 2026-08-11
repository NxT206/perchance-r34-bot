// === Rule34 Integration - Fixed & Enhanced Version ===
// Commands: /r34, /furina, /expr, /switch, /intercept, /avatarchange, /fav, /help

const R34_USER_ID = "3666804";
const R34_API_KEY = "a542d0fd8c83d2b3cea5f0fe5bcb27f13c85792ce4812e85e3ee1e7bd625da6777aa575cd7299e38dd8e9defd3c8ca7d39ee035ef22ee71f58b5f2a1f6530c56";

const DEFAULTS = {
  characterTag: "furina_(genshin_impact)",
  characterName: "Furina"
};

const CHARACTERS = {
  furina:      { tag: "furina_(genshin_impact)", name: "Furina" },
  raiden:      { tag: "raiden_shogun", name: "Raiden Shogun" },
  yae:         { tag: "yae_miko", name: "Yae Miko" },
  ganyu:       { tag: "ganyu_(genshin_impact)", name: "Ganyu" },
  hutao:       { tag: "hu_tao_(genshin_impact)", name: "Hu Tao" },
  keqing:      { tag: "keqing_(genshin_impact)", name: "Keqing" },
  mona:        { tag: "mona_(genshin_impact)", name: "Mona" },
  eula:        { tag: "eula_(genshin_impact)", name: "Eula" },
  ayaka:       { tag: "kamisato_ayaka", name: "Ayaka" },
  shenhe:      { tag: "shenhe_(genshin_impact)", name: "Shenhe" },
  yelan:       { tag: "yelan_(genshin_impact)", name: "Yelan" },
  arlecchino:  { tag: "arlecchino_(genshin_impact)", name: "Arlecchino" },
  clorinde:    { tag: "clorinde_(genshin_impact)", name: "Clorinde" },
  navia:       { tag: "navia_(genshin_impact)", name: "Navia" },
  mavuika:     { tag: "mavuika_(genshin_impact)", name: "Mavuika" }
};

const EXPRESSIONS = {
  happy: "smile open_mouth", smile: "smile", angry: "angry furrowed_brow", mad: "angry",
  blush: "blush embarrassed", shy: "blush looking_away", sad: "sad tears", cry: "crying tears",
  smug: "smug one_eye_closed", confident: "smug closed_mouth", surprise: "surprised wide_eyed",
  shocked: "shocked open_mouth", thinking: "thinking hand_on_own_chin", wink: "wink one_eye_closed",
  pout: "pout", love: "heart heart_eyes", ahegao: "ahegao", nude: "nude", clothed: "fully_clothed"
};

const RATING_MAP = {
  g: "safe",
  s: "safe",
  q: "questionable",
  e: "explicit"
};

// ---------- Settings Helpers ----------
function getSettings() {
  const data = oc.character.customData = oc.character.customData || {};
  return {
    characterTag: data.r34CharacterTag || DEFAULTS.characterTag,
    characterName: data.r34CharacterName || DEFAULTS.characterName,
    lastPostId: data.r34LastPostId || null,
    avatarChange: data.r34AvatarChange !== false,
    favorites: data.r34Favorites || []
  };
}

function saveSettings(settings) {
  const data = oc.character.customData = oc.character.customData || {};
  data.r34CharacterTag = settings.characterTag;
  data.r34CharacterName = settings.characterName;
  data.r34LastPostId = settings.lastPostId;
  data.r34AvatarChange = settings.avatarChange;
  data.r34Favorites = settings.favorites;
}

oc.thread.on("MessageAdded", async function ({ message }) {
  if (message.author !== "user") return;

  const text = message.content.trim();
  const lower = text.toLowerCase();

  const commandPrefixes = ["/r34", "/furina", "/expr", "/switch", "/intercept", "/avatarchange", "/fav", "/help"];
  if (!commandPrefixes.some(cmd => lower.startsWith(cmd))) return;

  message.hiddenFrom = message.hiddenFrom || [];
  if (!message.hiddenFrom.includes("ai")) message.hiddenFrom.push("ai");

  if (!R34_API_KEY || R34_API_KEY === "YOUR_API_KEY_HERE") {
    oc.thread.messages.push({
      author: "system",
      content: "⚠️ Please set your valid Rule34 API key in the custom code first.",
      expectsReply: false,
      hiddenFrom: ["ai"]
    });
    return;
  }

  const settings = getSettings();

  try {
    // ====================== /help ======================
    if (lower === "/help" || lower === "/r34 help" || lower === "/r34help") {
      const helpText = `
**Rule34 Commands**

\`\/r34\` or \`\/furina\` — Show random image of current character  
\`\/r34 [tags]\` — Example: \`/r34 smile blush\`  
\`\/r34 -s\` — Highest score instead of random  
\`\/r34 -n 2\` — Show up to 2 images (max 5)  
\`\/r34 -r e\` — Filter rating (\`g\`/\`s\` = safe, \`q\` = questionable, \`e\` = explicit)  
\`\/r34 #ID\` — Load specific post (Example: \`/r34 #16469548\`)  

\`\/expr\` — List available expression tags  
\`\/expr happy -s -n 2\` — Expression search  

\`\/switch\` — List presets & show current preset  
\`\/switch furina\` or \`\/switch <any_tag>\` — Switch character  

\`\/intercept\` — Have AI react to/describe the last image  
\`\/intercept #ID\` — Have AI react to a specific image  

\`\/fav\` — View saved favorite post IDs  
\`\/fav add\` — Add last post to favorites  
\`\/avatarchange on|off\` — Toggle dynamic avatar updates  
      `.trim();

      oc.thread.messages.push({
        author: "system",
        content: helpText,
        expectsReply: false,
        hiddenFrom: ["ai"]
      });
      return;
    }

    // ====================== /fav ======================
    if (lower.startsWith("/fav")) {
      const arg = text.slice(4).trim().toLowerCase();
      if (arg === "add") {
        if (!settings.lastPostId) {
          oc.thread.messages.push({
            author: "system",
            content: "⚠️ No recent post to add to favorites.",
            expectsReply: false,
            hiddenFrom: ["ai"]
          });
          return;
        }
        if (!settings.favorites.includes(settings.lastPostId)) {
          settings.favorites.push(settings.lastPostId);
          saveSettings(settings);
        }
        oc.thread.messages.push({
          author: "system",
          content: `❤️ Added Post **#${settings.lastPostId}** to favorites!`,
          expectsReply: false,
          hiddenFrom: ["ai"]
        });
        return;
      }

      const favList = settings.favorites.length > 0 
        ? settings.favorites.map(id => `\`#${id}\``).join(", ") 
        : "None";

      oc.thread.messages.push({
        author: "system",
        content: `⭐ **Saved Favorites:** ${favList}\n\nUsage: \`/fav add\` to bookmark the current post.`,
        expectsReply: false,
        hiddenFrom: ["ai"]
      });
      return;
    }

    // ====================== /avatarchange ======================
    if (lower.startsWith("/avatarchange")) {
      const arg = text.slice(13).trim().toLowerCase();

      if (arg === "on") {
        settings.avatarChange = true;
        saveSettings(settings);
        oc.thread.messages.push({
          author: "system",
          content: "✅ Avatar auto-changing enabled.",
          expectsReply: false,
          hiddenFrom: ["ai"]
        });
        return;
      }

      if (arg === "off") {
        settings.avatarChange = false;
        saveSettings(settings);
        oc.thread.messages.push({
          author: "system",
          content: "✅ Avatar auto-changing disabled.",
          expectsReply: false,
          hiddenFrom: ["ai"]
        });
        return;
      }

      oc.thread.messages.push({
        author: "system",
        content: `Avatar changing is currently **${settings.avatarChange ? "ON" : "OFF"}**\n\nUsage: \`/avatarchange on\` or \`/avatarchange off\``,
        expectsReply: false,
        hiddenFrom: ["ai"]
      });
      return;
    }

    // ====================== /switch ======================
    if (lower.startsWith("/switch")) {
      const arg = text.slice(7).trim().toLowerCase();

      if (!arg || arg === "list") {
        const list = Object.keys(CHARACTERS).join(", ");
        oc.thread.messages.push({
          author: "system",
          content: `**Current Preset:** ${settings.characterName} (\`${settings.characterTag}\`)\n\n**Presets:** \`${list}\`\n\nUsage: \`/switch furina\` or \`/switch tag_name\``,
          expectsReply: false,
          hiddenFrom: ["ai"]
        });
        return;
      }

      if (CHARACTERS[arg]) {
        settings.characterTag = CHARACTERS[arg].tag;
        settings.characterName = CHARACTERS[arg].name;
      } else {
        settings.characterTag = arg.replace(/\s+/g, "_");
        settings.characterName = arg.charAt(0).toUpperCase() + arg.slice(1);
      }
      saveSettings(settings);

      oc.thread.messages.push({
        author: "system",
        content: `✅ Switched to **${settings.characterName}** (\`${settings.characterTag}\`)`,
        expectsReply: false,
        hiddenFrom: ["ai"]
      });
      return;
    }

    // ====================== /intercept ======================
    if (lower.startsWith("/intercept")) {
      let targetId = null;
      const arg = text.slice(10).trim();

      if (arg) {
        const idNum = parseInt(arg.replace(/^#/, "").replace(/^id:/i, ""), 10);
        if (!isNaN(idNum)) targetId = idNum;
      } else {
        targetId = settings.lastPostId;
      }

      if (!targetId) {
        oc.thread.messages.push({
          author: "system",
          content: "⚠️ No image to intercept. Load an image first or use `/intercept #ID`",
          expectsReply: false,
          hiddenFrom: ["ai"]
        });
        return;
      }

      const params = new URLSearchParams({
        page: "dapi", s: "post", q: "index", json: "1",
        id: targetId,
        user_id: R34_USER_ID,
        api_key: R34_API_KEY
      });

      const response = await fetch(`https://api.rule34.xxx/index.php?${params}`, {
        headers: { "User-Agent": "PerchanceFurinaBot/2.6" }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const textResponse = await response.text();
      if (!textResponse.trim()) throw new Error("Empty response from API");

      const posts = JSON.parse(textResponse);
      if (!Array.isArray(posts) || posts.length === 0) {
        oc.thread.messages.push({
          author: "system",
          content: `Could not find post #${targetId}`,
          expectsReply: false,
          hiddenFrom: ["ai"]
        });
        return;
      }

      const post = posts[0];
      const allTags = (post.tags || "").split(" ").filter(Boolean);
      const importantTags = allTags.slice(0, 40).join(", ");
      const rating = (post.rating || "unknown").toUpperCase();
      const score = post.score ?? 0;

      const analysisPrompt = `[System Prompt: Analyze this image depicting ${settings.characterName}.
Post ID: ${post.id}
Rating: ${rating}
Score: ${score}
Tags: ${importantTags}

Describe the situation, costume, expression, and pose as portrayed in this image in an immersive, in-character way. Write 3-5 sentences naturally without listing raw tags.]`;

      oc.thread.messages.push({
        author: "system",
        content: analysisPrompt,
        hiddenFrom: ["user"],
        expectsReply: false
      });

      oc.thread.messages.push({
        author: "user",
        content: `What do you think of this picture (#${post.id})?`,
        expectsReply: true
      });

      return;
    }

    // ====================== /expr list ======================
    if (lower === "/expr") {
      const list = Object.keys(EXPRESSIONS).join(", ");
      oc.thread.messages.push({
        author: "system",
        content: `**Expressions:** \`${list}\`\n\nExample: \`/expr happy -s -n 2\``,
        expectsReply: false,
        hiddenFrom: ["ai"]
      });
      return;
    }

    // ====================== Main Image Commands (/r34, /furina, /expr) ======================
    let parts = text.slice(text.indexOf(" ") + 1).trim().split(/\s+/).filter(Boolean);
    if (lower === "/r34" || lower === "/furina") parts = [];

    let limit = 1;
    let useScore = false;
    let rating = null;
    let postId = null;
    const extraTags = [];
    let expressionTags = "";

    if (lower.startsWith("/expr")) {
      const exprName = parts[0]?.toLowerCase();
      if (exprName && EXPRESSIONS[exprName]) {
        expressionTags = EXPRESSIONS[exprName];
        parts = parts.slice(1);
      } else if (exprName) {
        oc.thread.messages.push({
          author: "system",
          content: `Unknown expression: "${exprName}". Type \`/expr\` to list all.`,
          expectsReply: false,
          hiddenFrom: ["ai"]
        });
        return;
      }
    }

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].toLowerCase();

      if (p.startsWith("#") || p.startsWith("id:")) {
        const idNum = parseInt(p.replace(/^#/, "").replace(/^id:/, ""), 10);
        if (!isNaN(idNum)) postId = idNum;
        continue;
      }

      if (p === "-n" && parts[i + 1]) {
        limit = Math.min(Math.max(parseInt(parts[i + 1], 10) || 1, 1), 5);
        i++;
      } else if (p === "-s") {
        useScore = true;
      } else if (p === "-r" && parts[i + 1]) {
        const r = parts[i + 1].toLowerCase();
        if (RATING_MAP[r]) rating = r;
        i++;
      } else if (!p.startsWith("-")) {
        extraTags.push(parts[i]);
      }
    }

    const params = new URLSearchParams({
      page: "dapi",
      s: "post",
      q: "index",
      json: "1",
      user_id: R34_USER_ID,
      api_key: R34_API_KEY
    });

    if (postId) {
      params.set("id", String(postId));
      params.set("limit", "1");
    } else {
      const tags = [settings.characterTag];
      if (expressionTags) tags.push(...expressionTags.split(" "));
      tags.push(...extraTags);

      if (rating) {
        tags.push(`rating:${RATING_MAP[rating]}`);
      }

      params.set("tags", tags.join(" "));
      params.set("limit", useScore ? Math.max(limit * 5, 20).toString() : String(limit * 3));
    }

    const response = await fetch(`https://api.rule34.xxx/index.php?${params}`, {
      headers: { "User-Agent": "PerchanceFurinaBot/2.6" }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const textResponse = await response.text();
    if (!textResponse.trim()) {
      throw new Error("No response or invalid search filters.");
    }

    let posts = JSON.parse(textResponse);

    if (!Array.isArray(posts) || posts.length === 0) {
      oc.thread.messages.push({
        author: "system",
        content: postId ? `No post found with ID: ${postId}` : "No posts found for those search tags.",
        expectsReply: false,
        hiddenFrom: ["ai"]
      });
      return;
    }

    if (!postId) {
      if (useScore) {
        posts.sort((a, b) => (b.score || 0) - (a.score || 0));
      } else {
        for (let i = posts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [posts[i], posts[j]] = [posts[j], posts[i]];
        }
      }
      posts = posts.slice(0, limit);
    }

    for (const post of posts) {
      const imageUrl = post.sample_url || post.file_url || post.preview_url;
      if (!imageUrl) continue;

      const postLink = `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`;
      const ratingStr = (post.rating || "?").toUpperCase();
      const score = post.score ?? 0;
      const shortTags = (post.tags || "").split(" ").slice(0, 8).join(" ");

      oc.thread.messages.push({
        author: "system",
        name: "Rule34",
        content: `
<img src="${imageUrl}" referrerpolicy="no-referrer" style="max-width:100%; max-height:500px; border-radius:10px; display:block; margin:8px 0;">

**Tag:** ${settings.characterName} · **#${post.id}** · **${ratingStr}** · **Score ${score}**  
[Open on Rule34](${postLink})  
\`${shortTags}\`
        `.trim(),
        expectsReply: false,
        hiddenFrom: ["ai"]
      });

      settings.lastPostId = post.id;
    }

    // Dynamic Avatar Update
    if (settings.avatarChange && posts[0]) {
      const bestUrl = posts[0].sample_url || posts[0].file_url || posts[0].preview_url;
      if (bestUrl) {
        oc.character.avatar = {
          url: bestUrl,
          size: oc.character.avatar?.size || 120,
          shape: oc.character.avatar?.shape || "circle"
        };
      }
    }

    saveSettings(settings);

  } catch (err) {
    console.error("Rule34 Bot Error:", err);
    oc.thread.messages.push({
      author: "system",
      content: `⚠️ Error: ${err.message}`,
      expectsReply: false,
      hiddenFrom: ["ai"]
    });
  }
});
