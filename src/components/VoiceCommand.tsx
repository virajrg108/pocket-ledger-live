import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, X, Check, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '../store/useAuthStore';
import { getUserCollections } from '../db';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { parseVoiceCommand, type ParsedTransaction } from '../lib/voiceParser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format } from "date-fns";

export function VoiceCommand() {
  const [isListening, setIsListening] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [parsedData, setParsedData] = useState<ParsedTransaction>({});

  const navigate = useNavigate();
  const { user } = useAuthStore();
  const collections = getUserCollections(user?.uid);
  const [accounts] = useCollectionData(collections?.accounts);

  const recognitionRef = useRef<any>(null);
  const intentionalStopRef = useRef<boolean>(false);
  const accumulatedTranscriptRef = useRef<string>("");
  const lastSessionTranscriptRef = useRef<string>("");

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  useEffect(() => {
    if (!SpeechRecognition) return;

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'en-US';
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onresult = (event: any) => {
      let sessionTranscript = "";
      
      const mergeStrings = (a: string, b: string) => {
        if (!a) return b;
        if (!b) return a;
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        for (let i = Math.min(a.length, b.length); i > 0; i--) {
          if (aLower.endsWith(bLower.substring(0, i))) {
            return a + b.substring(i);
          }
        }
        return a + " " + b;
      };

      for (let i = 0; i < event.results.length; i++) {
        let text = event.results[i][0].transcript.trim();
        if (!text) continue;
        sessionTranscript = mergeStrings(sessionTranscript.trim(), text);
      }

      lastSessionTranscriptRef.current = sessionTranscript.trim();
      let fullTranscript = accumulatedTranscriptRef.current + (accumulatedTranscriptRef.current && lastSessionTranscriptRef.current ? " " : "") + lastSessionTranscriptRef.current;
      fullTranscript = fullTranscript.trim() + " ";

      setTranscription(fullTranscript);

      const accountNames = accounts ? accounts.map((a: any) => a.name) : [];
      const data = parseVoiceCommand(fullTranscript, accountNames);
      setParsedData(data);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed' || event.error === 'audio-capture') {
        intentionalStopRef.current = true;
        setIsListening(false);
      }
    };

    recognitionRef.current.onend = () => {
      // Commit the last session's transcript when the session ends
      if (lastSessionTranscriptRef.current) {
        accumulatedTranscriptRef.current += (accumulatedTranscriptRef.current ? " " : "") + lastSessionTranscriptRef.current;
        lastSessionTranscriptRef.current = "";
      }

      if (!intentionalStopRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Failed to auto-restart recognition", e);
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    return () => {
      intentionalStopRef.current = true;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [SpeechRecognition, accounts]);

  if (!SpeechRecognition) {
    return null;
  }

  const startListening = () => {
    accumulatedTranscriptRef.current = "";
    lastSessionTranscriptRef.current = "";
    setTranscription("");
    setParsedData({});
    setIsListening(true);
    intentionalStopRef.current = false;
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error(e);
    }
  };

  const handleFinish = () => {
    intentionalStopRef.current = true;
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
    setTranscription("");
    navigate('/add', { state: { voiceData: parsedData } });
    setParsedData({});
  };

  const handleCancel = () => {
    intentionalStopRef.current = true;
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
    setTranscription("");
    setParsedData({});
  };

  return (
    <>
      {/* Floating Action Button */}
      {(!isListening && !transcription) && (
        <Button
          onClick={startListening}
          className="fixed bottom-24 right-4 md:bottom-4 md:right-8 rounded-full w-14 h-14 shadow-lg z-50 bg-gradient-to-br from-amber-400 to-orange-500 text-white border-0 transition-transform hover:scale-105"
        >
          <Mic className="w-6 h-6" />
        </Button>
      )}

      {/* Full Screen Overlay Modal */}
      {(isListening || transcription) && (
        <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl bg-card border-border text-foreground shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {isListening ? (
                      <><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span> Listening...</>
                    ) : (
                      <><MicOff className="w-5 h-5 text-muted-foreground" /> Paused</>
                    )}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground mt-1">Speak fields and values (e.g. "Amount 50")</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={handleCancel} className="text-muted-foreground hover:text-destructive">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">

              <div className="p-4 bg-muted/50 rounded-lg border border-border min-h-[100px] flex items-center justify-center">
                <p className="text-lg font-medium text-center italic text-foreground">
                  {transcription || <span className="text-muted-foreground">Waiting for speech...</span>}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <FieldCard label="Description" value={parsedData.title} />
                <FieldCard label="Amount" value={parsedData.amount !== undefined ? parsedData.amount.toString() : undefined} />
                <FieldCard label="Cash Flow" value={parsedData.type} />
                <FieldCard label="Source Account" value={parsedData.source} />
                <FieldCard label="Category" value={parsedData.category} />
                <FieldCard label="Date" value={parsedData.timestamp ? format(new Date(parsedData.timestamp), 'MMM d, yyyy') : undefined} />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={handleCancel} className="bg-transparent border-border text-muted-foreground hover:bg-muted hover:text-foreground">
                  Cancel
                </Button>
                <Button onClick={handleFinish} className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 border-0 text-white font-medium">
                  <Check className="w-4 h-4 mr-2" />
                  Finish & Review
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function FieldCard({ label, value }: { label: string, value?: string }) {
  const isFilled = value !== undefined && value !== "";
  return (
    <div className={`p-3 rounded-md border ${isFilled ? 'border-orange-500/50 bg-orange-500/10' : 'border-border bg-background'}`}>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-sm font-medium truncate ${isFilled ? 'text-orange-500 dark:text-orange-400' : 'text-muted-foreground/80'}`}>
        {isFilled ? value : '—'}
      </div>
    </div>
  );
}
