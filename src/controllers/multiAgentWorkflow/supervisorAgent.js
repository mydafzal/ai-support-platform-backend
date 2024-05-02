const {
  ChatPromptTemplate,
  MessagesPlaceholder,
} = require("@langchain/core/prompts");
const { ChatOpenAI } = require("@langchain/openai");
const { JsonOutputToolsParser } = require("langchain/output_parsers");

async function createSupervisorChain(members, systemPrompt) {
  const options = ["FINISH", ...members];

  const functionDef = {
    name: "route",
    description: "Select the next role.",
    parameters: {
      title: "routeSchema",
      type: "object",
      properties: {
        next: {
          title: "Next",
          anyOf: [{ enum: options }],
        },
      },
      required: ["next"],
    },
  };

  const toolDef = {
    type: "function",
    function: functionDef,
  };

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    new MessagesPlaceholder("messages"),
    [
      "system",
      `Given the conversation above, who should act next? If the last response you received is from one of {members}, respond with FINISH. If the input is from the human, select one of: {members}`,
    ],
  ]);

  const formattedPrompt = await prompt.partial({
    members: members.join(", "),
  });

  const llm = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    temperature: 0,
  });

  const supervisorChain = formattedPrompt
    .pipe(
      llm.bind({
        tools: [toolDef],
        tool_choice: { type: "function", function: { name: "route" } },
      })
    )
    .pipe(new JsonOutputToolsParser())
    .pipe((x) => x[0].args);

  return supervisorChain;
}

module.exports = {
  createSupervisorChain,
};
