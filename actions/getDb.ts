"use server";

import { DataAPIClient } from "@datastax/astra-db-ts";
import {
	Browser,
	Page,
	PuppeteerWebBaseLoader,
} from "@langchain/community/document_loaders/web/puppeteer";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import OpenAI from "openai";

type similarity = "cosine" | "dot_product" | "euclidean";

// Check required environment variables
const requiredEnvVars = [
	"GEMINI_API_KEY",
	"ASTRA_DB_API_TOKEN", 
	"ASTRA_DB_API_ENDPOINT",
	"ASTRA_DB_DATABASE_NAMESPACE",
	"ASTRA_DB_DATABASE_COLLECTION"
];

for (const envVar of requiredEnvVars) {
	if (!process.env[envVar]) {
		throw new Error(`Missing required environment variable: ${envVar}`);
	}
}

const openai = new OpenAI({
	apiKey: process.env.GEMINI_API_KEY,
	baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

const client = new DataAPIClient(process.env.ASTRA_DB_API_TOKEN);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT, {
	namespace: process.env.ASTRA_DB_DATABASE_NAMESPACE,
});

const splitter = new RecursiveCharacterTextSplitter({
	chunkSize: 512,
	chunkOverlap: 128,
});

export const createCollection = async (
	similarity: similarity = "dot_product"
) => {
	try {
		const res = await db.createCollection(
			process.env.ASTRA_DB_DATABASE_COLLECTION,
			{
				vector: {
					dimension: 768,
					metric: similarity,
				},
			}
		);
		console.log(res);
		return res;
	} catch (error) {
		console.error("Error creating collection:", error);
		throw error;
	}
};

export const loadData = async (urls: string[]) => {
	if (!urls || urls.length === 0) {
		throw new Error("No URLs provided");
	}

	try {
		let collection;
		try {
			collection = await db.collection(
				process.env.ASTRA_DB_DATABASE_COLLECTION
			);
			await collection.find(null, { limit: 1 }).toArray();
		} catch (error) {
			await createCollection();
			collection = await db.collection(
				process.env.ASTRA_DB_DATABASE_COLLECTION
			);
		}

		for (const url of urls) {
			if (!url) continue;

			const content = await scrapeWebsite(url);
			const textContent = content.join(" ");
			const chunks = await splitter.splitText(textContent);

			for (const chunk of chunks) {
				const embedding = await openai.embeddings.create({
					input: chunk,
					model: "text-embedding-004",
					encoding_format: "float",
				});

				const vector = embedding.data[0].embedding;

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
	if (!url) {
		throw new Error("No URL provided");
	}

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
