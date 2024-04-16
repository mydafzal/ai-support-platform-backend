const { AgentExecutor, createOpenAIToolsAgent } = require("langchain/agents");
const {
  ChatPromptTemplate,
  MessagesPlaceholder,
} = require("@langchain/core/prompts");
const { StringOutputParser } = require("@langchain/core/output_parsers");

async function createAgent({ llm, tools, systemPrompt }) {
  let prompt;

  if (tools?.length < 1) {
    prompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      new MessagesPlaceholder("messages"),
    ]);

    return prompt.pipe(llm).pipe(new StringOutputParser());
  }

  prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    new MessagesPlaceholder("messages"),
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const agent = await createOpenAIToolsAgent({ llm, tools, prompt });
  return new AgentExecutor({ agent, tools });
}

module.exports = { createAgent };
