/**
 * Vision Comparison Service
 * 
 * Sends two image URLs to Google Gemini Vision API (or OpenAI as fallback)
 * to get real AI-powered difference detection between inspection photos.
 * 
 * Returns a list of detected differences with descriptions
 * and approximate bounding-box locations as percentages.
 */

// ──── CONFIGURATION ────────────────────────────────────────────────────────
// Set your API key here. You can get one from:
// Google Gemini: https://aistudio.google.com/app/apikey
// OpenAI:       https://platform.openai.com/api-keys

const GEMINI_API_KEY = ''; // <-- Paste your Gemini API key here
const OPENAI_API_KEY = ''; // <-- Or paste your OpenAI API key here (fallback)

// ──── TYPES ────────────────────────────────────────────────────────────────

export interface DetectedDifference {
    id: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    /** Approximate position as percentage of image (0-100) */
    xPercent: number;
    yPercent: number;
}

export interface ComparisonResult {
    success: boolean;
    differences: DetectedDifference[];
    summary: string;
    error?: string;
}

// ──── HELPERS ──────────────────────────────────────────────────────────────

const fetchImageAsBase64 = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.error('Failed to fetch image as base64:', err);
        throw err;
    }
};

// ──── GEMINI VISION ────────────────────────────────────────────────────────

const compareWithGemini = async (
    beforeUrl: string,
    afterUrl: string
): Promise<ComparisonResult> => {
    try {
        const [beforeBase64, afterBase64] = await Promise.all([
            fetchImageAsBase64(beforeUrl),
            fetchImageAsBase64(afterUrl),
        ]);

        const prompt = `You are a vehicle / asset inspection AI. Compare these two inspection photos of the SAME asset taken at different times.

Image 1 is the PREVIOUS inspection (before).
Image 2 is the CURRENT inspection (after).

Identify ALL visible differences between the two photos. For each difference found:
1. Describe what changed (e.g., new scratch, dent, sticker added, paint damage, new marking)
2. Rate severity: "low" (cosmetic), "medium" (noticeable damage), "high" (significant damage)
3. Estimate the approximate position as x and y percentages (0-100) from top-left corner

Respond ONLY with valid JSON in this exact format:
{
  "summary": "Brief overall summary of changes found",
  "differences": [
    {
      "description": "Description of the difference",
      "severity": "low|medium|high",
      "xPercent": 50,
      "yPercent": 30
    }
  ]
}

If no differences are found, return an empty differences array with an appropriate summary.`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: 'image/jpeg',
                                    data: beforeBase64
                                }
                            },
                            {
                                inline_data: {
                                    mime_type: 'image/jpeg',
                                    data: afterBase64
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 2048,
                    }
                }),
            }
        );

        const data = await response.json();
        console.log('Gemini raw response:', JSON.stringify(data).substring(0, 500));

        if (data.error) {
            return { success: false, differences: [], summary: '', error: data.error.message };
        }

        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Extract JSON from the response (may be wrapped in markdown code block)
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { success: false, differences: [], summary: textContent, error: 'Could not parse AI response' };
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const differences: DetectedDifference[] = (parsed.differences || []).map(
            (d: any, idx: number) => ({
                id: `ai_${idx + 1}`,
                description: d.description || 'Unnamed difference',
                severity: d.severity || 'medium',
                xPercent: Math.max(0, Math.min(100, d.xPercent || 50)),
                yPercent: Math.max(0, Math.min(100, d.yPercent || 50)),
            })
        );

        return {
            success: true,
            differences,
            summary: parsed.summary || `Found ${differences.length} difference(s)`,
        };

    } catch (err: any) {
        console.error('Gemini comparison error:', err);
        return {
            success: false,
            differences: [],
            summary: '',
            error: err.message || 'Gemini API call failed',
        };
    }
};

// ──── OPENAI VISION ────────────────────────────────────────────────────────

const compareWithOpenAI = async (
    beforeUrl: string,
    afterUrl: string
): Promise<ComparisonResult> => {
    try {
        const prompt = `You are a vehicle / asset inspection AI. Compare these two inspection photos of the SAME asset taken at different times.

Image 1 is the PREVIOUS inspection.
Image 2 is the CURRENT inspection.

Identify ALL visible differences. For each:
1. Describe the change
2. Rate severity: "low", "medium", or "high"
3. Estimate position as x and y percentages (0-100) from top-left

Respond ONLY with JSON:
{
  "summary": "Brief summary",
  "differences": [{ "description": "...", "severity": "low|medium|high", "xPercent": 50, "yPercent": 30 }]
}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            { type: 'image_url', image_url: { url: beforeUrl, detail: 'high' } },
                            { type: 'image_url', image_url: { url: afterUrl, detail: 'high' } },
                        ],
                    },
                ],
                max_tokens: 2048,
                temperature: 0.2,
            }),
        });

        const data = await response.json();

        if (data.error) {
            return { success: false, differences: [], summary: '', error: data.error.message };
        }

        const textContent = data.choices?.[0]?.message?.content || '';
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { success: false, differences: [], summary: textContent, error: 'Could not parse AI response' };
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const differences: DetectedDifference[] = (parsed.differences || []).map(
            (d: any, idx: number) => ({
                id: `ai_${idx + 1}`,
                description: d.description || 'Unnamed difference',
                severity: d.severity || 'medium',
                xPercent: Math.max(0, Math.min(100, d.xPercent || 50)),
                yPercent: Math.max(0, Math.min(100, d.yPercent || 50)),
            })
        );

        return {
            success: true,
            differences,
            summary: parsed.summary || `Found ${differences.length} difference(s)`,
        };

    } catch (err: any) {
        console.error('OpenAI comparison error:', err);
        return {
            success: false,
            differences: [],
            summary: '',
            error: err.message || 'OpenAI API call failed',
        };
    }
};

// ──── PUBLIC API ────────────────────────────────────────────────────────────

export const visionComparisonService = {
    /**
     * Compare two photos using real AI vision.
     * Tries Gemini first, falls back to OpenAI.
     */
    async comparePhotos(beforeUrl: string, afterUrl: string): Promise<ComparisonResult> {
        // Prefer Gemini if key is set
        if (GEMINI_API_KEY) {
            console.log('Vision: Using Gemini API for comparison...');
            return compareWithGemini(beforeUrl, afterUrl);
        }

        // Fall back to OpenAI if key is set
        if (OPENAI_API_KEY) {
            console.log('Vision: Using OpenAI API for comparison...');
            return compareWithOpenAI(beforeUrl, afterUrl);
        }

        // No API key configured
        return {
            success: false,
            differences: [],
            summary: '',
            error: 'No AI API key configured. Please add a Gemini or OpenAI API key in visionComparisonService.ts',
        };
    },

    /** Check if an API key is configured */
    isConfigured(): boolean {
        return !!(GEMINI_API_KEY || OPENAI_API_KEY);
    },
};
