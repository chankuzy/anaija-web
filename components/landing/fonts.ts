import { Playfair_Display } from "next/font/google";

// Same family and weight the sign-in screen already uses, so the font file is shared, not downloaded twice.
export const display = Playfair_Display({ subsets: ["latin"], weight: "500", display: "swap", variable: "--font-display" });
