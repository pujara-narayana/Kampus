import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ScrapingState } from "./state";
import { browserNavigate, browserGetContent, browserWait } from "./browser-tools";

const EVENTS_URL = "https://unl.campuslabs.com/engage/events";

/**
 * NvolveU Agent Node
 * Navigates to the events portal, reads the DOM, and extracts event data into structured JSON.
 */
export async function nvolveuAgent(state: ScrapingState): Promise<Partial<ScrapingState>> {
    console.log("[NvolveU Agent] Starting execution...");

    try {
        // 1. Navigate to the public events page
        await browserNavigate(EVENTS_URL);

        // NvolveU is an SPA, wait a moment for the initial events to load
        await browserWait(3000);

        // 2. Extract compressed HTML
        const html = await browserGetContent();

        // 3. Ask GPT-4o-mini to extract structured data
        const llm = new ChatOpenAI({
            modelName: "gpt-4o-mini",
            temperature: 0.1
        });

        console.log("[NvolveU Agent] Sending HTML to LLM for extraction...");

        const prompt = `You are a web scraper extracting event data from an HTML dump of UNL's NvolveU (CampusLabs) platform.
    
HTML Dump:
${html.substring(0, 100000)} // Truncate if too large, gpt-4o-mini has a 128k context window

Extract all visible upcoming events. Analyze the text for time, location, title, and organization.
Return ONLY a JSON object matching this TypeScript interface exactly:
{
  "events": Array<{
    "title": string;
    "description": string; // Infer from title/context if missing
    "startTime": string; // ISO-8601 string if possible
    "endTime": string | null;
    "building": string;
    "orgName": string;
  }>
}`;

        const response = await llm.invoke([
            new SystemMessage("You are a structured data extraction AI."),
            new HumanMessage(prompt)
        ]);

        // Parse the JSON output
        let extracted: any = [];
        try {
            const text = response.content as string;
            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}') + 1;
            const cleanJson = text.substring(jsonStart, jsonEnd);
            extracted = JSON.parse(cleanJson).events || [];
        } catch (e) {
            console.error("[NvolveU Agent] Failed to parse LLM output:", e);
            return { status: "error", errorMessage: "LLM output was not valid JSON." };
        }

        console.log(`[NvolveU Agent] Successfully extracted ${extracted.length} events.`);

        return {
            extractedData: extracted,
            status: "success"
        };

    } catch (err: any) {
        console.error("[NvolveU Agent] Error:", err);
        return {
            status: "error",
            errorMessage: err.message || "Unknown error occurred"
        };
    }
}
