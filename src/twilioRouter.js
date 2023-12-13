const Router = require("express").Router;
const { OpenAI } = require("openai");
const {
  handleTranscription,
  handleReponse,
  handleEmptyRecording,
  handleDial,
} = require("./controller");

const OPENAI_API_KEY = "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";
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const router = Router();

router.post("/incoming-call", async (req, res) => {
  console.log("incoming...........");
  return await handleTranscription(req, res);
});

router.post("/transcribe", async (req, res) => {
  return await handleTranscription(req, res);
});

router.post("/respond", async (req, res) => {
  return await handleReponse(req, res);
});

router.post("/empty-recording", async (req, res) => {
  return await handleEmptyRecording(req, res);
});

router.post("/dial", async (req, res) => {
  console.log("dialingingingi");
  console.log("dialingingingi");
  console.log("dialingingingi");

  return await handleDial(req, res);

  // return await handleEmptyRecording(req, res);
});

router.get("/open-ai", async (req, res) => {
  const conversation = ["Hi, my name is Hammad. I am a Software Developer."];

  const aiResponse = await generateAIResponse(conversation.join(";"));

  const cleanedAiResponse = aiResponse.replace(/^\w+:\s*/i, "").trim();

  // Add the AI's response to the conversation history
  conversation.push(`assistant: ${aiResponse}`);

  console.log("aiResponse");

  res.status(200).send(cleanedAiResponse);
});

// Function to generate the AI response based on the conversation history
async function generateAIResponse(conversation) {
  const messages = formatConversation(conversation);
  return await createChatCompletion(messages);
}

// Function to create a chat completion using the OpenAI API
async function createChatCompletion(messages) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.8,
      max_tokens: 100,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    // Check if the error is a timeout error
    console.log("createChatCompletion error", error);
  }
}

// Function to format the conversation history into a format that the OpenAI API can understand
function formatConversation(conversation) {
  let isAI = true;

  const messages = [
    {
      role: "system",
      content:
        "You are a creative, funny, friendly and amusing AI assistant named Joanna. Please provide engaging but concise responses.",
    },
    {
      role: "user",
      content:
        "We are having a casual conversation over the telephone so please provide engaging but concise responses.",
    },
  ];

  // Iterate through the conversation history and alternate between 'assistant' and 'user' roles
  for (const message of conversation.split(";")) {
    const role = isAI ? "assistant" : "user";
    messages.push({
      role: role,
      content: message,
    });
    isAI = !isAI;
  }

  return messages;
}

module.exports = router;
