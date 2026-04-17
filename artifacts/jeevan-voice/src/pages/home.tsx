import React, { useState, useEffect, useRef } from "react";
import { Mic, Send, AlertTriangle, Languages, BrainCircuit } from "lucide-react";
import { useQueryText, QueryRequestLanguage, QueryResponse } from "@workspace/api-client-react";
import { getOrCreateUserId } from "@/lib/userId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState<QueryRequestLanguage>("auto");
  const [userId, setUserId] = useState<string>("");
  const [response, setResponse] = useState<QueryResponse | null>(null);
  
  const { toast } = useToast();
  const queryMutation = useQueryText();

  useEffect(() => {
    setUserId(getOrCreateUserId());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !userId) return;

    queryMutation.mutate(
      { data: { text, userId, language } },
      {
        onSuccess: (data) => {
          setResponse(data);
        },
        onError: () => {
          toast({
            title: "Connection Error",
            description: "Could not reach the assistant. Please try again.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleMicClick = () => {
    toast({
      title: "Voice Input",
      description: "Voice features are handled by Vapi on the server side. Type your query for now.",
    });
  };

  return (
    <div className="flex-1 flex flex-col px-4 py-8 max-w-2xl mx-auto w-full h-full justify-center">
      
      <div className="flex flex-col items-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <button
          onClick={handleMicClick}
          className="w-32 h-32 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 hover:shadow-primary/30 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-primary/20"
        >
          <Mic className="w-12 h-12" />
        </button>
        <h2 className="mt-6 text-3xl font-bold text-center">How can I help you today?</h2>
        <p className="text-muted-foreground mt-2 text-center max-w-md">
          Speak to me in English, Hindi, or Kannada. I can help with health, government schemes, and more.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150 fill-mode-both">
        <div className="flex gap-2">
          <Select value={language} onValueChange={(val) => setLanguage(val as QueryRequestLanguage)}>
            <SelectTrigger className="w-[140px] bg-white h-14 rounded-2xl border-2 shadow-sm">
              <Languages className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="hi">हिन्दी (Hindi)</SelectItem>
              <SelectItem value="kn">ಕನ್ನಡ (Kannada)</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your question..."
              className="w-full h-14 rounded-2xl border-2 pl-4 pr-16 text-lg shadow-sm focus-visible:ring-primary/20"
              disabled={queryMutation.isPending}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!text.trim() || queryMutation.isPending}
              className="absolute right-2 top-2 h-10 w-10 rounded-xl"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </form>

      {queryMutation.isPending && (
        <div className="mt-8 p-6 bg-white rounded-3xl border-2 shadow-sm animate-in fade-in">
          <div className="flex gap-3 items-center mb-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </div>
      )}

      {response && !queryMutation.isPending && (
        <div className={`mt-8 p-6 bg-white rounded-3xl border-2 shadow-sm animate-in fade-in slide-in-from-bottom-4 ${response.isEmergency ? 'border-destructive/50 bg-red-50/30' : ''}`}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {response.isEmergency && (
                <Badge variant="destructive" className="animate-pulse flex items-center gap-1 py-1 px-2 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  EMERGENCY
                </Badge>
              )}
              <Badge variant="secondary" className="capitalize text-sm py-1 px-2">{response.intent}</Badge>
              <Badge variant="outline" className="uppercase text-xs py-1 px-2 bg-muted/50">{response.language}</Badge>
            </div>
            {response.memoryUsed && (
              <Badge variant="outline" className="flex items-center gap-1 border-primary/20 text-primary bg-primary/5 text-xs py-1 px-2">
                <BrainCircuit className="w-3.5 h-3.5" />
                Memory Applied
              </Badge>
            )}
          </div>
          
          <div className="prose prose-slate max-w-none">
            <p className="text-lg leading-relaxed text-foreground whitespace-pre-wrap">
              {response.response}
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
