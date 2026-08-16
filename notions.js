function () {
  // Prevent duplicate execution if re-loaded
  if (window.__NOTION_INITIALIZED__) return;
  window.__NOTION_INITIALIZED__ = true;// Wait for Perchance
await new Promise(r => setTimeout(r, 1000));

// ===== NOTION CONFIG =====
const NOTION_TOKEN = "secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"; // Your token
const NOTION_DATABASE_ID = "YOUR_DATABASE_ID_HERE"; // Your database ID

// ===== SEND TO NOTION =====
async function sendToNotion(title, content) {
  const url = "https://api.notion.com/v1/pages";
  const headers = {
    "Authorization": `Bearer ${NOTION_TOKEN}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
  };
  
  // Build the request body
  const body = {
    parent: { database_id: NOTION_DATABASE_ID },
    properties: {
      "Title": { title: [{ text: { content: title || "Untitled" } }] }
      // You can add more properties here if needed (Tags, Date, etc.)
    }
  };
  
  // If content is provided, add it as page body (not a property)
  if (content && content.trim()) {
    body.children = [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: content }
            }
          ]
        }
      }
    ];
  }
  
  const response = await fetch(url, { 
    method: "POST", 
    headers, 
    body: JSON.stringify(body) 
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Notion API error: ${error.message || response.status}`);
  }
  return await response.json();
}

// ===== COMMAND HANDLER =====
if (typeof oc !== 'undefined' && oc.thread) {
  oc.thread.on("MessageAdded", async function() {
    let lastMessage = oc.thread.messages.at(-1);
    if (!lastMessage || lastMessage.author !== "user") return;
    
    let content = lastMessage.content.trim();
    
    if (content.startsWith("/note")) {
      let query = content.replace("/note", "").trim();
      
      if (!query) {
        oc.thread.messages.push({
          content: `📝 **Note Commands**:
- \`/note Title | Content\` - Save note (content goes inside page)
- \`/note Title\` - Save with just a title
- \`/note\` - Show this help`,
          author: "user",
          expectsReply: false
        });
        return;
      }
      
      try {
        let title, noteContent;
        if (query.includes("|")) {
          const parts = query.split("|");
          title = parts[0].trim();
          noteContent = parts.slice(1).join("|").trim();
        } else {
          title = query;
          noteContent = "";
        }
        
        oc.thread.messages.push({
          content: `⏳ Saving note: "${title}"...`,
          author: "user",
          expectsReply: false
        });
        
        await sendToNotion(title, noteContent);
        
        oc.thread.messages.push({
          content: `✅ Note saved successfully to Notion!\n**Title:** ${title}\n**Content added to page body.**`,
          author: "user",
          expectsReply: false
        });
      } catch (e) {
        oc.thread.messages.push({
          content: `❌ Error: ${e.message}`,
          author: "user",
          expectsReply: false
        });
      }
    }
  });
}

console.log("✅ Notion note-saver with page body content loaded!");
  console.log("notion Module initialized successfully.");
})();
