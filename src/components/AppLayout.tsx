import { Navbar } from "./Navbar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-[#050507] text-white antialiased selection:bg-purple-500/30">
      {/* Global background gradient */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-900/10 rounded-full blur-[100px]" />
      </div>

      <Navbar />

      <main className="relative z-10 pt-16">
        {children}
      </main>
    </div>
  );
}
