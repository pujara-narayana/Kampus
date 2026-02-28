import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ScrapingState } from "./state";
import { browserNavigate, browserGetContent, browserType, browserClick, browserWait, getBrowserPage } from "./browser-tools";

const MYRED_SCHEDULE_URL = "https://myred.nebraska.edu/psp/myred/NBL/HRMS/c/SA_LEARNER_SERVICES.SSR_SSENRL_SCHD_W.GBL?Page=SSR_SS_WEEK";

/**
 * Handle UNL TrueYou Login and Duo 2FA Pause
 */
async function performTrueYouLogin(nuid: string, pass: string) {
    const page = await getBrowserPage();
    const url = page.url();

    if (url.includes("trueyou.nebraska.edu")) {
        console.log("[MyRed Agent] Detected TrueYou login page. Attempting login...");

        await browserType("input[name='j_username']", nuid);
        await browserType("input[name='j_password']", pass);
        await browserClick("button[type='submit']");

        console.log("[MyRed Agent] Sent credentials. Waiting for Duo MFA approval...");

        try {
            await page.waitForTimeout(10000);
            // Wait for the URL to return to the nebraska.edu domain
            await page.waitForURL(/myred\.nebraska\.edu/, { timeout: 60000 });
            console.log("[MyRed Agent] Duo Push approved! Arrived at MyRed.");
        } catch (e) {
            throw new Error("Duo MFA timed out. The push was not approved on the user's phone in time.");
        }
    }
}

/**
 * MyRed Agent Node
 */
export async function myredAgent(state: ScrapingState): Promise<Partial<ScrapingState>> {
    console.log("[MyRed Agent] Starting execution...");

    try {
        const goal = state.goal || "";
        const nuidMatch = goal.match(/NUID:\s*(\d{8})/i);
        const passMatch = goal.match(/PASS:\s*(\S+)/i);

        if (!nuidMatch || !passMatch) {
            return { status: "error", errorMessage: "Missing NUID or PASS in the goal string for MyRed auth." };
        }

        // 1. Navigate to MyRed Schedule (redirects to TrueYou)
        await browserNavigate(MYRED_SCHEDULE_URL);

        // 2. Perform TrueYou Login & wait for Duo
        await performTrueYouLogin(nuidMatch[1], passMatch[1]);

        // 3. We are now on the Banner student schedule view.
        await browserWait(5000);
        const html = await browserGetContent();

        // 4. Ask GPT-4o-mini to extract structured schedule data
        const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0.1 });
        console.log("[MyRed Agent] Sending Schedule HTML to LLM for extraction...");

        const prompt = `You are a web scraper extracting a student's class schedule from a PeopleSoft/Banner HTML dump.
HTML Dump:
${html.substring(0, 80000)}

Extract all classes the student is enrolled in for the current term and their meeting locations/times.
Return ONLY a JSON object matching this TypeScript interface exactly:
{
  "classes": Array<{
    "courseTitle": string;
    "courseCode": string;
    "days": string; // e.g. "MWF", "TTh"
    "startTime": string; // e.g. "10:30AM"
    "endTime": string; // e.g. "11:45AM"
    "building": string;
    "room": string;
    "instructor": string;
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
            extracted = JSON.parse(cleanJson).classes || [];
        } catch (e) {
            console.error("[MyRed Agent] Failed to parse LLM output:", e);
            return { status: "error", errorMessage: "LLM output was not valid JSON." };
        }

        console.log(`[MyRed Agent] Successfully extracted ${extracted.length} classes.`);

        return {
            extractedData: { type: "schedule", data: extracted },
            status: "success"
        };

    } catch (err: any) {
        console.error("[MyRed Agent] Error:", err);
        return {
            status: "error",
            errorMessage: err.message || "Unknown error occurred"
        };
    }
}
