import Hero from '@/components/home/Hero';
import Services from '@/components/home/Services';
import FeaturedProperties from '@/components/home/FeaturedProperties';
import WhyUs from '@/components/home/WhyUs';
import Financing from '@/components/home/Financing';
import Team from '@/components/home/Team';
import ContactSection from '@/components/home/ContactSection';
import Faq from '@/components/home/Faq';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Services />
      <FeaturedProperties />
      <WhyUs />
      <Financing />
      <Team />
      <ContactSection />
      <Faq />
    </>
  );
}
