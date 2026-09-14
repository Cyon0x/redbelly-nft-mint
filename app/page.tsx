import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { Gallery } from "@/components/sections/Gallery";
import { CollectionDetails } from "@/components/sections/CollectionDetails";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { WhyRedbelly } from "@/components/sections/WhyRedbelly";
import { About } from "@/components/sections/About";
import { Faq } from "@/components/sections/Faq";

export default function Page() {
  return (
    <>
      <Navbar />
      <main id="main">
        <Hero />
        <Gallery />
        <CollectionDetails />
        <HowItWorks />
        <WhyRedbelly />
        <About />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
