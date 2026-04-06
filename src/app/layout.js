import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SocketProvider } from "@/context/SocketContext";
import AudioEngine from "@/components/AudioEngine";
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata = {
  title: "Poker Engine",
  description: "Real-time LED Poker Table Engine",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} ${jetbrainsMono.variable} antialiased bg-zinc-950 text-zinc-100 font-sans`}
      >
        <SocketProvider>
          <AudioEngine />
          {children}
        </SocketProvider>
      </body>
    </html>
  );
}
