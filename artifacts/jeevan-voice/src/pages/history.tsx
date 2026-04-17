import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { History, Trash2, MessageSquare, AlertTriangle, ShieldCheck, HeartPulse, Landmark, MapPin } from "lucide-react";
import { useGetUserMemory, useClearUserMemory, getGetUserMemoryQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function HistoryPage({ params }: { params: { userId: string } }) {
  const userId = params.userId;
  const { data, isLoading } = useGetUserMemory(userId, { query: { enabled: !!userId } });
  const clearMutation = useClearUserMemory();
  const queryClient = useQueryClient();

  const handleClear = () => {
    if (confirm("Are you sure you want to clear all memory? This cannot be undone.")) {
      clearMutation.mutate({ userId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetUserMemoryQueryKey(userId) });
        }
      });
    }
  };

  const getIntentIcon = (intent: string) => {
    switch (intent.toLowerCase()) {
      case 'emergency': return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'healthcare': return <HeartPulse className="w-4 h-4 text-rose-500" />;
      case 'government': return <ShieldCheck className="w-4 h-4 text-blue-500" />;
      case 'finance': return <Landmark className="w-4 h-4 text-emerald-500" />;
      case 'navigation': return <MapPin className="w-4 h-4 text-amber-500" />;
      default: return <MessageSquare className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="px-4 py-8 max-w-3xl mx-auto w-full h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <History className="w-8 h-8 text-primary" />
            Conversation Memory
          </h2>
          <p className="text-muted-foreground mt-1">
            {data?.count !== undefined ? `${data.count} memories stored for your ID` : "Loading your past conversations"}
          </p>
        </div>
        {data && data.count > 0 && (
          <Button 
            variant="outline" 
            className="text-destructive border-destructive/20 hover:bg-destructive/10"
            onClick={handleClear}
            disabled={clearMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-5 bg-white rounded-2xl border">
              <div className="flex justify-between mb-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : data?.memories && data.memories.length > 0 ? (
        <div className="space-y-4">
          {data.memories.map((mem) => (
            <div key={mem.id} className="p-5 bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="flex items-center gap-1.5 capitalize bg-slate-100">
                    {getIntentIcon(mem.intent)}
                    {mem.intent}
                  </Badge>
                  <Badge variant="outline" className="uppercase text-[10px] h-5">{mem.language}</Badge>
                </div>
                <span className="text-xs text-muted-foreground font-medium bg-muted/50 px-2 py-1 rounded-md">
                  {format(new Date(mem.timestamp), "MMM d, h:mm a")}
                </span>
              </div>
              <p className="text-foreground text-lg leading-relaxed">{mem.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 px-4 bg-white rounded-3xl border-2 border-dashed">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-bold mb-2">No memories yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            When you interact with Jeevan Voice, important details will be remembered here to provide better help in the future.
          </p>
          <Link href="/">
            <Button size="lg" className="rounded-xl">Start a conversation</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
