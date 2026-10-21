import type { Metadata } from "next";
import { PricingPage } from "@/components/pricing";

export const metadata: Metadata = {
  title: "Pricing & ROI",
  description:
    "Find the right infrastructure plan and model your AI operating costs with transparent, editable assumptions.",
};

export default function Page() {
  return <PricingPage />;
}
