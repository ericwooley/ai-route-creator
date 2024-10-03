import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { RedisCache } from "@langchain/community/caches/ioredis";
import { Redis } from "ioredis";

console.log('Conencting to cache')
const cache = new RedisCache(new Redis({
  host: "localhost",
  port: 6379,
  db: 0,
}));

// Define the tools for the agent to use
const agentTools = [new TavilySearchResults({ maxResults: 20, verbose: true })];
console.log('defining model')
const agentModel = new ChatOpenAI({ temperature: 0, 
  cache: cache,
  model: 'gpt-4o-mini'
 });

// Initialize memory to persist state between graph runs
const agentCheckpointer = new MemorySaver();
export async function runAgent() {
  console.log('running agent')
  const agent = createReactAgent({
    llm: agentModel,
    tools: agentTools,
    checkpointSaver: agentCheckpointer,
  });
  
  // Now it's time to use!
  const agentFinalState = await agent.invoke(
    { messages: [new HumanMessage("What are the top 40 tourist spots on the road to hana? Starting from lahiena")] },
    { configurable: { thread_id: "42" } },
  );
  
  console.log(
    agentFinalState.messages[agentFinalState.messages.length - 1].content,
  );
}
