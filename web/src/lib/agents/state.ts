import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

/**
 * LangGraph State Definition for the Scraping Workflow.
 * This state is passed between the Supervisor, CanvasAgent, MyRedAgent, etc.
 */
export const ScrapingStateAnnotation = Annotation.Root({
    // The goal the user wants to accomplish (e.g. "Scrape my assignments")
    goal: Annotation<string>(),

    // Message history for the LLM to reason over
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
    }),

    // The specific platform target (canvas, myred, nvolveu)
    platform: Annotation<"canvas" | "myred" | "nvolveu" | null>(),

    // Browser State
    currentUrl: Annotation<string | null>(),
    htmlContent: Annotation<string | null>(),

    // Output State: The final structured JSON extracted by the agent
    extractedData: Annotation<any | null>(),

    // Terminal State: Did it succeed or fail?
    status: Annotation<"idle" | "in_progress" | "success" | "error" | "requires_mfa">(),
    errorMessage: Annotation<string | null>(),
});

export type ScrapingState = typeof ScrapingStateAnnotation.State;
