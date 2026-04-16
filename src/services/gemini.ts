import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AdAnalysis {
  headline: string;
  offer: string;
  targetPersona: string;
  emotionalTone: string;
  cta: string;
  designSystem: {
    colors: string[]; // Hex codes
    fontStyle: "Serif" | "Sans-serif";
    vibe: string; // e.g., Minimalist, Bold, Corporate
  };
}

export interface PageStructure {
  title: string;
  brandName: string;
  images: string[];
  sections: Array<{
    id: string;
    type: string; // e.g., navbar, hero_section, product_grid, social_proof
    content: any;
  }>;
}

export interface PersonalizedCode {
  code: string;
  explanation: string;
}

export async function analyzeAd(input: { image?: string; text?: string }): Promise<AdAnalysis> {
  const prompt = `Analyze this ad creative and extract:
- Primary message/headline (Hook) - MUST be plain text, NO HTML tags.
- Offer (discount, value prop, urgency) - MUST be plain text, NO HTML tags.
- Target persona
- Emotional tone
- Call to Action (CTA) text - MUST be plain text, NO HTML tags.
- Visual Audit:
  - Color Palette (return 3-5 primary hex codes)
  - Font Style (Serif or Sans-serif)
  - Vibe (e.g., Minimalist, Bold, Corporate, Playful)

IMPORTANT: Do not include any HTML tags, markdown formatting, or code blocks in the headline, offer, or cta fields. Return only the raw text content.

Return the result in structured JSON format.`;

  const contents: any[] = [{ text: prompt }];
  if (input.image) {
    contents.push({
      inlineData: {
        mimeType: "image/png",
        data: input.image.split(",")[1] || input.image,
      },
    });
  } else if (input.text) {
    contents.push({ text: `Ad Content: ${input.text}` });
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts: contents },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING },
          offer: { type: Type.STRING },
          targetPersona: { type: Type.STRING },
          emotionalTone: { type: Type.STRING },
          cta: { type: Type.STRING },
          designSystem: {
            type: Type.OBJECT,
            properties: {
              colors: { type: Type.ARRAY, items: { type: Type.STRING } },
              fontStyle: { type: Type.STRING, enum: ["Serif", "Sans-serif"] },
              vibe: { type: Type.STRING },
            },
            required: ["colors", "fontStyle", "vibe"],
          },
        },
        required: ["headline", "offer", "targetPersona", "emotionalTone", "cta", "designSystem"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function generatePersonalizedCode(adData: AdAnalysis, pageStructure: PageStructure): Promise<PersonalizedCode> {
  const prompt = `You are a Senior Frontend Engineer and CRO expert.
Your task is to rewrite the React + Tailwind CSS code for a landing page based on a structural analysis and an ad creative's design system.

STEP 1: SKELETON (Structure)
${JSON.stringify(pageStructure, null, 2)}

STEP 2: SKIN (Ad Design System & Content)
${JSON.stringify(adData, null, 2)}

STEP 3: THE BUILD (Personalization Logic)
1. Rewrite the HTML/CSS (React/Tailwind) for the entire page.
2. Replace the original Hero content with the Ad's headline, offer, and CTA.
3. Update the styling (colors, fonts) to match the Ad's design system. Use the ad's primary color for buttons and accents.
4. Inject the Ad's specific offer into relevant sections (e.g., promo bars, feature highlights).
5. USE THE BRAND NAME: "${pageStructure.brandName}" in the navbar and footer.
6. USE THE SCRAPED IMAGES: Use the following image URLs: ${pageStructure.images.join(", ")}.
7. IMAGE FITTING: Ensure all images use 'object-cover' and are contained within divs with fixed aspect ratios or heights to ensure they fit perfectly without distortion.
8. Ensure the code is production-ready, clean, and uses Tailwind utility classes.

Output:
- A complete React component code block.
- A brief explanation of the personalization choices.

Return in JSON format with 'code' and 'explanation' fields.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: ["code", "explanation"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}
