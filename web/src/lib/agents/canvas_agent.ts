import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ScrapingState } from "./state";
import { browserNavigate, browserGetContent, browserType, browserClick, browserWait, getBrowserPage } from "./browser-tools";

const CANVAS_URL = "https://canvas.unl.edu/";

/**
 * Handle UNL TrueYou Login and Duo 2FA Pause
 */
async function performTrueYouLogin(nuid: string, pass: string) {
    const page = await getBrowserPage();
    const url = page.url();

    if (url.includes("trueyou.nebraska.edu")) {
        console.log("[Canvas Agent] Detected TrueYou login page. Attempting login...");

        await browserType("input[name='j_username']", nuid);
        await browserType("input[name='j_password']", pass);
        await browserClick("button[type='submit']");

        console.log("[Canvas Agent] Sent credentials. Waiting for Duo MFA approval...");

        // Crucial step: The agent must pause and wait for the user to open their phone
        // and click "Approve" on the Duo push. There is no way to automate this.
        // Wait up to 60 seconds for the URL to leave the Duo/TrueYou domain.
        try {
            await page.waitForTimeout(10000); // Give Duo time to send push
            await page.waitForURL(/canvas\.unl\.edu/, { timeout: 60000 });
            console.log("[Canvas Agent] Duo Push approved! Arrived at Canvas.");
        } catch (e) {
            throw new Error("Duo MFA timed out. The push was not approved on the user's phone in time.");
        }
    }
}

/**
 * Canvas Agent Node
 */
export async function canvasAgent(state: ScrapingState): Promise<Partial<ScrapingState>> {
    console.log("[Canvas Agent] Starting execution...");

    try {
        // 0. The goal message from the user *must* contain their NUID and pass in this demo 
        // pattern: NUID:12345678 PASS:mypassword
        const goal = state.goal || "";
        const nuidMatch = goal.match(/NUID:\s*(\d{8})/i);
        const passMatch = goal.match(/PASS:\s*(\S+)/i);

        if (!nuidMatch || !passMatch) {
            return { status: "error", errorMessage: "Missing NUID or PASS in the goal string for Canvas auth." };
        }

        // 1. Navigate to Canvas (which redirects to TrueYou)
        await browserNavigate(CANVAS_URL);

        // 2. Perform TrueYou Login & wait for Duo
        await performTrueYouLogin(nuidMatch[1], passMatch[1]);

        // 3. We are now on the Canvas dashboard. Extract compressed HTML.
        await browserWait(5000); // Wait for courses to load in React
        const html = await browserGetContent();

        // 4. Ask GPT-4o-mini to extract structured data
        const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0.1 });
        console.log("[Canvas Agent] Sending Dashboard HTML to LLM for extraction...");

        const prompt = `You are a web scraper extracting courses from a Canvas LMS HTML dump.
HTML Dump:
${html.substring(0, 80000)}

Extract all visible active courses.
Return ONLY a JSON object matching this TypeScript interface exactly:
{
  "courses": Array<{
    "name": string; // e.g., "Software Engineering"
    "code": string; // e.g., "CSCE 361"
    "term": string; // e.g., "Spring 2026"
  }>
}`;

        const response = await llm.invoke([
            new SystemMessage("You are a structured data extraction AI."),
            new HumanMessage(prompt)
        ]);

        // Parse output
        let extracted: any = [];
        try {
            const text = response.content as string;
            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}') + 1;
            const cleanJson = text.substring(jsonStart, jsonEnd);
            extracted = JSON.parse(cleanJson).courses || [];
        } catch (e) {
            console.error("[Canvas Agent] Failed to parse LLM output:", e);
            return { status: "error", errorMessage: "LLM output was not valid JSON." };
        }

        console.log(`[Canvas Agent] Successfully extracted ${extracted.length} courses.`);

        return {
            extractedData: { type: "courses", data: extracted },
            status: "success"
        };

    } catch (err: any) {
        console.error("[Canvas Agent] Error:", err);
        return {
            status: "error",
            errorMessage: err.message || "Unknown error occurred"
        };
    }
}
