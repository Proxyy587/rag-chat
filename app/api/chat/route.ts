import { DataAPIClient } from "@datastax/astra-db-ts";
import {
	GenerateContentResult,
	GoogleGenerativeAI,
} from "@google/generative-ai";
import { EventEmitter } from "events";
import { GoogleGenerativeAIStream, StreamingTextResponse } from "ai";

// Required environment variables
const requiredEnvVars = [
	"GEMINI_API_KEY",
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

// Initialize Google Generative AI and Astra DB
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

const client = new DataAPIClient(process.env.ASTRA_DB_API_TOKEN!);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT!, {
	namespace: process.env.ASTRA_DB_DATABASE_NAMESPACE!,
});

// Increase default max listeners
EventEmitter.defaultMaxListeners = 20;

export async function POST(req: Request) {
	try {
		if (!req.body) {
			return new Response("Request body is required", { status: 400 });
		}

		const { messages } = await req.json();

		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return new Response("Invalid messages format", { status: 400 });
		}

		const latestMessage = messages[messages.length - 1].content as string;

		if (!latestMessage) {
			return new Response("Empty message content", { status: 400 });
		}

		let embedding: number[];
		try {
			const embeddingResponse = await embedModel.embedContent(latestMessage);
			embedding = embeddingResponse.embedding.values;

			if (embedding.length !== 768) {
				throw new Error("Invalid embedding dimension from Gemini");
			}
		} catch (error) {
			console.error("Error generating embeddings:", error);
			return new Response("Error generating embeddings", { status: 500 });
		}

		let docContext = "";

		try {
			const collection = await db.collection(
				process.env.ASTRA_DB_DATABASE_COLLECTION!
			);
			const results = await collection.find(null, {
				sort: { $vector: embedding },
				limit: 10,
			});
			const documents = await results.toArray();
			const context = documents.map((doc) => doc.text);
			docContext = context.join("\n");
		} catch (error) {
			console.error("Error fetching data from Astra DB:", error);
			return new Response("Error accessing knowledge base", { status: 500 });
		}

		const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
		const chat = model.startChat();

		try {
			const systemPrompt = `You are a knowledgeable assistant who provides clear and accurate responses. 
                    
    Context information:
    ${docContext}
    
    Please use the context above to help answer this question:
    ${latestMessage}
    
    Guidelines:
    - Focus on providing relevant information from the context
    - Give clear short and concise answers
    - If the context doesn't contain relevant information, say so.`;

			const response = await chat.sendMessage(systemPrompt);
			if (!response.response) {
				throw new Error("Failed to get response from Gemini");
			}
			// @ts-ignore
			const stream = GoogleGenerativeAIStream(response);
			return new StreamingTextResponse(stream);
		} catch (error) {
			console.error("Error during chat response:", error);
			if (error instanceof Error) {
				return new Response(error.message, { status: 500 });
			}
			return new Response("Error processing chat response", { status: 500 });
		}
	} catch (error) {
		console.error("Error in Chat:", error);
		return new Response(
			error instanceof Error ? error.message : "Error processing chat request",
			{ status: 500 }
		);
	}
}
