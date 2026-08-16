import { ClosingCta } from "@/components/landing/ClosingCta";
import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Partners } from "@/components/landing/Partners";
import { Pricing } from "@/components/landing/Pricing";
import { ProductShowcase } from "@/components/landing/ProductShowcase";
import { Story } from "@/components/landing/Story";

export default function LandingPage() {
  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-obligon-mist text-obligon-navy" data-node-id="2:2">
      <Header />
      <Hero />
      <Story />
      <ProductShowcase />
      <Pricing />
      <ClosingCta />
      <Partners />
      <Footer />
    </main>
  );
}
