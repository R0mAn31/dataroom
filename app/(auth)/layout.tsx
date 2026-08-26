import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 grid grid-rows-[auto_1fr] min-h-dvh">
      <header className="p-6">
        <Brand href="/" />
      </header>
      <main className="flex items-start justify-center px-4 pt-[12vh] pb-16">
        {children}
      </main>
    </div>
  );
}
