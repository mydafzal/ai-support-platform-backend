const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { ChatOpenAI } = require("@langchain/openai");
const { JsonOutputToolsParser } = require("langchain/output_parsers");

async function createSupervisorChain(members) {
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

  const systemPrompt = `As the Supervisor overseeing the interaction, your role is crucial in directing user queries to the appropriate team member or signaling the end of the interaction. Your responses should be limited to either providing the name of the next agent to handle the query or signaling the completion of the interaction with FINISH. Here's a concise breakdown of each team member's responsibilities:

  1. Answerer: Responsible for starting the conversation, greeting the user, addressing general queries about Cheetah Agency, providing information about the business, and guiding users with initial inquiries.
  2. Meeting Scheduler: Assists users in scheduling meetings with the support staff of Cheetah Agency.
  
  Your instructions are straightforward:
  
  1. If the user explicitly asks or indicates to schedule a meeting or appointment, output "Meeting Scheduler" because "MeetingScheduler" is responsible for handling this process.
  1. Direct every other query to the Answerer. Simply output Answerer.
  3. Upon receiving answer from any of the {members}, respond with FINISH to indicate the end of the interaction.
  
  Your objective is to ensure seamless communication flow and efficient problem resolution within the team. Provide clear and concise instructions to agents while remaining responsive to user needs.`;

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
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
