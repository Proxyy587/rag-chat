"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "ai/react";
import { Message } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { PlusIcon, SendIcon, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
	const { messages, input, handleInputChange, handleSubmit, isLoading } =
		useChat();
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	return (
		<main className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
			<div className="max-w-2xl mx-auto flex flex-col h-screen">
				<nav className="sticky top-0 z-10 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800">
					<div className="px-4 h-14 flex items-center justify-between">
						<h1 className="text-lg font-medium font-mono">RAG:chatme</h1>
						<Link href="/add">
							<Button variant="ghost" size="icon" aria-label="Add Knowledge">
								<PlusIcon className="w-4 h-4" />
							</Button>
						</Link>
					</div>
				</nav>

				<div className="flex-1 overflow-hidden">
					{messages.length === 0 ? (
						<div className="h-full flex items-center justify-center p-6">
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								className="text-center"
							>
								<h2 className="text-xl font-medium mb-2">
									Welcome to Proxy AI
								</h2>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									Add knowledge and start asking questions
								</p>
							</motion.div>
						</div>
					) : (
						<div className="h-full overflow-y-auto p-4 space-y-3">
							<AnimatePresence initial={false}>
								{messages.map((message, index) => (
									<motion.div
										key={index}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										className={`flex ${
											message.role === "user" ? "justify-end" : "justify-start"
										}`}
									>
										<div
											className={`max-w-[85%] rounded-lg px-3 py-2 ${
												message.role === "user"
													? "bg-blue-500 text-white"
													: "bg-white dark:bg-zinc-800 shadow-sm"
											}`}
										>
											{message.content}
										</div>
									</motion.div>
								))}
							</AnimatePresence>
							{isLoading && (
								<div className="flex justify-start">
									<div className="bg-white dark:bg-zinc-800 rounded-lg p-2 shadow-sm">
										<Loader2 className="w-4 h-4 animate-spin" />
									</div>
								</div>
							)}
							<div ref={messagesEndRef} />
						</div>
					)}
				</div>

				<div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
					<form onSubmit={handleSubmit} className="flex gap-2">
						<Input
							type="text"
							value={input}
							onChange={handleInputChange}
							placeholder="Type a message..."
							className="bg-white dark:bg-zinc-800"
							disabled={isLoading}
						/>
						<Button
							type="submit"
							size="icon"
							disabled={isLoading || !input.trim()}
							className="shrink-0"
						>
							<SendIcon className="w-4 h-4" />
							<span className="sr-only">Send</span>
						</Button>
					</form>
				</div>
			</div>
		</main>
	);
}
