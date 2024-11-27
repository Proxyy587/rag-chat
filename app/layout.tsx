import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";

const plusJakarta = Plus_Jakarta_Sans({
	weight: ["300", "400", "500", "600", "700", "800"],
	subsets: ["latin"],
	variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
	title: "chatme - AI Chat",
	description:
		"An AI-powered chat application that lets you add and interact with your own knowledge base. Get intelligent responses based on your custom data.",
	keywords: [
		"AI Chat",
		"RAG",
		"Knowledge Base",
		"Artificial Intelligence",
		"Chatbot",
	],
	openGraph: {
		title: "RAG AI Chat | Your Intelligent Knowledge Assistant",
		description:
			"An AI-powered chat application that lets you add and interact with your own knowledge base.",
		type: "website",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${plusJakarta.variable} font-sans antialiased`}>
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					enableSystem
					disableTransitionOnChange
				>
					{children}
				</ThemeProvider>
			</body>
		</html>
	);
}
