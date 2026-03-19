"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Target, MessageSquareText, ShieldCheck, UploadCloud, FileText, Timer, History, ArrowLeft, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { SignInButton, Show, UserButton, useUser } from "@clerk/nextjs";

function LiveMetric({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-card-bg border border-border-glass rounded-xl p-4 flex items-center gap-4 backdrop-blur-glass">
      <div className={`p-3 rounded-lg ${color} bg-opacity-20`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
      <div>
        <p className="text-text-secondary text-sm">{label}</p>
        <p className="text-text-primary font-bold text-lg">{value}</p>
      </div>
    </div>
  );
}

type QAPair = { question: string; answer: string };
type SavedSession = { id: number; date: string; role: string; experience: string; feedback: string };

export default function Home() {
  const { isSignedIn } = useUser();
  const [view, setView] = useState<"interview" | "history">("interview");
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);

  const [role, setRole] = useState("Software Engineer");
  const [experience, setExperience] = useState("Mid-Level");
  
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [history, setHistory] = useState<QAPair[]>([]);
  const [round, setRound] = useState(1);
  const MAX_ROUNDS = 3; 

  const [sessionStarted, setSessionStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);

  const TIME_LIMIT = 120; 
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const currentAnswerRef = useRef(""); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // FETCH FROM DATABASE WHEN OPENING HISTORY VIEW
  useEffect(() => {
    if (view === "history" && isSignedIn) {
      const fetchHistory = async () => {
        try {
          const res = await fetch("/api/sessions");
          if (res.ok) {
            const data = await res.json();
            const formatted = data.map((s: any) => ({
              id: s.id,
              date: new Date(s.createdAt).toLocaleDateString() + " " + new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              role: s.role,
              experience: s.experience,
              feedback: s.feedback
            }));
            setSavedSessions(formatted);
          }
        } catch (err) {
          console.error("Failed to fetch history:", err);
        }
      };
      fetchHistory();
    }
  }, [view, isSignedIn]);

  useEffect(() => {
    currentAnswerRef.current = currentAnswer;
  }, [currentAnswer]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (sessionStarted && !loading && !feedback && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } 
    else if (timeLeft === 0 && sessionStarted && !loading && !feedback) {
      const forcedAnswer = currentAnswerRef.current.trim() 
        ? currentAnswerRef.current 
        : "*Candidate ran out of time and did not provide an answer.*";
      submitAnswer(forcedAnswer);
    }

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStarted, loading, feedback, timeLeft]);

  const startInterview = async () => {
    setLoading(true);
    setError("");
    setLoadingText("Initializing Session...");
    
    try {
      let extractedText = "";

      if (resumeFile) {
        setLoadingText("Reading Resume...");
        const formData = new FormData();
        formData.append("file", resumeFile);
        
        const uploadRes = await fetch("http://127.0.0.1:8000/extract-resume", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("Failed to parse PDF resume.");
        const uploadData = await uploadRes.json();
        extractedText = uploadData.resume_text;
        setResumeText(extractedText);
      }

      setLoadingText("Generating initial question...");
      const response = await fetch("http://127.0.0.1:8000/generate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          role, 
          experience_level: experience, 
          resume_text: extractedText,
          history: [] 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.detail || "Something went wrong on the server.");
        setLoading(false); // Fix: Re-enable the UI
        setLoadingText("");
        return; 
      }
      
      const data = await response.json();
      setCurrentQuestion(data.question);
      setSessionStarted(true);
      setRound(1);
      setHistory([]);
      setTimeLeft(TIME_LIMIT); 
      
    } catch (err) {
      console.error(err);
      setError("Oops! Something went wrong. Make sure Uvicorn is running.");
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  };

  const submitAnswer = async (autoSubmitAnswer?: string) => {
    const finalAnswer = typeof autoSubmitAnswer === 'string' ? autoSubmitAnswer : currentAnswer;
    if (!finalAnswer.trim()) return;

    setLoading(true);
    setError("");
    
    const newHistory = [...history, { question: currentQuestion, answer: finalAnswer }];
    setHistory(newHistory);
    setCurrentAnswer(""); 
    setTimeLeft(TIME_LIMIT); 

    try {
      if (round < MAX_ROUNDS) {
        setLoadingText(`Analyzing answer and generating round ${round + 1} question...`);
        const response = await fetch("http://127.0.0.1:8000/generate-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            role, 
            experience_level: experience, 
            resume_text: resumeText,
            history: newHistory 
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          alert(errorData.detail || "Something went wrong on the server.");
          setLoading(false); // Fix: Re-enable the UI
          setLoadingText("");
          return; 
        }
        
        const data = await response.json();
        setCurrentQuestion(data.question);
        setRound(round + 1);

      } else {
        setLoadingText("Interview complete. Generating final report...");
        const response = await fetch("http://127.0.0.1:8000/generate-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            role, 
            experience_level: experience, 
            resume_text: resumeText,
            history: newHistory
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          alert(errorData.detail || "Failed to generate report.");
          setLoading(false);
          setLoadingText("");
          return; 
        }

        const data = await response.json();
        setFeedback(data.feedback);

        // --- SAVE TO REAL DATABASE IF LOGGED IN ---
        if (isSignedIn) {
          try {
            const saveRes = await fetch("/api/sessions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                role: role,
                experience: experience,
                feedback: data.feedback,
                history: newHistory 
              })
            });
            if (!saveRes.ok) {
               console.error("Failed to save session to database");
            }
          } catch (dbErr) {
            console.error("Database connection error", dbErr);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to backend.");
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  };

  const resetSession = () => {
    setSessionStarted(false);
    setFeedback("");
    setCurrentAnswer("");
    setHistory([]);
    setRound(1);
    setTimeLeft(TIME_LIMIT);
  };

  return (
    <div className="min-h-screen bg-dark-bg bg-gradient-futuristic text-text-primary p-8 font-sans selection:bg-accent-blue selection:text-white">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-glass pb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-glow-blue rounded-xl border border-accent-blue/30 shadow-glow-blue">
              <BrainCircuit className="w-8 h-8 text-accent-blue" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">InterviewBoost</h1>
              <p className="text-text-secondary">Multi-Round Interview Simulator</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="bg-accent-blue hover:bg-opacity-90 text-white font-semibold py-2 px-6 rounded-lg transition-all shadow-glow-blue">
                  Log In to Save History
                </button>
              </SignInButton>
            </Show>

            <Show when="signed-in">
              <button 
                onClick={() => setView(view === "interview" ? "history" : "interview")}
                className="flex items-center gap-2 bg-card-bg border border-border-glass hover:border-accent-blue/50 text-text-primary px-4 py-2 rounded-lg transition-colors"
              >
                {view === "interview" ? (
                  <><History className="w-5 h-5 text-accent-blue" /> View History</>
                ) : (
                  <><ArrowLeft className="w-5 h-5 text-accent-blue" /> Back to Interview</>
                )}
              </button>
              
              <div className="ml-2 p-1 bg-card-bg border border-border-glass rounded-full flex items-center justify-center">
                 <UserButton />
              </div>
            </Show>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-xl backdrop-blur-glass">
            {error}
          </div>
        )}

        {/* --- MAIN VIEW CONDITIONALS --- */}
        {view === "history" ? (
          /* HISTORY DASHBOARD VIEW */
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Past Sessions</h2>
            </div>

            {savedSessions.length === 0 ? (
              <div className="bg-card-bg border border-border-glass rounded-2xl p-12 text-center backdrop-blur-glass shadow-glass">
                <History className="w-12 h-12 text-text-secondary mx-auto mb-4 opacity-50" />
                <p className="text-text-secondary text-lg">No interviews completed yet.</p>
                <p className="text-text-secondary/60 mt-2">Finish a 3-round session and your report will be saved here.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {savedSessions.map((session) => (
                  <div key={session.id} className="bg-card-bg border border-border-glass rounded-2xl p-6 backdrop-blur-glass shadow-glass transition-all">
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedSessionId(expandedSessionId === session.id ? null : session.id)}
                    >
                      <div>
                        <h3 className="text-lg font-bold text-accent-blue">{session.role} <span className="text-sm font-normal text-text-secondary">({session.experience})</span></h3>
                        <div className="flex items-center gap-2 text-sm text-text-secondary mt-1">
                          <Calendar className="w-4 h-4" /> {session.date}
                        </div>
                      </div>
                      <button className="text-text-secondary hover:text-white transition-colors">
                        {expandedSessionId === session.id ? "Hide Details" : "Read Report"}
                      </button>
                    </div>

                    {expandedSessionId === session.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-6 pt-6 border-t border-border-glass prose prose-invert max-w-none text-text-secondary text-sm break-words overflow-x-auto w-full">
                        <ReactMarkdown>{session.feedback}</ReactMarkdown>
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          /* INTERVIEW VIEW */
          <>
            {!sessionStarted ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card-bg border border-border-glass rounded-2xl p-8 backdrop-blur-glass shadow-glass space-y-6">
                <h2 className="text-xl font-semibold">Configure Session</h2>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm text-text-secondary">Target Role</label>
                    <input 
                      type="text" 
                      value={role} 
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full bg-dark-bg border border-border-glass rounded-lg p-3 text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-text-secondary">Experience Level</label>
                    <select 
                      value={experience} 
                      onChange={(e) => setExperience(e.target.value)}
                      className="w-full bg-dark-bg border border-border-glass rounded-lg p-3 text-text-primary focus:outline-none focus:border-accent-blue transition-colors appearance-none"
                    >
                      <option>Junior</option>
                      <option>Mid-Level</option>
                      <option>Senior</option>
                      <option>Lead</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-text-secondary">Resume Context (Optional)</label>
                  <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-border-glass hover:border-accent-blue/50 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-dark-bg/50"
                  >
                      <input 
                        type="file" 
                        accept=".pdf" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                      />
                      {resumeFile ? (
                        <>
                          <FileText className="w-8 h-8 text-accent-blue mb-2" />
                          <p className="text-accent-blue font-medium">{resumeFile.name}</p>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-8 h-8 text-text-secondary mb-2" />
                          <p className="text-text-secondary">Click to upload your Resume (PDF)</p>
                          <p className="text-xs text-text-secondary/50 mt-1">InterviewBoost will tailor questions to your experience.</p>
                        </>
                      )}
                  </div>
                </div>

                <button 
                  onClick={startInterview} 
                  disabled={loading}
                  className="w-full bg-gradient-accent hover:opacity-90 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-glow-blue disabled:opacity-50"
                >
                  {loading ? loadingText : "Start Interview Sequence"}
                </button>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                
                <div className="grid grid-cols-3 gap-4">
                  <LiveMetric label="Progress" value={`Round ${round} of ${MAX_ROUNDS}`} icon={ShieldCheck} color="bg-green-500" />
                  <LiveMetric label="Target Role" value={role} icon={BrainCircuit} color="bg-accent-blue" />
                  <LiveMetric label="Stage" value={feedback ? "Final Review" : "Active Q&A"} icon={Target} color="bg-accent-purple" />
                </div>

                {!feedback ? (
                  <>
                    <div className="bg-card-bg border border-border-glass rounded-2xl p-8 backdrop-blur-glass shadow-glass space-y-4">
                      <div className="flex gap-3 items-center text-accent-blue mb-2">
                        <MessageSquareText className="w-5 h-5" />
                        <h3 className="font-semibold text-lg">InterviewBoost (Question {round})</h3>
                      </div>
                      <p className="text-lg leading-relaxed whitespace-pre-wrap break-words">{currentQuestion}</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-end px-2">
                        <label className="text-sm font-medium text-text-secondary">Your Answer</label>
                        <div className={`flex items-center gap-2 font-mono font-bold text-lg transition-colors ${timeLeft <= 15 ? 'text-red-500 animate-pulse' : 'text-accent-blue'}`}>
                          <Timer className="w-5 h-5" />
                          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </div>
                      </div>

                      <textarea 
                        value={currentAnswer}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        placeholder="Type your detailed answer here..."
                        className="w-full h-40 bg-card-bg border border-border-glass rounded-2xl p-6 text-text-primary focus:outline-none focus:border-accent-purple transition-colors resize-none backdrop-blur-glass shadow-glass"
                      />
                      <button 
                        onClick={() => submitAnswer()} 
                        disabled={loading || !currentAnswer}
                        className="w-full bg-accent-purple hover:bg-opacity-90 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-glow-purple disabled:opacity-50"
                      >
                        {loading ? loadingText : (round < MAX_ROUNDS ? "Submit Answer & Continue" : "Submit Final Answer")}
                      </button>
                    </div>
                  </>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card-bg border border-accent-purple/50 rounded-2xl p-8 backdrop-blur-glass shadow-glow-purple space-y-4">
                    <h3 className="text-xl font-bold text-accent-purple mb-4">Comprehensive Session Report</h3>
                    <div className="prose prose-invert max-w-none text-text-secondary leading-relaxed break-words overflow-x-auto w-full">
                      <ReactMarkdown>{feedback}</ReactMarkdown>
                    </div>
                    <button 
                      onClick={resetSession}
                      className="mt-6 w-full bg-dark-bg border border-border-glass hover:bg-white/5 text-text-primary font-semibold py-3 px-4 rounded-lg transition-all"
                    >
                      Start New Session
                    </button>
                  </motion.div>
                )}

              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}