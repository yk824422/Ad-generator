import React, { useState, useRef } from "react";
import { 
  Upload, 
  Link as LinkIcon, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  Target,
  MessageSquare,
  RefreshCw,
  Eye,
  Settings2,
  Code2,
  Palette,
  Layout as LayoutIcon,
  Copy,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { analyzeAd, generatePersonalizedCode, AdAnalysis, PageStructure, PersonalizedCode } from "./services/openai";
import axios from "axios";

export default function App() {
  const [adInput, setAdInput] = useState<string>("");
  const [adImage, setAdImage] = useState<string | null>(null);
  const [lpUrl, setLpUrl] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [adAnalysis, setAdAnalysis] = useState<AdAnalysis | null>(null);
  const [pageStructure, setPageStructure] = useState<PageStructure | null>(null);
  const [personalizedResult, setPersonalizedResult] = useState<PersonalizedCode | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAdImage(reader.result as string);
        setAdInput("");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcess = async () => {
    if (!lpUrl) {
      setError("Please enter a landing page URL");
      return;
    }
    if (!adImage && !adInput) {
      setError("Please provide an ad creative (image or text)");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setCurrentStep(1);

    try {
      // Step 1: Structural Analysis
      const scrapeRes = await axios.post("/api/scrape", { url: lpUrl });
      
      // Validation: Check if we actually got a real page or a bot-blocked skeleton
      if (!scrapeRes.data.sections || scrapeRes.data.sections.length < 2) {
        throw new Error("This website is blocking our automated access. Please try a different URL or descriptive text instead.");
      }

      setPageStructure(scrapeRes.data);
      
      await new Promise(r => setTimeout(r, 1000)); // Visual delay
      setCurrentStep(2);

      // Step 2: Asset & Design System Extraction
      const analysis = await analyzeAd({ image: adImage || undefined, text: adInput || undefined });
      setAdAnalysis(analysis);

      await new Promise(r => setTimeout(r, 1000)); // Visual delay
      setCurrentStep(3);

      // Step 3: Code Implementation
      const result = await generatePersonalizedCode(analysis, scrapeRes.data);
      setPersonalizedResult(result);
      
      setCurrentStep(4);
      setShowPreview(true);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "An error occurred during processing. Please try again.");
      setCurrentStep(0);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    if (personalizedResult?.code) {
      navigator.clipboard.writeText(personalizedResult.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-200">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">Troopod</span>
            <Badge variant="secondary" className="ml-2 bg-blue-50 text-blue-600 border-blue-100 font-semibold">V2 Engine</Badge>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="text-gray-500 font-medium">Docs</Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-100">Get Pro</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Sidebar Inputs */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-xl shadow-gray-200/50 ring-1 ring-gray-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-blue-600" />
                  Configuration
                </CardTitle>
                <CardDescription>Define your ad creative and target landing page</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Ad Creative Input */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700">Ad Creative / Banner</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${adImage ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'}`}
                  >
                    {adImage ? (
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-sm">
                        <img src={adImage} alt="Ad Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <p className="text-white text-xs font-bold uppercase tracking-wider">Change Image</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center ring-4 ring-white shadow-sm">
                          <Upload className="w-6 h-6 text-gray-400" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-gray-600">Drop ad creative here</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">PNG, JPG, WEBP</p>
                        </div>
                      </>
                    )}
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleFileUpload}
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-100"></span></div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold"><span className="bg-white px-3 text-gray-400">Or Describe</span></div>
                  </div>
                  <Input 
                    placeholder="e.g. 'Flash sale: 40% off luxury watches'" 
                    value={adInput}
                    onChange={(e) => {
                      setAdInput(e.target.value);
                      if (e.target.value) setAdImage(null);
                    }}
                    className="bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all rounded-xl"
                  />
                </div>

                {/* Landing Page URL */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700">Target URL</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                      placeholder="https://example.com/landing-page" 
                      className="pl-10 bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all rounded-xl"
                      value={lpUrl}
                      onChange={(e) => setLpUrl(e.target.value)}
                    />
                  </div>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm"
                  >
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="font-medium leading-tight">{error}</p>
                  </motion.div>
                )}

                <Button 
                  onClick={handleProcess} 
                  disabled={isProcessing}
                  className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-base font-bold rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Building...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Personalize Page
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main Process Area */}
          <div className="lg:col-span-8 space-y-8">
            {currentStep === 0 && !isProcessing && (
              <div className="h-[600px] border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-center p-12 bg-white/50 backdrop-blur-sm">
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-gray-100 ring-1 ring-gray-100">
                  <Eye className="w-10 h-10 text-gray-200" />
                </div>
                <h3 className="text-2xl font-bold mb-3 tracking-tight">Ready for Personalization</h3>
                <p className="text-gray-500 max-w-md leading-relaxed">
                  Upload your ad creative and provide a URL. We'll analyze the structure, extract the design system, and build a personalized version.
                </p>
              </div>
            )}

            {currentStep > 0 && (
              <div className="space-y-8">
                {/* Step 1: Structural Analysis */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className={`border-none shadow-lg ring-1 transition-all duration-500 ${currentStep >= 1 ? 'ring-blue-100' : 'ring-gray-100 opacity-50'}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                          <LayoutIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Step 1: Structural Analysis</CardTitle>
                          <CardDescription>Mapping the DOM hierarchy and component structure</CardDescription>
                        </div>
                      </div>
                      {currentStep > 1 && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                      {currentStep === 1 && <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />}
                    </CardHeader>
                    <CardContent>
                      {pageStructure ? (
                        <div className="bg-gray-50 rounded-xl p-4 font-mono text-xs space-y-2 border border-gray-100">
                          <p className="text-blue-600 font-bold">// Technical Mockup (Skeleton)</p>
                          <div className="space-y-1">
                            {pageStructure.sections.map((s, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-gray-400">{i + 1}.</span>
                                <Badge variant="outline" className="bg-white text-[10px] font-bold uppercase tracking-tighter">{s.type}</Badge>
                                <span className="text-gray-600">#{s.id}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Step 2: Asset & Design System Extraction */}
                {currentStep >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className={`border-none shadow-lg ring-1 transition-all duration-500 ${currentStep >= 2 ? 'ring-purple-100' : 'ring-gray-100 opacity-50'}`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentStep >= 2 ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                            <Palette className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Step 2: Asset & Design System Extraction</CardTitle>
                            <CardDescription>Visual audit and content mapping from ad creative</CardDescription>
                          </div>
                        </div>
                        {currentStep > 2 && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                        {currentStep === 2 && <RefreshCw className="w-5 h-5 text-purple-600 animate-spin" />}
                      </CardHeader>
                      <CardContent>
                        {adAnalysis ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Visual Audit</p>
                                <div className="flex items-center gap-2">
                                  {adAnalysis.designSystem?.colors?.map((c, i) => (
                                    <div key={i} className="w-8 h-8 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: c }} title={c} />
                                  ))}
                                </div>
                                <div className="flex gap-2 mt-2">
                                  <Badge variant="secondary" className="bg-purple-50 text-purple-600 border-purple-100">{adAnalysis.designSystem?.fontStyle}</Badge>
                                  <Badge variant="secondary" className="bg-purple-50 text-purple-600 border-purple-100">{adAnalysis.designSystem?.vibe}</Badge>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Content Audit</p>
                                <div className="space-y-2">
                                  <div className="flex items-start gap-2">
                                    <Target className="w-3 h-3 mt-1 text-purple-600" />
                                    <p className="text-xs font-medium"><span className="text-gray-400">Hook:</span> {adAnalysis.headline}</p>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <Zap className="w-3 h-3 mt-1 text-purple-600" />
                                    <p className="text-xs font-medium"><span className="text-gray-400">Offer:</span> {adAnalysis.offer}</p>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <MessageSquare className="w-3 h-3 mt-1 text-purple-600" />
                                    <p className="text-xs font-medium"><span className="text-gray-400">CTA:</span> {adAnalysis.cta}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-4">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Step 3: Code Implementation */}
                {currentStep >= 3 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className={`border-none shadow-lg ring-1 transition-all duration-500 ${currentStep >= 3 ? 'ring-green-100' : 'ring-gray-100 opacity-50'}`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentStep >= 3 ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                            <Code2 className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Step 3: Code Implementation</CardTitle>
                            <CardDescription>Rewriting HTML/CSS with personalization logic</CardDescription>
                          </div>
                        </div>
                        {currentStep > 3 && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                        {currentStep === 3 && <RefreshCw className="w-5 h-5 text-green-600 animate-spin" />}
                      </CardHeader>
                      <CardContent>
                        {personalizedResult ? (
                          <div className="space-y-4">
                            <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                              <p className="text-xs text-green-800 font-medium leading-relaxed">
                                <Sparkles className="w-3 h-3 inline mr-1 mb-0.5" />
                                {personalizedResult.explanation}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2 mb-2">
                              <Button 
                                variant={!showPreview ? "default" : "outline"} 
                                size="sm" 
                                onClick={() => setShowPreview(false)}
                                className="rounded-full text-xs font-bold"
                              >
                                <Code2 className="w-3 h-3 mr-1" /> Code View
                              </Button>
                              <Button 
                                variant={showPreview ? "default" : "outline"} 
                                size="sm" 
                                onClick={() => setShowPreview(true)}
                                className="rounded-full text-xs font-bold"
                              >
                                <Eye className="w-3 h-3 mr-1" /> Visual Preview
                              </Button>
                            </div>

                            {!showPreview ? (
                              <div className="relative group">
                                <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button 
                                    size="icon" 
                                    variant="secondary" 
                                    className="h-8 w-8 bg-white/90 backdrop-blur"
                                    onClick={copyToClipboard}
                                  >
                                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                  </Button>
                                </div>
                                <ScrollArea className="h-[400px] w-full rounded-xl border border-gray-200 bg-[#1E1E1E] p-4">
                                  <pre className="text-xs text-gray-300 font-mono leading-relaxed">
                                    <code>{personalizedResult.code}</code>
                                  </pre>
                                </ScrollArea>
                              </div>
                            ) : (
                              <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-inner">
                                <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                                  <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                                  </div>
                                  <div className="mx-auto bg-white px-3 py-0.5 rounded text-[10px] text-gray-400 font-mono truncate max-w-[200px]">
                                    {lpUrl}
                                  </div>
                                </div>
                                <div 
                                  className="h-[500px] overflow-y-auto"
                                  style={{ 
                                    fontFamily: adAnalysis?.designSystem?.fontStyle === "Serif" ? "serif" : "sans-serif",
                                    "--primary-color": adAnalysis?.designSystem?.colors?.[0] || "#2563eb",
                                    "--secondary-color": adAnalysis?.designSystem?.colors?.[1] || "#3b82f6",
                                    "--accent-color": adAnalysis?.designSystem?.colors?.[2] || "#60a5fa"
                                  } as any}
                                >
                                  {/* Dynamic Preview Mockup */}
                                  <div className="min-h-full bg-white">
                                    {pageStructure?.sections.map((section, idx) => {
                                      if (section.type === "navbar") {
                                        return (
                                          <nav key={idx} className="px-6 py-4 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur-sm z-20">
                                            <div className="font-bold text-lg" style={{ color: "var(--primary-color)" }}>
                                              {pageStructure.brandName}
                                            </div>
                                            <div className="flex gap-6">
                                              {section.content.links?.map((link: string, i: number) => (
                                                <span key={i} className="text-xs font-semibold text-gray-600 hover:text-blue-600 cursor-pointer transition-colors">
                                                  {stripHtml(link)}
                                                </span>
                                              ))}
                                            </div>
                                            <Button size="sm" className="rounded-full text-[10px] font-bold h-8 px-4" style={{ backgroundColor: "var(--primary-color)" }}>
                                              Get Started
                                            </Button>
                                          </nav>
                                        );
                                      }
                                      if (section.type === "hero_section") {
                                        return (
                                          <section key={idx} className="relative px-10 py-28 text-center space-y-8 overflow-hidden">
                                            {pageStructure.images[0] && (
                                              <div className="absolute inset-0 z-0">
                                                <img src={pageStructure.images[0]} alt="Hero Background" className="w-full h-full object-cover opacity-10 blur-sm" referrerPolicy="no-referrer" />
                                                <div className="absolute inset-0 bg-gradient-to-b from-white/50 to-white" />
                                              </div>
                                            )}
                                            <div className="relative z-10 space-y-6">
                                              <Badge className="border-none px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest shadow-sm" style={{ backgroundColor: "var(--secondary-color)", color: "white" }}>
                                                Personalized for you
                                              </Badge>
                                              <h1 className="text-6xl font-black tracking-tight leading-[1.1] max-w-4xl mx-auto text-gray-900">
                                                {stripHtml(adAnalysis?.headline || "")}
                                              </h1>
                                              <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed font-medium">
                                                {stripHtml(adAnalysis?.offer || "")}
                                              </p>
                                              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                                                <Button 
                                                  size="lg" 
                                                  className="rounded-full px-12 h-16 text-lg font-bold shadow-2xl transition-transform hover:scale-105"
                                                  style={{ backgroundColor: "var(--primary-color)", boxShadow: `0 20px 40px -10px ${adAnalysis?.designSystem.colors[0]}40` }}
                                                >
                                                  {stripHtml(adAnalysis?.cta || "")}
                                                </Button>
                                                <Button variant="ghost" className="rounded-full h-16 px-8 text-gray-500 font-bold">
                                                  Learn More
                                                </Button>
                                              </div>
                                            </div>
                                          </section>
                                        );
                                      }
                                      if (section.type === "features_grid" || section.type === "content_section") {
                                        const imgIdx = (idx % (pageStructure.images.length || 1));
                                        return (
                                          <section key={idx} className="px-12 py-20 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                                            <div className={`space-y-6 ${idx % 2 === 0 ? 'order-1' : 'order-2'}`}>
                                              <div className="w-12 h-1.5 rounded-full" style={{ backgroundColor: "var(--accent-color)" }} />
                                              <h2 className="text-4xl font-bold text-gray-900 leading-tight">
                                                {stripHtml(section.content.title || "")}
                                              </h2>
                                              <p className="text-lg text-gray-500 leading-relaxed">
                                                {stripHtml(section.content.text || "")}
                                              </p>
                                              <div className="flex items-center gap-3 text-sm font-bold group cursor-pointer" style={{ color: "var(--primary-color)" }}>
                                                Explore details <Zap className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                              </div>
                                            </div>
                                            <div className={`aspect-video md:aspect-[16/10] rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl ring-1 ring-gray-100 bg-gray-50 relative group ${idx % 2 === 0 ? 'order-2' : 'order-1'}`}>
                                              {pageStructure.images[imgIdx] ? (
                                                <img 
                                                  src={pageStructure.images[imgIdx]} 
                                                  alt="Section Image" 
                                                  className="w-full h-full object-cover object-center hover:scale-110 transition-transform duration-1000 ease-in-out" 
                                                  referrerPolicy="no-referrer" 
                                                />
                                              ) : (
                                                <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-gray-200">
                                                  <LayoutIcon className="w-12 h-12 text-gray-200" />
                                                </div>
                                              )}
                                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                            </div>
                                          </section>
                                        );
                                      }
                                      if (section.type === "social_proof_slider") {
                                        return (
                                          <section key={idx} className="px-10 py-16 bg-gray-50 text-center">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-8">Trusted by thousands</p>
                                            <div className="flex flex-wrap justify-center gap-12 opacity-30 grayscale">
                                              <div className="font-black text-2xl italic">LOGO</div>
                                              <div className="font-black text-2xl italic">LOGO</div>
                                              <div className="font-black text-2xl italic">LOGO</div>
                                            </div>
                                          </section>
                                        );
                                      }
                                      return null;
                                    })}
                                    <footer className="px-10 py-12 bg-gray-900 text-white text-center">
                                      <p className="text-xs opacity-50">© 2026 Personalized Experience. All rights reserved.</p>
                                    </footer>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            <div className="flex justify-end gap-3">
                              <Button variant="outline" className="rounded-xl px-6 font-bold" onClick={copyToClipboard}>
                                {copied ? "Copied!" : "Copy Code"}
                              </Button>
                              <Button className="bg-blue-600 hover:bg-blue-700 rounded-xl px-6 font-bold shadow-lg shadow-blue-100">
                                Download Component
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <Skeleton className="h-[200px] w-full" />
                            <div className="flex justify-between">
                              <Skeleton className="h-4 w-1/3" />
                              <Skeleton className="h-8 w-24" />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-16 border-t border-gray-100 mt-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3 opacity-40">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-lg tracking-tight">Troopod</span>
            <span className="text-xs font-medium uppercase tracking-widest ml-2">© 2026 Personalization Engine</span>
          </div>
          <div className="flex items-center gap-10 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
            <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-blue-600 transition-colors">API Docs</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
