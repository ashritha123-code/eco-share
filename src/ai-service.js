/**
 * EcoCircle AI Service
 * Manages communication with Gemini API or falls back to simulated offline mode.
 */

// Keys for local storage
const GEMINI_KEY_STORAGE = 'EcoCircle_gemini_api_key';

export const AIService = {
  /**
   * Retrieves the current Gemini API Key.
   * Priority: LocalStorage config > window.__ENV__ config
   */
  getApiKey: () => {
    const saved = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (saved) return saved;
    
    if (window.__ENV__ && window.__ENV__.GEMINI_API_KEY) {
      return window.__ENV__.GEMINI_API_KEY;
    }
    return '';
  },

  /**
   * Saves the Gemini API key in LocalStorage.
   */
  saveApiKey: (key) => {
    if (key) {
      localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    }
  },

  /**
   * Checks if a live Gemini API key is configured.
   */
  isLive: () => {
    return !!AIService.getApiKey();
  },

  /**
   * Sends a prompt to Gemini API or executes mock fallback if offline.
   */
  askGemini: async (prompt, systemInstruction = '') => {
    const apiKey = AIService.getApiKey();

    if (!apiKey) {
      // Return simulated response
      return AIService.getMockResponse(prompt);
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: (systemInstruction ? `${systemInstruction}\n\n` : '') + prompt }]
          }
        ]
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Empty response received from Gemini.');
      }
      return text;
    } catch (e) {
      console.warn('[AIService] API error, falling back to mock:', e);
      return `[Failed to connect to Gemini live: ${e.message}]\n\nHere is a local estimation:\n\n${AIService.getMockResponse(prompt)}`;
    }
  },

  /**
   * Requests Gemini to describe and categorize an item.
   * Returns a JSON object: { description, category, quantity, co2Offset }
   */
  autoFillResource: async (title) => {
    const systemPrompt = `You are the EcoCircle AI Assistant. Your job is to describe and categorize items shared on a local community sustainability platform.
Given an item title, generate a JSON object representing the item details.
The categories allowed are ONLY: "Food", "Clothes", "Books", "Furniture", "Electronics", "Kitchen Items", "Medical Supplies", "Educational Materials", "Household Items", "Other".
Estimate carbon footprint savings (in kg CO2) from sharing this item instead of buying it new (based on typical lifecycle emissions of the product).

You MUST respond ONLY with a raw JSON object (no markdown formatting, no \`\`\`json blocks) with these exact keys:
{
  "description": "A polite, friendly description of the item including its sustainability benefits (e.g. preventing landfill waste, upcycling suggestions, etc.) and suggested pickup advice.",
  "category": "One of the allowed categories listed above",
  "quantity": "A reasonable default quantity based on the title (e.g. '1 unit', '3 kg', '1 book')",
  "co2Offset": number (estimated offset in kg CO2 as a float or int)
}`;

    const apiKey = AIService.getApiKey();
    if (!apiKey) {
      return AIService.getMockAutoFill(title);
    }

    try {
      const responseText = await AIService.askGemini(title, systemPrompt);
      // Clean up markdown wrapper if any
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        description: parsed.description || 'No description generated.',
        category: parsed.category || 'Other',
        quantity: parsed.quantity || '1 unit',
        co2Offset: parseFloat(parsed.co2Offset) || 0.0
      };
    } catch (e) {
      console.warn('[AIService] Failed to parse AI JSON response, falling back to mock:', e);
      return AIService.getMockAutoFill(title);
    }
  },

  /**
   * Offline mock responder with rich sustainability tips.
   */
  getMockResponse: (prompt) => {
    const p = prompt.toLowerCase();
    
    if (p.includes('compost')) {
      return `🍂 **Home Composting Guide**
Composting is a simple way to recycle organic waste and feed your garden. Here is a quick 3-step setup:

1. **Get a Bin**: A sealed container for food scraps in your kitchen, and a larger box/bin outside.
2. **Layer Green & Brown**: 
   * **Greens (nitrogen)**: Fruit skins, vegetable peels, coffee grounds.
   * **Browns (carbon)**: Dry leaves, cardboard scraps, sawdust. Aim for a 1:2 ratio of greens to browns.
3. **Turn and Moisten**: Aerate with a shovel weekly and ensure it remains damp (like a wrung-out sponge). In 2–3 months, you'll have rich compost soil!

*Simulated response. Add a Gemini API key for dynamic queries!*`;
    }

    if (p.includes('recycle')) {
      return `♻️ **General Recycling Rules & Prep**
Correct recycling reduces contamination in the municipal waste stream:

* **Plastic**: Generally, rigid plastics labeled #1 (PETE) and #2 (HDPE) are accepted everywhere. **Wash thoroughly** before recycling. Leave caps on.
* **Paper & Cardboard**: Ensure cardboard is flattened. Paper with grease (like pizza boxes) goes to **compost**, not recycling!
* **Glass & Metals**: Wash tin cans and glass jars. Labels can usually stay on.
* **Avoid**: Plastic bags, food residue, garden hoses, and batteries (which need special e-waste dropping).

*Simulated response. Add a Gemini API key for dynamic queries!*`;
    }

    if (p.includes('lawnmower') || p.includes('offset') || p.includes('carbon')) {
      return `🌱 **Carbon Footprint Sharing Calculation**
Sharing tools like lawnmowers has a huge environmental impact:

* **Production offset**: Manufacturing an electric/gas lawnmower produces roughly **150 kg of CO2 equivalents**.
* **Shared Use impact**: Sharing 1 lawnmower with 5 neighbors prevents the purchase of 4 additional mowers.
* **Net Offset**: This saves **600 kg of CO2 emissions** from manufacturing, raw material shipping, and electronic waste!
* **Annual offset**: Sharing is equivalent to planting **30 mature trees**!

*Simulated response. Add a Gemini API key for dynamic queries!*`;
    }

    if (p.includes('upcycl') || p.includes('cardboard') || p.includes('jar')) {
      return `🎨 **Creative DIY Upcycling Ideas**
Give waste items a second life:

1. **Cardboard organizers**: Cut shoe boxes and wrap them in leftover wrapping paper or old fabric. Use them to organize desk supplies, socks, or drawers.
2. **Glass jar planters**: Clean pasta sauce glass jars, fill them with pebbles for drainage, soil, and add herb clippings (like basil or mint).
3. **Cardboard seedling pots**: Cut egg cartons or toilet paper rolls, fill with soil, plant seeds. They can be planted directly into the ground later!
4. **Plastic bottle lanterns**: Cut plastic water bottles in half, paint them, insert battery-powered LED tea lights for string lighting.

*Simulated response. Add a Gemini API key for dynamic queries!*`;
    }

    return `✨ **Sustainability Tip**: Did you know that over 30% of household waste is compostable food scraps? Sharing surplus food and tools locally through EcoCircle is one of the most effective ways to lower your neighborhood's carbon footprint!

*This is a simulated AI message. Paste a Gemini API Key under settings to talk directly with the Gemini model!*`;
  },

  /**
   * Offline mock generator for Add Resource form.
   */
  getMockAutoFill: (title) => {
    const t = title.toLowerCase();
    let category = 'Other';
    let description = '';
    let quantity = '1 unit';
    let co2Offset = 1.0;

    if (t.includes('mower') || t.includes('drill') || t.includes('tool') || t.includes('saw') || t.includes('ladder')) {
      category = 'Household Items';
      description = `A sturdy ${title} in good working condition. Great for short-term projects! Please return clean and handle with care. Sharing tools helps reduce neighborhood carbon emissions.`;
      quantity = '1 unit';
      co2Offset = 25.0;
    } else if (t.includes('book') || t.includes('novel') || t.includes('textbook') || t.includes('read')) {
      category = 'Books';
      description = `A copy of "${title}". Good condition, all pages intact. Happy to share with someone looking for a good read or study material! Let's prevent paper waste.`;
      quantity = '1 book';
      co2Offset = 2.5;
    } else if (t.includes('banana') || t.includes('strawberry') || t.includes('food') || t.includes('apple') || t.includes('egg') || t.includes('vegetable')) {
      category = 'Food';
      description = `Fresh ${title}. Surplus from home gardening or recent shopping. Still perfectly fresh and tasty. Please collect soon so it doesn't go to waste!`;
      quantity = '1 pack';
      co2Offset = 1.8;
    } else if (t.includes('shirt') || t.includes('pants') || t.includes('jacket') || t.includes('clothes') || t.includes('coat')) {
      category = 'Clothes';
      description = `Gently used ${title}. Clean and washed. No stains or rips. Size is standard. Ready to go to a new home rather than sit in the closet!`;
      quantity = '1 item';
      co2Offset = 12.0;
    } else if (t.includes('chair') || t.includes('table') || t.includes('desk') || t.includes('shelf') || t.includes('sofa')) {
      category = 'Furniture';
      description = `A comfortable, clean ${title}. Fits nicely in most rooms. Showing light signs of wear but very stable and useful. Perfect for saving landfill space!`;
      quantity = '1 item';
      co2Offset = 45.0;
    } else if (t.includes('phone') || t.includes('charger') || t.includes('cable') || t.includes('tv') || t.includes('keyboard')) {
      category = 'Electronics';
      description = `A functional ${title}. Fully tested and working. Perfect for someone who needs it without buying a brand new electronic device with plastic/metal packaging.`;
      quantity = '1 unit';
      co2Offset = 30.0;
    } else {
      description = `Sharing this ${title} with the local community to promote zero waste. It's clean, operational, and looking for a new home. Reach out to coordinate pickup!`;
      quantity = '1 unit';
      co2Offset = 2.0;
    }

    return { description, category, quantity, co2Offset };
  }
};
