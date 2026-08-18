(function () {
  // Prevent duplicate execution if re-loaded
  if (window.__MANGA_OCR_INITIALIZED__) return;
  window.__MANGA_OCR_INITIALIZED__ = true;

  // Your core function
  async function interceptMangaPanel(imageInput, workerUrl = "https://spring-water-4498.namitxalxo20.workers.dev/") {
    if (!imageInput) throw new Error("No image URL provided.");

    let base64Data = "";
    let mimeType = "image/jpeg";

    if (imageInput.startsWith("data:")) {
      const matches = imageInput.match(/^data:(.+?);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Data = matches[2];
      } else {
        throw new Error("Invalid Data URI format.");
      }
    } else if (imageInput.startsWith("http://") || imageInput.startsWith("https://")) {
      const response = await fetch(imageInput);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
      mimeType = response.headers.get("content-type") || "image/jpeg";
      const blob = await response.blob();
      
      base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      base64Data = imageInput;
    }

    const prompt = `
      You are an expert manga and comic translation pipeline. Analyze this image and extract its contents.
      Identify all text regions, sort them in standard reading order.
      For each region, provide raw extracted text, an AI-corrected version, and an English translation.
      Also provide a brief summary of the scene and a list of visible characters.
    `;

    const schema = {
      type: "OBJECT",
      properties: {
        regions: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              order: { type: "INTEGER" },
              type: { type: "STRING" },
              raw_ocr: { type: "STRING" },
              ai_corrected: { type: "STRING" },
              translation: { type: "STRING" }
            }
          }
        },
        summary: { type: "STRING" },
        characters: { type: "ARRAY", items: { type: "STRING" } }
      },
      required: ["regions", "summary", "characters"]
    };

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: mimeType, data: base64Data } }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema }
    };

    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Server returned ${response.status}: ${await response.text()}`);

    const jsonResponse = await response.json();
    const rawText = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) throw new Error("No data returned from processing worker.");

    const parsedData = JSON.parse(rawText);
    if (parsedData.regions) parsedData.regions.sort((a, b) => a.order - b.order);

    return parsedData;
  }

  // Explicitly export to window so Perchance can see it
  window.interceptMangaPanel = interceptMangaPanel;

  console.log("Manga OCR Module initialized successfully.");
})();
