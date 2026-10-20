import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import CookieBanner from './CookieBanner';
import WhatsAppButton from './WhatsAppButton';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import { useReveal } from '@/hooks/useReveal';

export default function PublicLayout() {
  useAnalytics();
  useScrollToHash();
  useReveal();

  return (
    <>
      <Navbar />
      <main style={{ minHeight: '60vh' }}>
        <Outlet />
      </main>
      <Footer />
      <WhatsAppButton />
      <CookieBanner />
    </>
  );
}
