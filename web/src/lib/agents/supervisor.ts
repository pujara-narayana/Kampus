import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ScrapingState, ScrapingStateAnnotation } from "./state";
import { nvolveuAgent } from "./nvolveu_agent";
import { canvasAgent } from "./canvas_agent";
import { myredAgent } from "./myred_agent";
import { closeBrowser } from "./browser-tools";

/**
 * Supervisor Agent Node
 * Analyzes the user's goal and decides which specific platform agent to delegate the scraping task to.
 */
async function supervisorNode(state: ScrapingState): Promise<Partial<ScrapingState>> {
    console.log("[Supervisor Agent] Analyzing goal:", state.goal);

    const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0 });
    const prompt = `You are a strict supervisor orchestrating web scraping agents for UNL campus life.
Goal: ${state.goal}

Which platform needs to be scraped to achieve this goal?
Respond ONLY with one exact word: 'canvas', 'myred', or 'nvolveu'. Do not include quotes or code blocks.
- 'canvas' -> courses, assignments, grades, syllabus
- 'myred' -> enrollment schedule, class times, financial aid, enrollment holds
- 'nvolveu' -> public campus events, clubs, free food, student RSOs`;

    const response = await llm.invoke([new HumanMessage(prompt)]);
    const decision = (response.content as string).trim().toLowerCase();

    console.log(`[Supervisor Agent] Decision routed to: ${decision}`);

    if (["canvas", "myred", "nvolveu"].includes(decision)) {
        return { platform: decision as any, status: "in_progress" };
    } else {
        return { platform: null, status: "error", errorMessage: "Supervisor could not determine the target platform." };
    }
}

/**
 * Cleanup Node
 * Crucial to run at the end to ensure the Playwright headless browser process closes safely.
 */
async function cleanupNode(state: ScrapingState): Promise<Partial<ScrapingState>> {
    await closeBrowser();
    return {};
}

/**
 * Route function based on supervisor decision
 */
function routePlatform(state: ScrapingState) {
    if (state.status === "error") return "cleanup";
    if (state.platform === "canvas") return "canvas";
    if (state.platform === "myred") return "myred";
    if (state.platform === "nvolveu") return "nvolveu";
    return "cleanup";
}

// ---------------------------------------------------------------------------
// Build the Compilable Graph
// ---------------------------------------------------------------------------

export const scrapingGraph = new StateGraph(ScrapingStateAnnotation)
    .addNode("supervisor", supervisorNode)
    .addNode("nvolveu", nvolveuAgent)
    .addNode("canvas", canvasAgent)
    .addNode("myred", myredAgent)
    .addNode("cleanup", cleanupNode)

    // Edge logic
    .addEdge(START, "supervisor")
    .addConditionalEdges("supervisor", routePlatform)

    // All platform scrapers ultimately converge to cleanup browser resources
    .addEdge("nvolveu", "cleanup")
    .addEdge("canvas", "cleanup")
    .addEdge("myred", "cleanup")
    .addEdge("cleanup", END);

// Export the compiled, runnable agent graph
export const multiAgentScraper = scrapingGraph.compile();
