import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Play, Activity, HeartPulse, Landmark, ShieldCheck, MapPin, AlertTriangle } from "lucide-react";
import { useQueryText, QueryRequestLanguage, QueryResponse } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BrainCircuit } from "lucide-react";

const DEMO_SCENARIOS = [
  {
    id: 1,
    text: "I have chest pain and cannot breathe",
    intent: "Emergency",
    icon: <AlertTriangle className="w-6 h-6 text-destructive" />,
    color: "bg-red-50 border-red-200 hover:border-red-400 hover:bg-red-100",
    lang: "en" as QueryRequestLanguage
  },
  {
    id: 2,
    text: "Mujhe paise nahi mila PM Kisan ka",
    intent: "Finance/Hindi",
    icon: <Landmark className="w-6 h-6 text-emerald-600" />,
    color: "bg-emerald-50 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100",
    lang: "hi" as QueryRequestLanguage
  },
  {
    id: 3,
    text: "How do I apply for Ayushman Bharat health card?",
    intent: "Government",
    icon: <ShieldCheck className="w-6 h-6 text-blue-600" />,
    color: "bg-blue-50 border-blue-200 hover:border-blue-400 hover:bg-blue-100",
    lang: "en" as QueryRequestLanguage
  },
  {
    id: 4,
    text: "Where is the nearest government hospital?",
    intent: "Navigation",
    icon: <MapPin className="w-6 h-6 text-amber-600" />,
    color: "bg-amber-50 border-amber-200 hover:border-amber-400 hover:bg-amber-100",
    lang: "en" as QueryRequestLanguage
  },
  {
    id: 5,
    text: "I have fever for 3 days",
    intent: "Healthcare",
    icon: <HeartPulse className="w-6 h-6 text-rose-600" />,
    color: "bg-rose-50 border-rose-200 hover:border-rose-400 hover:bg-rose-100",
    lang: "en" as QueryRequestLanguage
  },
  {
    id: 6,
    text: "What is the balance in my Jan Dhan account?",
    intent: "Finance",
    icon: <Landmark className="w-6 h-6 text-emerald-600" />,
    color: "bg-emerald-50 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100",
    lang: "en" as QueryRequestLanguage
  }
];

export default function DemoPage() {
  const [userId, setUserId] = useState<string>("");
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [response, setResponse] = useState<QueryResponse | null>(null);
  
  const queryMutation = useQueryText();

  useEffect(() => {
    const id = localStorage.getItem("jeevan_user_id");
    if (id) setUserId(id);
  }, []);

  const handleTest = (text: string, lang: QueryRequestLanguage) => {
    if (!userId) return;
    setActiveQuery(text);
    setResponse(null);
    queryMutation.mutate(
      { data: { text, userId, language: lang } },
      {
        onSuccess: (data) => {
          setResponse(data);
        }
      }
    );
  };

  return (
    <div className="px-4 py-8 max-w-4xl mx-auto w-full h-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary" />
          Test Scenarios
        </h2>
        <p className="text-muted-foreground mt-2 text-lg">
          Click any card to instantly simulate a user voice query and see how the AI processes it.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {DEMO_SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => handleTest(scenario.text, scenario.lang)}
            disabled={queryMutation.isPending}
            className={`text-left p-5 rounded-2xl border-2 transition-all duration-200 group ${scenario.color} ${activeQuery === scenario.text ? 'ring-4 ring-primary/20 scale-[1.02]' : ''}`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-white/60 rounded-xl">
                {scenario.icon}
              </div>
              <Badge variant="outline" className="bg-white/50 border-black/10">
                {scenario.intent}
              </Badge>
            </div>
            <p className="font-medium text-lg leading-tight text-slate-800">
              "{scenario.text}"
            </p>
            <div className="mt-4 flex items-center text-sm font-semibold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="w-4 h-4 mr-1" /> Test Scenario
            </div>
          </button>
        ))}
      </div>

      {(queryMutation.isPending || response) && (
        <div className="mt-8 border-t-2 pt-8 animate-in fade-in slide-in-from-bottom-8">
          <h3 className="text-xl font-bold mb-6 text-center">Result</h3>
          
          {queryMutation.isPending ? (
            <div className="p-6 bg-white rounded-3xl border-2 shadow-sm max-w-2xl mx-auto">
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
          ) : response ? (
            <div className={`p-6 bg-white rounded-3xl border-2 shadow-lg max-w-2xl mx-auto ${response.isEmergency ? 'border-destructive/50 bg-red-50/30' : ''}`}>
              <div className="mb-4 pb-4 border-b">
                <p className="text-sm font-medium text-muted-foreground mb-1">Simulated Query:</p>
                <p className="text-lg italic font-medium">"{activeQuery}"</p>
              </div>

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
          ) : null}
        </div>
      )}

    </div>
  );
}
