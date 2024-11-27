"use server";

import { DataAPIClient } from "@datastax/astra-db-ts";
import {
	Browser,
	Page,
	PuppeteerWebBaseLoader,
} from "@langchain/community/document_loaders/web/puppeteer";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { GoogleGenerativeAI } from "@google/generative-ai";

type similarity = "cosine" | "dot_product" | "euclidean";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

const client = new DataAPIClient(process.env.ASTRA_DB_API_TOKEN!);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT!, {
	namespace: process.env.ASTRA_DB_DATABASE_NAMESPACE!,
});

const splitter = new RecursiveCharacterTextSplitter({
	chunkSize: 512,
	chunkOverlap: 128,
});

const createCollection = async (similarity: similarity = "dot_product") => {
	try {
		const res = await db.createCollection(
			process.env.ASTRA_DB_DATABASE_COLLECTION!,
			{
				vector: {
					dimension: 768,
					metric: similarity,
				},
			}
		);
		console.log("Collection created:", res);
		return res;
	} catch (error) {
		console.error("Error creating collection:", error);
		throw error;
	}
};

const validateOrCreateCollection = async () => {
	try {
		const collection = await db.collection(
			process.env.ASTRA_DB_DATABASE_COLLECTION!
		);
		await collection.find(null, { limit: 1 }).toArray();
		console.log("Collection validated.");
	} catch (error) {
		console.log("Collection does not exist; creating...");
		await createCollection();
	}
};

export const loadData = async (urls: string[]) => {
	try {
		await validateOrCreateCollection();

		const collection = await db.collection(
			process.env.ASTRA_DB_DATABASE_COLLECTION!
		);

		for (const url of urls) {
			const content = await scrapeWebsite(url);
			const textContent = content.join(" ");
			const chunks = await splitter.splitText(textContent);

			for (const chunk of chunks) {
				const embeddingResponse = await embedModel.embedContent(chunk);
				const vector = embeddingResponse.embedding.values;

				if (vector.length !== 768) {
					throw new Error("Invalid embedding dimension from Gemini");
				}

				const res = await collection.insertOne({
					$vector: vector,
					text: chunk,
					url: url,
					timestamp: new Date().toISOString(),
				});

				console.log("Inserted chunk:", res);
			}
		}

		return { success: true, message: "Data loaded successfully" };
	} catch (error) {
		console.error("Error loading data:", error);
		throw error;
	}
};

export const scrapeWebsite = async (url: string) => {
	try {
		const loader = new PuppeteerWebBaseLoader(url, {
			launchOptions: {
				headless: true,
			},
			gotoOptions: {
				waitUntil: "domcontentloaded",
				timeout: 60000,
			},
			evaluate: async (page: Page, browser: Browser) => {
				const result = await page.evaluate(() => {
					return document.body.innerText;
				});
				await browser.close();
				return result;
			},
		});

		const docs = await loader.load();
		return docs.map((doc) => doc.pageContent.replace(/<[^>]*>?/g, ""));
	} catch (error) {
		console.error("Error scraping website:", error);
		throw error;
	}
};
