import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Mic, Activity, CheckCircle2, AlertCircle } from "lucide-react";
import { useHealthCheck } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health, isLoading } = useHealthCheck();
  
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    let id = localStorage.getItem("jeevan_user_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("jeevan_user_id", id);
    }
    setUserId(id);
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex flex-col">
            <div className="flex items-center gap-2 text-primary">
              <Mic className="w-6 h-6 fill-current" />
              <h1 className="text-2xl font-bold tracking-tight">Jeevan Voice</h1>
            </div>
            <span className="text-sm text-muted-foreground font-medium">AI assistant for everyone</span>
          </Link>
          
          <nav className="flex items-center gap-6">
            <Link 
              href="/" 
              className={`text-sm font-semibold transition-colors ${location === "/" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Home
            </Link>
            <Link 
              href="/demo" 
              className={`text-sm font-semibold transition-colors ${location === "/demo" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Demo
            </Link>
            <Link 
              href={`/history/${userId}`} 
              className={`text-sm font-semibold transition-colors ${location.startsWith("/history") ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              History
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative container max-w-4xl mx-auto w-full">
        {children}
      </main>

      <footer className="bg-white border-t mt-auto">
        <div className="container max-w-4xl mx-auto px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              <span>Status:</span>
              {isLoading ? (
                <span className="text-muted-foreground">Checking...</span>
              ) : health?.status === "ok" ? (
                <span className="flex items-center gap-1 text-green-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-destructive font-medium">
                  <AlertCircle className="w-3.5 h-3.5" /> Offline
                </span>
              )}
            </div>
            {!isLoading && health?.qdrant && (
              <span className="hidden sm:inline-block border-l pl-4">Memory: {health.qdrant}</span>
            )}
            {!isLoading && health?.openai && (
              <span className="hidden sm:inline-block border-l pl-4">AI: {health.openai}</span>
            )}
          </div>
          <div>
            ID: <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">{userId.substring(0,8)}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
