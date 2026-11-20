import type { Metadata } from "next";
import { MarketView } from "@/components/market/market-view";

export const metadata: Metadata = { title: "Marketplace" };

export default function MarketPage() {
  return <MarketView />;
}
