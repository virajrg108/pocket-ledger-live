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

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  useEffect(() => {
    if (!SpeechRecognition) return;

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'en-US';
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onresult = (event: any) => {
      let currentTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript + " ";
      }

      setTranscription(currentTranscript);

      const accountNames = accounts ? accounts.map((a: any) => a.name) : [];
      const data = parseVoiceCommand(currentTranscript, accountNames);
      setParsedData(data);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error !== 'no-speech') {
        setIsListening(false);
      }
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [SpeechRecognition, accounts]);

  if (!SpeechRecognition) {
    return null;
  }

  const startListening = () => {
    setTranscription("");
    setParsedData({});
    setIsListening(true);
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error(e);
    }
  };

  const handleFinish = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
    setTranscription("");
    navigate('/add', { state: { voiceData: parsedData } });
    setParsedData({});
  };

  const handleCancel = () => {
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
          className="fixed bottom-24 right-4 md:bottom-8 md:right-8 rounded-full w-14 h-14 shadow-lg z-50 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 transition-transform hover:scale-105"
        >
          <Mic className="w-6 h-6" />
        </Button>
      )}

      {/* Full Screen Overlay Modal */}
      {(isListening || transcription) && (
        <div className="fixed inset-0 z-[100] bg-zinc-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl bg-zinc-900 border-zinc-800 text-zinc-50 shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-zinc-800 pb-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {isListening ? (
                      <><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span> Listening...</>
                    ) : (
                      <><MicOff className="w-5 h-5 text-zinc-400" /> Paused</>
                    )}
                  </CardTitle>
                  <CardDescription className="text-zinc-400 mt-1">Speak fields and values (e.g. "Amount 50")</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={handleCancel} className="text-zinc-400 hover:text-rose-400">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">

              <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 min-h-[100px] flex items-center justify-center">
                <p className="text-lg font-medium text-center italic text-zinc-300">
                  {transcription || <span className="text-zinc-600">Waiting for speech...</span>}
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

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <Button variant="outline" onClick={handleCancel} className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50">
                  Cancel
                </Button>
                <Button onClick={handleFinish} className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-medium">
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
    <div className={`p-3 rounded-md border ${isFilled ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-950'}`}>
      <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-sm font-medium truncate ${isFilled ? 'text-emerald-400' : 'text-zinc-600'}`}>
        {isFilled ? value : '—'}
      </div>
    </div>
  );
}
