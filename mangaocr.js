/**
 * Processes a manga panel image URL or Base64 string through the OCR and translation pipeline.
 * 
 * @param {string} imageInput - Can be an image URL (http/https/data URI) or raw base64 string.
 * @param {string} workerUrl - Your Cloudflare Worker URL.
 * @returns {Promise<Object>} - Returns an object containing summary, characters, and sorted regions.
 */
async function interceptMangaPanel(imageInput, workerUrl = "https://spring-water-4498.namitxalxo20.workers.dev/") {
    if (!imageInput) {
        throw new Error("No image input provided.");
    }

    let base64Data = "";
    let mimeType = "image/jpeg"; // default fallback

    // Handle Image URL or Data URI vs Raw Base64
    if (imageInput.startsWith("data:")) {
        // Data URI format: data:image/png;base64,iVBORw0KGgo...
        const matches = imageInput.match(/^data:(.+?);base64,(.+)$/);
        if (matches) {
            mimeType = matches[1];
            base64Data = matches[2];
        } else {
            throw new Error("Invalid Data URI format.");
        }
    } else if (imageInput.startsWith("http://") || imageInput.startsWith("https://")) {
        // Fetch image from URL and convert to Base64
        try {
            const response = await fetch(imageInput);
            if (!response.ok) throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
            
            mimeType = response.headers.get("content-type") || "image/jpeg";
            const blob = await response.blob();
            
            base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            throw new Error(`Error fetching image URL: ${error.message}`);
        }
    } else {
        // Assume it's already a raw base64 string
        base64Data = imageInput;
    }

    // Define the extraction prompt
    const prompt = `
        You are an expert manga and comic translation pipeline. Analyze this image and extract its contents.
        Identify all text regions, sort them in standard reading order (Top->Bottom, Right->Left for Japanese; Top->Bottom, Left->Right for English).
        For each region, provide the raw extracted text, an AI-corrected version (fixing typos or bad OCR), and an English translation (if not already English).
        Also provide a brief summary of the scene and a list of visible characters.
    `;

    // Define the expected JSON response schema
    const schema = {
        type: "OBJECT",
        properties: {
            regions: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        order: { type: "INTEGER" },
                        type: { type: "STRING", description: "Speech Bubble, Narration, SFX, Sign, etc." },
                        raw_ocr: { type: "STRING" },
                        ai_corrected: { type: "STRING" },
                        translation: { type: "STRING" }
                    }
                }
            },
            summary: { type: "STRING" },
            characters: {
                type: "ARRAY",
                items: { type: "STRING" }
            }
        },
        required: ["regions", "summary", "characters"]
    };

    // Construct the payload for your Cloudflare Worker / Gemini API
    const payload = {
        contents: [
            {
                role: "user",
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: mimeType, data: base64Data } }
                ]
            }
        ],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    };

    // Send request to worker
    const response = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${await response.text()}`);
    }

    const jsonResponse = await response.json();
    const rawText = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
        const finishReason = jsonResponse.candidates?.[0]?.finishReason;
        if (finishReason === "SAFETY") {
            throw new Error("Google blocked this image because it triggered safety filters.");
        }
        throw new Error("Unexpected response structure from model: " + JSON.stringify(jsonResponse));
    }

    // Parse and return the structural JSON results
    const parsedData = JSON.parse(rawText);
    
    // Ensure regions are sorted by reading order index
    if (parsedData.regions) {
        parsedData.regions.sort((a, b) => a.order - b.order);
    }

    return parsedData;
}
