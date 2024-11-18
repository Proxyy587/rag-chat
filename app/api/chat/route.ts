import { DataAPIClient } from "@datastax/astra-db-ts";
import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";

// Initialize OpenAI client
const openai = new OpenAI({
	apiKey: process.env.OPENAI,
});

// Initialize Astra DB client
const client = new DataAPIClient(process.env.ASTRA_DB_API_TOKEN || "");
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT || "", {
	namespace: process.env.ASTRA_DB_DATABASE_NAMESPACE,
});

export async function POST(req: Request) {
	try {
		const { messages } = await req.json();
		const latestMessage = messages[messages.length - 1].content as string;

		const embedding = await openai.embeddings.create({
			model: "text-embedding-3-small",
			input: latestMessage,
			encoding_format: "float",
		});

		let docContext = "";

		try {
			const collection = await db.collection(
				process.env.ASTRA_DB_DATABASE_COLLECTION || ""
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
