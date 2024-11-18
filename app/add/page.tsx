"use client";

import { useState } from "react";
import { loadData } from "@/actions/getDb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { HomeIcon, PlusIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AddKnowledge() {
	const [urls, setUrls] = useState<string[]>([]);
	const [currentUrl, setCurrentUrl] = useState("");
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");

	const handleAddUrl = (e: React.FormEvent) => {
		e.preventDefault();
		if (currentUrl && !urls.includes(currentUrl)) {
			setUrls([...urls, currentUrl]);
			setCurrentUrl("");
		}
	};

	const handleRemoveUrl = (urlToRemove: string) => {
		setUrls(urls.filter((url) => url !== urlToRemove));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (urls.length === 0) {
			setMessage("Please add at least one URL");
			return;
		}
		setLoading(true);
		setMessage("");

		try {
			await loadData(urls);
			setMessage("Knowledge base updated successfully!");
			setUrls([]);
		} catch (error) {
			setMessage("Error updating knowledge base. Please try again.");
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4">
			<div className="max-w-md mx-auto pt-8">
				<div className="mb-6 flex justify-between items-center">
					<Link href="/">
						<Button variant="ghost" size="icon">
							<HomeIcon className="h-5 w-5" />
						</Button>
					</Link>
				</div>

				<Card className="bg-zinc-900">
					<CardHeader>
						<CardTitle>Add Knowledge</CardTitle>
						<CardDescription>
							I have already added abhijee.com and lakshb.dev so add any other
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-4">
						<form onSubmit={handleAddUrl} className="space-y-4">
							<div className="flex gap-2">
								<Input
									type="url"
									value={currentUrl}
									onChange={(e) => setCurrentUrl(e.target.value)}
									placeholder="https://example.com"
									disabled={loading}
								/>
								<Button type="submit" disabled={loading}>
									<PlusIcon className="h-4 w-4" />
								</Button>
							</div>
						</form>

						{urls.length > 0 && (
							<div className="space-y-4">
								<div className="space-y-2">
									{urls.map((url, index) => (
										<div
											key={index}
											className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 p-2 rounded-md"
										>
											<span className="truncate text-sm">{url}</span>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleRemoveUrl(url)}
												disabled={loading}
											>
												<XIcon className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>
								<Button
									onClick={handleSubmit}
									disabled={loading}
									className="w-full"
									variant="default"
								>
									{loading ? "Processing..." : "Process All URLs"}
								</Button>
							</div>
						)}

						{message && (
							<Alert>
								<AlertDescription>{message}</AlertDescription>
							</Alert>
						)}
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
