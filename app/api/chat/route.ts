import { DataAPIClient } from "@datastax/astra-db-ts";
import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";

const requiredEnvVars = [
	"OPENAI",
	"ASTRA_DB_API_TOKEN",
	"ASTRA_DB_API_ENDPOINT",
	"ASTRA_DB_DATABASE_NAMESPACE",
	"ASTRA_DB_DATABASE_COLLECTION",
];

for (const envVar of requiredEnvVars) {
	if (!process.env[envVar]) {
		throw new Error(`Missing required environment variable: ${envVar}`);
	}
}

const openai = new OpenAI({
	apiKey: process.env.OPENAI,
});

const client = new DataAPIClient(process.env.ASTRA_DB_API_TOKEN!);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT!, {
	namespace: process.env.ASTRA_DB_DATABASE_NAMESPACE,
});

export async function POST(req: Request) {
	try {
		const { messages } = await req.json();

		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return new Response("Invalid messages format", { status: 400 });
		}

		const latestMessage = messages[messages.length - 1].content as string;

		if (!latestMessage) {
			return new Response("Empty message content", { status: 400 });
		}

		const embedding = await openai.embeddings.create({
			model: "text-embedding-3-small",
			input: latestMessage,
			encoding_format: "float",
		});

		let docContext = "";

		try {
			const collection = await db.collection(
				process.env.ASTRA_DB_DATABASE_COLLECTION!
			);
			const results = await collection.find(null, {
				sort: {
					$vector: embedding.data[0].embedding,
				},
				limit: 10,
			});

			const documents = await results.toArray();
			const context = documents.map((doc) => doc.text);
			docContext = JSON.stringify(context);
			console.log(context);
		} catch (error) {
			console.error("Error fetching data from Astra DB:", error);
			return new Response("Error accessing knowledge base", { status: 500 });
		}

		const systemMessage: OpenAI.Chat.ChatCompletionMessageParam = {
			role: "system",
			content: `You are a knowledgeable assistant who provides clear and accurate responses. 
		
		Context information:
		${docContext}
		
		Please use the context above to help answer this question:
		${latestMessage}
		
		Guidelines:
		- Focus on providing relevant information from the context
		- Give clear short and concise answers
		- Do not include any images in your response
		- If the context doesn't contain relevant information, say so`,
		};

		const response = await openai.chat.completions.create({
			model: "gpt-4-turbo-preview",
			stream: true,
			messages: [systemMessage, ...messages],
		});

		const stream = OpenAIStream(response);
		return new StreamingTextResponse(stream);
	} catch (error) {
		console.error("Error in Chat:", error);
		return new Response("Error processing chat request", { status: 500 });
	}
}
