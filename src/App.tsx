import { 
  Search, 
  CalendarCheck, 
  Sparkles, 
  MapPin, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  LayoutGrid, 
  Calendar as CalendarIcon, 
  Camera,
  X,
  Zap,
  Image as ImageIcon,
  ScanText,
  ChevronLeft,
  Plus,
  Mail,
  Lock,
  User,
  Clock,
  Check,
  Eye,
  Tag,
  Trash2,
  Bell,
  BellOff,
  AlertCircle,
  Pencil,
  LogOut,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useMemo, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI, Type } from "@google/genai";
import Tesseract from 'tesseract.js';
import { 
  db, 
  auth, 
  signInWithGoogle, 
  logout, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc 
} from 'firebase/firestore';
import { FirebaseProvider, useFirebase } from './components/FirebaseProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';

const ProfileImage = "https://lh3.googleusercontent.com/aida-public/AB6AXuA7IFsCoj3jwfO0P3gjqP7M1eR7O8EFdLW1yzJipZ-ARXSTfY2kRZP25TuBHfPho6Mm7tIS3ekxy7I-BtYAi8sJPmsG-8WbQ94CwdHIG7-Sxw3iGE46SEzo-BopMaML5rTEwdj_loAbSOdaeO1CnlAcPie5zPKLU8tHuiATiky9vPWPHGuiV5FEc0fWA0BYpbCajBewISMGuV9TkJKyiXy5vLrNutxteYfsrY1QZLiYA5hrQdLeUMRZwQ7k_nuCLRi8U8gePL--rhw";

const ScannedImages = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBzeMrDD2RcbFec0EYLExJ921XTVlvm20DTA7sR4pvwHi2ijGViKlQgJZF5UZ0ASV_SrB3mu-dCmHzRYkl77OK07px2kJGGEu0HFVWG3NLjMAXhazfKm5OX7l4fY3ZZP7iFMq02-yU8oyjNcUyJHDdwIcV9-b7zugqTkrefmqH0g-FK-1Fxnq-CIFVoJ0T5_wvAGJ-l6EuQZOuSMZDEnANBDuojZGfBjzC37zVVpa6Zw9zDZW0wACr-SiVIvDGFVuva2xjfOXIoNa4",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAVbXDxN15zgiuT8LDloobn0A90X4jcXcMCaaUqlW75Jikgh4OZWXA2dcftQJZoDYrJpvTTurtop8a1MuiPoDr5cGelfWZSDvJaia3RgUfR3drNnknc3V4PZsRc-HjOKNwHAB-zbm5oWFkU61Cz4gcsUqz6AB4sI-t4JcfUSeRhH0ZGlhStywQf7J4mMZaJeve3VzwBikCMeX2-Y6OUIWV-u0jWHmhPIUi_EB0XZ6HQXivTCSK5qFV6hEi6TL8As1O1V51CLLwB0I0",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDuo7lXGDljrLuE2m5ti9yr03ov8jM9PXHHma9MleDfS63kAg0Rg6lW3NzZaFK6jT1xb_cyigulxf30dm0FMySU4e93aHcI2lmR2YYza9z-sU6Mxp6oA5euxbCXdb-s0gOblCwlV8JicPRG-Q-Nn_DQNxgUHcJzVhOSpdFaHUDL_P7VRgiDCPisxK59TDpLN8eLMxuE_PupD4FTXv5mKEhQzmsPWIelXIeUmCVw1s6odAIYLTKGilFsHMKbJrbTp-5goagpjkNFy6g"
];

const getEventStatus = (event: Event) => {
  const now = new Date();
  const eventDate = new Date(event.date);
  
  // Check if it's past the end time
  if (event.endTime) {
    const endDateTime = parseTimeString(event.endTime, eventDate);
    if (now > endDateTime) return "Past Event";
  } else if (event.startTime) {
    // If no end time, assume it lasts 2 hours or just check if now is past start time + some buffer
    // But user specifically asked "after the event's end time"
    // If only start time exists, we can't be sure, but let's check if now is past start time
    const startDateTime = parseTimeString(event.startTime, eventDate);
    // If it's a different day in the past, it's definitely past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDay = new Date(eventDate);
    eventDay.setHours(0, 0, 0, 0);
    
    if (eventDay < today) return "Past Event";
    // If it's today and now is past start time (assuming 3 hours duration if no end time)
    if (eventDay.getTime() === today.getTime() && now.getTime() > startDateTime.getTime() + (3 * 60 * 60 * 1000)) {
      return "Past Event";
    }
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDay = new Date(eventDate);
    eventDay.setHours(0, 0, 0, 0);
    if (eventDay < today) return "Past Event";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const eventDay = new Date(eventDate);
  eventDay.setHours(0, 0, 0, 0);
  
  const diffTime = eventDay.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Check if it's "Tonight" (after 6 PM)
    let isEvening = false;
    if (event.startTime) {
      const startDateTime = parseTimeString(event.startTime, eventDate);
      if (startDateTime.getHours() >= 18) isEvening = true;
    } else if (eventDate.getHours() >= 18) {
      isEvening = true;
    }
    
    return isEvening ? "Tonight" : "Today";
  }
  
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays} Days`;
  if (diffDays < 14) return "Next Week";

  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const isNextMonth = eventDate.getMonth() === nextMonth.getMonth() && eventDate.getFullYear() === nextMonth.getFullYear();
  
  if (isNextMonth) return "Next Month";
  
  return `In ${eventDate.toLocaleString('default', { month: 'long' })}`;
};

function parseTimeString(timeStr: string, baseDate: Date): Date {
  if (!timeStr) return baseDate;
  
  const newDate = new Date(baseDate);
  
  // Try to match HH:MM AM/PM or HH:MM or HH AM/PM
  const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const ampm = timeMatch[3]?.toUpperCase();
    
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    
    newDate.setHours(hours, minutes, 0, 0);
  }
  
  return newDate;
}

async function preprocessImage(base64Image: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Image);
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Apply simple contrast/brightness boost
      // This helps Tesseract and Gemini see text better
      ctx.filter = 'contrast(1.2) brightness(1.1) sharp(1)';
      ctx.drawImage(canvas, 0, 0);

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(base64Image);
    img.src = base64Image;
  });
}

async function extractInvitationData(base64Image: string): Promise<Partial<Event> | null> {
  try {
    const apiKey = "YOUR_API_KEY";
    if (!apiKey) {
      throw new Error(`Gemini API Key is missing or empty. Please check your environment variables.`);
    }

    // Pre-process image to improve OCR
    const processedImage = await preprocessImage(base64Image);

    let extractedText = "";
    try {
      console.log("Attempting OCR with Tesseract.js...");
      const ocrResult = await Tesseract.recognize(
        processedImage,
        'eng',
        { logger: m => console.log(m) }
      );
      extractedText = ocrResult.data.text;
      console.log("Tesseract Extracted Text:", extractedText);
    } catch (ocrErr) {
      console.error("Tesseract OCR failed, proceeding with direct vision analysis:", ocrErr);
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: `TASK: Extract event invitation details from the provided image.
              
              OCR TEXT HINT (may be incomplete or contain errors):
              "${extractedText}"
              
              INSTRUCTIONS:
              1. Analyze the image carefully. It is an invitation to an event.
              2. Extract: Title/Event Name, Location, Date, Start Time, End Time.
              3. Be EXTREMELY lenient. If you see any text that looks like a title, use it.
              4. If the date is relative (e.g., "This Saturday"), assume the current year is 2026.
              5. If you find ANY information at all, set isValid: true.
              6. Return the result as a JSON object.`
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: processedImage.split(',')[1] || processedImage,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN, description: "Set to true if you found ANY event-related text" },
            title: { type: Type.STRING, description: "Name of the event" },
            location: { type: Type.STRING, description: "Where the event is held" },
            date: { type: Type.STRING, description: "Date of the event (YYYY-MM-DD)" },
            startTime: { type: Type.STRING, description: "Start time (e.g. 7:00 PM)" },
            endTime: { type: Type.STRING, description: "End time if available" },
          },
          required: ["isValid"],
        },
      },
    });

    console.log("Gemini Parsing Response:", response.text);
    const data = JSON.parse(response.text);
    
    // Even if isValid is false, if we have a title, we'll take it
    const hasAnyData = data.title || data.location || data.date || data.startTime || data.endTime;
    
    if (!hasAnyData && !data.isValid) {
      console.warn("No data found in image or text after Gemini analysis");
      return null;
    }

    let eventDate = data.date ? new Date(data.date) : new Date();
    if (isNaN(eventDate.getTime())) {
      eventDate = new Date();
    }
    if (data.startTime) {
      eventDate = parseTimeString(data.startTime, eventDate);
    }

    return {
      title: data.title || "New Event",
      location: data.location || "",
      date: eventDate,
      startTime: data.startTime || "",
      endTime: data.endTime || "",
    } as any;
  } catch (error) {
    console.error("Extraction error:", error);
    return null;
  }
}

interface Event {
  id: string;
  title: string;
  location: string;
  date: Date;
  status: string;
  isNew?: boolean;
  notificationEnabled?: boolean;
  notificationTime?: string;
  image?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  aiSuggestions?: string;
}

interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  joinedDate: string;
  scannedCount: number;
}

function Dashboard({ events, onOpenScanner, onOpenAuth, onViewAll, onDeleteEvent, onToggleNewFilter, onShowAllEvents, isNewFilterActive, onViewEventDetails, user, notificationPermission, requestNotificationPermission }: { 
  events: Event[], 
  onOpenScanner: () => void, 
  onOpenAuth: () => void, 
  onViewAll: () => void, 
  onDeleteEvent: (id: string) => void,
  onToggleNewFilter: () => void,
  onShowAllEvents: () => void,
  isNewFilterActive: boolean,
  onViewEventDetails: (event: Event) => void,
  user: UserProfile | null,
  notificationPermission: NotificationPermission,
  requestNotificationPermission: () => Promise<NotificationPermission>
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpcomingEventsExpanded, setIsUpcomingEventsExpanded] = useState(true);
  const [isRecentlyScannedExpanded, setIsRecentlyScannedExpanded] = useState(true);
  
  const activeEventsCount = useMemo(() => {
    return events.filter(e => getEventStatus(e) !== "Past Event").length;
  }, [events]);

  const newEventsCount = useMemo(() => events.filter(e => e.isNew).length, [events]);

  const filteredEvents = useMemo(() => {
    let result = events.filter(e => getEventStatus(e) !== "Past Event");

    if (isNewFilterActive) {
      result = result.filter(e => e.isNew);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(e => {
        const titleMatch = e.title.toLowerCase().includes(query);
        const monthName = e.date.toLocaleString('default', { month: 'long' }).toLowerCase();
        const monthShort = e.date.toLocaleString('default', { month: 'short' }).toLowerCase();
        const monthMatch = monthName.includes(query) || monthShort.includes(query);
        return titleMatch || monthMatch;
      });
    }
    
    // Sort strictly by date
    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, isNewFilterActive, searchQuery]);

  const recentlyScanned = useMemo(() => {
    return [...events]
      .filter(e => e.image)
      .reverse()
      .slice(0, 6);
  }, [events]);

  return (
    <div className="min-h-screen pb-32 relative overflow-x-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full -z-50 pointer-events-none">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-app-secondary/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-app-primary/10 blur-[80px] rounded-full" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-app-bg/80 ios-blur px-6 pt-12 pb-4">
        <div className="flex justify-between items-center mb-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col"
          >
            <h1 className="text-3xl font-extrabold tracking-tight text-app-text-main">
              InviScan
            </h1>
            <p className="text-[10px] italic text-app-text-muted font-medium mt-0.5">
              Never miss an Invite that matters✨
            </p>
          </motion.div>
        <div className="flex items-center gap-3">
          {notificationPermission !== 'granted' && (
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={requestNotificationPermission}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-10 h-10 rounded-full bg-app-primary/10 flex items-center justify-center text-app-primary border border-app-primary/20 cursor-pointer"
              title="Enable Notifications"
            >
              <Bell size={20} />
            </motion.button>
          )}
          <motion.div 
            whileTap={{ scale: 0.9 }}
            onClick={onOpenAuth}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-10 h-10 rounded-full bg-app-secondary flex items-center justify-center overflow-hidden border border-app-primary/20 cursor-pointer"
          >
            <img 
              alt="Profile" 
              className="w-full h-full object-cover" 
              src={user?.avatar || ProfileImage} 
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>
      </div>
      <div className="relative group">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-app-primary/60 group-focus-within:text-app-primary transition-colors">
            <Search size={20} />
          </span>
          <input 
            className="block w-full pl-10 pr-3 py-3 bg-app-secondary/30 border-none rounded-2xl focus:ring-2 focus:ring-app-primary text-sm placeholder-app-text-muted/60 text-app-text-main transition-all outline-none" 
            placeholder="Search invitations..." 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      <main className="px-6">
        {/* Overview Section */}
        {!searchQuery && (
          <section className="mt-4 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-app-primary">Overview</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <motion.div 
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.95 }}
                onClick={onShowAllEvents}
                className={`p-4 rounded-2xl text-white shadow-lg shadow-app-primary/30 cursor-pointer transition-all ${
                  !isNewFilterActive ? 'bg-app-primary ring-2 ring-white/20' : 'bg-app-primary/80 grayscale-[0.2]'
                }`}
              >
                <CalendarCheck size={24} className="mb-2" />
                <div className="text-2xl font-bold leading-none">{activeEventsCount}</div>
                <div className="text-[10px] opacity-80 font-semibold uppercase mt-1">Active Events</div>
              </motion.div>
              <motion.div 
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleNewFilter}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isNewFilterActive 
                    ? 'bg-app-primary text-white border-app-primary shadow-lg shadow-app-primary/30' 
                    : 'bg-app-secondary p-4 rounded-2xl border border-app-primary/10'
                }`}
              >
                <Sparkles size={24} className={`mb-2 ${isNewFilterActive ? 'text-white' : 'text-app-primary'}`} />
                <div className={`text-2xl font-bold leading-none ${isNewFilterActive ? 'text-white' : 'text-app-text-main'}`}>
                  {newEventsCount}
                </div>
                <div className={`text-[10px] font-semibold uppercase mt-1 ${isNewFilterActive ? 'text-white/80' : 'text-app-text-muted'}`}>
                  {isNewFilterActive ? 'Showing New' : 'New Scans'}
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {/* Upcoming Events Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div 
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => setIsUpcomingEventsExpanded(!isUpcomingEventsExpanded)}
            >
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-app-primary group-hover:opacity-70 transition-opacity">
                {isNewFilterActive ? 'Recently Added Scans' : 'Upcoming Events'}
              </h2>
              <motion.div
                animate={{ rotate: isUpcomingEventsExpanded ? 0 : -90 }}
                transition={{ duration: 0.2 }}
                className="text-app-primary"
              >
                <ChevronDown size={14} />
              </motion.div>
            </div>
            <div className="flex items-center gap-3">
              {isNewFilterActive && (
                <button 
                  onClick={onToggleNewFilter}
                  className="text-[10px] font-bold text-app-text-muted hover:text-app-primary transition-colors"
                >
                  Clear Filter
                </button>
              )}
              {!isNewFilterActive && (
                <button 
                  onClick={onViewAll}
                  className="text-xs font-bold text-app-primary hover:opacity-70 transition-opacity"
                >
                  View All
                </button>
              )}
            </div>
          </div>
          <AnimatePresence initial={false}>
            {isUpcomingEventsExpanded && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="space-y-4 pt-1 pb-4">
                  {filteredEvents.length === 0 ? (
                    <div className="py-16 text-center">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-4 flex justify-center"
                      >
                        <div className="bg-app-secondary/30 p-6 rounded-full">
                          <Search size={40} className="text-app-text-muted/30" />
                        </div>
                      </motion.div>
                      <h3 className="text-app-text-main font-bold text-lg">No results found</h3>
                      <p className="text-app-text-muted text-sm mt-1">
                        {searchQuery 
                          ? `We couldn't find any events matching "${searchQuery}"`
                          : isNewFilterActive ? "No new scans found." : "Your event list is empty."}
                      </p>
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="mt-6 text-app-primary font-bold text-sm hover:underline"
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredEvents.map((event, idx) => {
                      const status = getEventStatus(event);
                      const isPast = status === "Past Event";
                      
                      return (
                        <motion.div 
                          key={event.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className={`bg-white/80 border border-app-secondary/40 rounded-3xl p-5 flex flex-col gap-4 relative overflow-hidden card-shadow ${isPast ? 'opacity-60 grayscale-[0.5]' : ''}`}
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-app-secondary/20 rounded-full -mr-16 -mt-16" />
                          <div className="flex justify-between items-start z-10">
                            <div className="flex-1">
                              <h3 className="font-bold text-lg mb-1 leading-tight text-app-text-main">{event.title}</h3>
                              <div className="flex items-center text-app-text-muted text-xs">
                                <MapPin size={14} className="mr-1" />
                                <span>{event.location}</span>
                              </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm whitespace-nowrap ${isPast ? 'bg-app-text-muted text-white' : 'bg-app-primary text-white'}`}>
                              {status}
                            </div>
                          </div>
                        <div className="flex items-center justify-between z-10">
                          <div className="flex items-center gap-3">
                            <div className="bg-app-secondary/40 p-2 rounded-xl flex flex-col items-center min-w-[50px]">
                              <span className="text-[10px] uppercase font-bold text-app-primary">
                                {event.date.toLocaleString('default', { month: 'short' })}
                              </span>
                              <span className="text-lg font-extrabold text-app-text-main">
                                {event.date.getDate()}
                              </span>
                            </div>
                            <div className="text-sm font-semibold text-app-text-muted">
                              {event.date.toLocaleString('default', { weekday: 'long' })}, {event.startTime || event.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => onDeleteEvent(event.id)}
                              className="text-red-500 bg-red-50 p-2.5 rounded-full shadow-sm active:scale-90 transition-transform"
                            >
                              <Trash2 size={16} />
                            </button>
                            <button 
                              onClick={() => onViewEventDetails(event)}
                              className="text-white bg-app-primary p-2.5 rounded-full shadow-md active:scale-90 transition-transform"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Recently Scanned Section */}
        {recentlyScanned.length > 0 && (
          <section className="mt-8">
            <div 
              className="flex items-center gap-2 cursor-pointer group mb-4"
              onClick={() => setIsRecentlyScannedExpanded(!isRecentlyScannedExpanded)}
            >
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-app-primary group-hover:opacity-70 transition-opacity">
                Recently Scanned
              </h2>
              <motion.div
                animate={{ rotate: isRecentlyScannedExpanded ? 0 : -90 }}
                transition={{ duration: 0.2 }}
                className="text-app-primary"
              >
                <ChevronDown size={14} />
              </motion.div>
            </div>
            <AnimatePresence initial={false}>
              {isRecentlyScannedExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="flex overflow-x-auto gap-4 pb-4 hide-scrollbar">
                    {recentlyScanned.map((event) => {
                      const isPast = getEventStatus(event) === "Past Event";
                      return (
                        <motion.div 
                          key={event.id}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => onViewEventDetails(event)}
                          className={`flex-shrink-0 w-32 bg-app-secondary/30 p-3 rounded-2xl border border-app-secondary/40 cursor-pointer ${isPast ? 'opacity-60 grayscale-[0.5]' : ''}`}
                        >
                          <div className="w-full aspect-[3/4] rounded-xl bg-app-secondary/50 mb-2 overflow-hidden shadow-inner">
                            <img 
                              alt={event.title} 
                              className="w-full h-full object-cover" 
                              src={event.image} 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="text-[10px] font-bold text-app-text-main truncate text-center uppercase tracking-tight">
                            {event.title}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}
      </main>
    </div>
  );
}

function CalendarScreen({ events, onDeleteEvent, onViewEventDetails }: { events: Event[], onDeleteEvent: (id: string) => void, onViewEventDetails: (event: Event) => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isDateSelected, setIsDateSelected] = useState(false);
  
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
    
    // Fill leading empty days
    const firstDay = date.getDay();
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    // Fill actual days
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    
    return days;
  }, [currentDate]);

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();

  const getEventsForDay = (day: Date) => {
    return events.filter(e => 
      e.date.getDate() === day.getDate() && 
      e.date.getMonth() === day.getMonth() && 
      e.date.getFullYear() === day.getFullYear()
    );
  };

  return (
    <div className="min-h-screen pb-32 relative overflow-x-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full -z-50 pointer-events-none">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-app-secondary/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-app-primary/10 blur-[80px] rounded-full" />
      </div>

      <header className="sticky top-0 z-40 bg-app-bg/80 ios-blur px-6 pt-12 pb-4">
        <div className="flex justify-center items-center mb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
                setIsDateSelected(false);
              }}
              className="p-2 rounded-full bg-app-secondary/30 text-app-primary active:scale-90 transition-transform"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="font-bold text-app-text-main min-w-[140px] text-center text-lg tracking-tight">
              {monthName} {year}
            </span>
            <button 
              onClick={() => {
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
                setIsDateSelected(false);
              }}
              className="p-2 rounded-full bg-app-secondary/30 text-app-primary active:scale-90 transition-transform"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="px-6">
        <div className="bg-white/80 border border-app-secondary/40 rounded-3xl p-6 card-shadow">
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
              <div key={`${day}-${idx}`} className="text-center text-[10px] font-bold text-app-primary uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {daysInMonth.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;
              
              const dayEvents = getEventsForDay(day);
              const isToday = day.toDateString() === new Date().toDateString();
              const isSelected = selectedDate && day.toDateString() === selectedDate.toDateString();
              
              return (
                <motion.div 
                  key={day.toISOString()}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setSelectedDate(day);
                    setIsDateSelected(true);
                  }}
                  className={`relative aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all cursor-pointer
                    ${isSelected 
                      ? (dayEvents.length > 0 
                          ? 'bg-app-primary text-white shadow-lg shadow-app-primary/30 scale-110 z-10' 
                          : 'bg-app-secondary/40 text-app-text-main ring-2 ring-app-primary scale-110 z-10')
                      : (dayEvents.length > 0 
                          ? 'bg-app-primary text-white' 
                          : 'bg-app-secondary/20 text-app-text-main hover:bg-app-secondary/40')
                    }
                    ${isToday && !isSelected ? 'ring-2 ring-app-primary/50 ring-offset-2' : ''}
                  `}
                >
                  {day.getDate()}
                  {dayEvents.length > 0 && (
                    <div className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected || dayEvents.length > 0 ? 'bg-white/60' : 'bg-app-primary'}`} />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-app-primary">
              {isDateSelected && selectedDate 
                ? `Events for ${selectedDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })}` 
                : `Events in ${monthName} ${year}`}
            </h2>
          </div>
          <div className="space-y-3">
            {(() => {
              const filteredEvents = isDateSelected && selectedDate
                ? events.filter(e => 
                    e.date.getDate() === selectedDate.getDate() && 
                    e.date.getMonth() === selectedDate.getMonth() && 
                    e.date.getFullYear() === selectedDate.getFullYear()
                  )
                : events.filter(e => 
                    e.date.getMonth() === currentDate.getMonth() && 
                    e.date.getFullYear() === currentDate.getFullYear()
                  );

              const sortedEvents = [...filteredEvents].sort((a, b) => a.date.getTime() - b.date.getTime());

              if (sortedEvents.length === 0) {
                return (
                  <div className="py-8 text-center">
                    <p className="text-app-text-muted text-sm italic">No events scheduled for this period.</p>
                  </div>
                );
              }

              return sortedEvents.map((event) => (
                <motion.div 
                  key={event.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onViewEventDetails(event)}
                  className="flex items-center gap-4 bg-white/60 p-4 rounded-2xl border border-app-secondary/20 cursor-pointer hover:bg-white/80 transition-colors"
                >
                  <div className="bg-app-primary/10 p-3 rounded-xl flex flex-col items-center min-w-[50px]">
                    <span className="text-[10px] uppercase font-bold text-app-primary">
                      {event.date.toLocaleString('default', { month: 'short' })}
                    </span>
                    <span className="text-lg font-extrabold text-app-primary">
                      {event.date.getDate()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-app-text-main text-sm">{event.title}</h4>
                    <p className="text-xs text-app-text-muted">{event.location}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-[10px] font-bold text-app-primary uppercase">{event.startTime || event.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEvent(event.id);
                      }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ));
            })()}
          </div>
        </section>
      </main>
    </div>
  );
}

async function getEventPrepAdvice(event: Event): Promise<string> {
  try {
    const apiKey = "YOUR_API_KEY";
    if (!apiKey) {
      throw new Error("Gemini API Key is missing.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert event coordinator and personal assistant. 
      Analyze the following event and provide helpful "Prep Advice" in a concise, friendly format.
      Include:
      1. Dress Code suggestions based on the event type and location.
      2. Gift Ideas if applicable (e.g., weddings, birthdays).
      3. Travel/Prep tips (e.g., "Arrive 15 mins early for parking").
      4. A fun "Vibe" description.

      Event Details:
      Title: ${event.title}
      Location: ${event.location}
      Date: ${event.date.toLocaleString()}
      Notes: ${event.notes || "None"}

      Format the response as a clean list with emojis. 
      IMPORTANT: Make the headings (like Dress Code, Gift Ideas, etc.) bold using markdown syntax (e.g., **Dress Code**).
      Keep it under 150 words.`,
    });

    const response = await model;
    return response.text || "No advice available at this time.";
  } catch (error) {
    console.error("Failed to get AI advice:", error);
    return "Sorry, I couldn't generate advice right now. Please try again later.";
  }
}

function EventDetailsScreen({ event, onClose, onSave, onNotify }: { event: Event, onClose: () => void, onSave: (event: Event) => void, onNotify: (event: Event) => void }) {
  const [editedEvent, setEditedEvent] = useState<Event>({
    ...event,
    date: new Date(event.date)
  });
  const [isEditing, setIsEditing] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(event.notificationEnabled ?? true);
  const [notificationTime, setNotificationTime] = useState(event.notificationTime ?? '1 hour before');
  const [showFullScan, setShowFullScan] = useState(false);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  const [aiAdvice, setAiAdvice] = useState(event.aiSuggestions || "");

  const handleSave = () => {
    onSave({
      ...editedEvent,
      notificationEnabled,
      notificationTime,
      aiSuggestions: aiAdvice
    });
    setIsEditing(false);
  };

  const generateAdvice = async () => {
    setIsGeneratingAdvice(true);
    const advice = await getEventPrepAdvice(editedEvent);
    setAiAdvice(advice);
    setIsGeneratingAdvice(false);
    
    // Automatically persist the advice to the database so it's not lost
    onSave({
      ...editedEvent,
      aiSuggestions: advice,
      notificationEnabled,
      notificationTime
    });
  };

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeForInput = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleDateChange = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const newDate = new Date(editedEvent.date);
    newDate.setFullYear(year, month - 1, day);
    setEditedEvent({ ...editedEvent, date: newDate });
  };

  const handleTimeChange = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const newDate = new Date(editedEvent.date);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    setEditedEvent({ ...editedEvent, date: newDate });
  };

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 bg-app-bg z-[100] flex flex-col"
    >
      <header className="px-6 pt-12 pb-6 flex items-center justify-between bg-white/40 ios-blur border-b border-app-secondary/20">
        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-app-secondary/20 flex items-center justify-center text-app-primary"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-app-text-main">Event Details</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowReminders(!showReminders)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              showReminders ? 'bg-app-primary text-white shadow-lg' : 'bg-app-secondary/20 text-app-primary'
            }`}
          >
            <Bell size={20} />
          </button>
          <button 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isEditing 
                ? 'bg-app-primary text-white shadow-lg shadow-app-primary/30' 
                : 'bg-app-secondary/20 text-app-primary'
            }`}
          >
            {isEditing ? <Check size={20} /> : <Pencil size={20} />}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-8 relative">
        <AnimatePresence>
          {showReminders && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-0 left-0 right-0 z-50 p-6 bg-app-bg/95 backdrop-blur-xl border-b border-app-secondary/20 shadow-2xl"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-app-text-main">Reminders & Alerts</h3>
                  <button onClick={() => setShowReminders(false)} className="text-app-text-muted">
                    <X size={18} />
                  </button>
                </div>
                
                <div className="bg-white border border-app-secondary/40 rounded-3xl overflow-hidden shadow-sm">
                  <div className="p-5 flex items-center justify-between border-b border-app-secondary/20">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl transition-colors ${notificationEnabled ? 'bg-app-primary/10 text-app-primary' : 'bg-gray-100 text-gray-400'}`}>
                        {notificationEnabled ? <Bell size={22} /> : <BellOff size={22} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-app-text-main">Event Notification</p>
                        <p className="text-[10px] text-app-text-muted/60 font-medium">Alert me before event starts</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setNotificationEnabled(!notificationEnabled)}
                      className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${notificationEnabled ? 'bg-app-primary' : 'bg-gray-200'}`}
                    >
                      <motion.div 
                        animate={{ x: notificationEnabled ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>
                  
                  <AnimatePresence>
                    {notificationEnabled && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-5 bg-app-secondary/5 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-app-text-main">Notification Time</span>
                            <select 
                              value={notificationTime}
                              onChange={(e) => setNotificationTime(e.target.value)}
                              className="bg-transparent border-none text-xs font-bold text-app-primary focus:ring-0 cursor-pointer"
                            >
                              <option>15 minutes before</option>
                              <option>30 minutes before</option>
                              <option>1 hour before</option>
                              <option>2 hours before</option>
                              <option>1 day before</option>
                            </select>
                          </div>
                          
                          <button 
                            onClick={() => onNotify(event)}
                            className="w-full py-3 bg-app-primary text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-app-primary/20 flex items-center justify-center gap-2"
                          >
                            <Mail size={14} />
                            Send Test Email Reminder
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <p className="text-[10px] text-center text-app-text-muted font-medium">Changes are saved automatically when you save the event.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Event Header Card */}
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-app-primary/5 border border-app-secondary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-app-secondary/10 rounded-full -mr-16 -mt-16" />
          
          <div className="relative z-10 space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-app-primary/60 ml-1">Event Title</label>
                  <input 
                    type="text"
                    value={editedEvent.title}
                    onChange={(e) => setEditedEvent({ ...editedEvent, title: e.target.value })}
                    className="w-full bg-app-secondary/10 border-none rounded-2xl px-4 py-3 text-app-text-main font-bold focus:ring-2 focus:ring-app-primary outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-app-primary/60 ml-1">Location</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-primary" />
                    <input 
                      type="text"
                      value={editedEvent.location}
                      onChange={(e) => setEditedEvent({ ...editedEvent, location: e.target.value })}
                      className="w-full bg-app-secondary/10 border-none rounded-2xl pl-12 pr-4 py-3 text-app-text-main font-semibold focus:ring-2 focus:ring-app-primary outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-black text-app-text-main leading-tight">{event.title}</h2>
                <div className="flex items-center text-app-text-muted font-medium">
                  <MapPin size={18} className="mr-2 text-app-primary" />
                  <span>{event.location}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Date & Time Section */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-primary ml-1">Date & Time</h3>
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-app-secondary/20 flex flex-col items-center justify-center text-center space-y-2">
              <CalendarIcon size={24} className="text-app-primary mb-1" />
              {isEditing ? (
                <input 
                  type="date"
                  value={formatDateForInput(editedEvent.date)}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full bg-app-secondary/10 border-none rounded-xl px-2 py-2 text-xs font-bold text-center outline-none"
                />
              ) : (
                <>
                  <div className="text-app-text-main font-bold">{event.date.toLocaleDateString('default', { month: 'long', day: 'numeric' })}</div>
                  <div className="text-[10px] text-app-text-muted font-bold uppercase">{event.date.getFullYear()}</div>
                </>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-3xl p-5 border border-app-secondary/20 flex flex-col items-center justify-center text-center space-y-2">
                <Clock size={24} className="text-app-primary mb-1" />
                {isEditing ? (
                  <div className="w-full space-y-1">
                    <label className="text-[8px] font-bold uppercase text-app-primary/60">Start</label>
                    <input 
                      type="text"
                      placeholder="7:00 PM"
                      value={editedEvent.startTime || ''}
                      onChange={(e) => {
                        const newStartTime = e.target.value;
                        const newDate = parseTimeString(newStartTime, editedEvent.date);
                        setEditedEvent({ ...editedEvent, startTime: newStartTime, date: newDate });
                      }}
                      className="w-full bg-app-secondary/10 border-none rounded-xl px-2 py-2 text-xs font-bold text-center outline-none"
                    />
                  </div>
                ) : (
                  <>
                    <div className="text-app-text-main font-bold">{event.startTime || event.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="text-[10px] text-app-text-muted font-bold uppercase">Start Time</div>
                  </>
                )}
              </div>
              <div className="bg-white rounded-3xl p-5 border border-app-secondary/20 flex flex-col items-center justify-center text-center space-y-2">
                <Clock size={24} className="text-app-primary/40 mb-1" />
                {isEditing ? (
                  <div className="w-full space-y-1">
                    <label className="text-[8px] font-bold uppercase text-app-primary/60">End</label>
                    <input 
                      type="text"
                      placeholder="10:00 PM"
                      value={editedEvent.endTime || ''}
                      onChange={(e) => setEditedEvent({ ...editedEvent, endTime: e.target.value })}
                      className="w-full bg-app-secondary/10 border-none rounded-xl px-2 py-2 text-xs font-bold text-center outline-none"
                    />
                  </div>
                ) : (
                  <>
                    <div className="text-app-text-main font-bold">{event.endTime || '—'}</div>
                    <div className="text-[10px] text-app-text-muted font-bold uppercase">End Time</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI Prep Assistant Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between ml-1">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-primary">AI Prep Assistant</h3>
            <button 
              onClick={generateAdvice}
              disabled={isGeneratingAdvice}
              className="flex items-center gap-1 text-[10px] font-bold text-app-primary uppercase tracking-wider bg-app-primary/10 px-3 py-1 rounded-full disabled:opacity-50"
            >
              <Sparkles size={12} />
              {isGeneratingAdvice ? "Thinking..." : aiAdvice ? "Refresh Advice" : "Get Advice"}
            </button>
          </div>
          
          <div className="bg-white rounded-3xl p-6 border border-app-secondary/20 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Sparkles size={48} />
            </div>
            
            {aiAdvice ? (
              <div className="relative z-10">
                <div className="prose prose-sm max-w-none text-app-text-main text-sm leading-relaxed markdown-body">
                  <ReactMarkdown>{aiAdvice}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 bg-app-secondary/10 rounded-full flex items-center justify-center mx-auto text-app-primary/40">
                  <Zap size={24} />
                </div>
                <p className="text-xs text-app-text-muted font-medium px-4">
                  Need help preparing? Let AI analyze the event to suggest dress codes, gift ideas, and more.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Status Section */}
        <div className="bg-app-primary/5 rounded-3xl p-6 border border-app-primary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-app-primary/20 flex items-center justify-center text-app-primary">
                <Zap size={20} />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-app-primary/60">Status</div>
                <div className="text-app-text-main font-bold">{getEventStatus(event)}</div>
              </div>
            </div>
            {event.isNew && (
              <div className="bg-app-primary text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                <Sparkles size={10} />
                New Scan
              </div>
            )}
          </div>
        </div>

        {/* Original Scan Reference */}
        {event.image && (
          <section className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-primary ml-1">Original Scan Reference</h3>
            <div className="flex flex-col items-center">
              <div 
                onClick={() => setShowFullScan(true)}
                className="w-32 h-40 bg-white rounded-2xl shadow-lg border border-app-secondary/30 p-2 overflow-hidden cursor-pointer"
              >
                <img 
                  src={event.image} 
                  alt="Original Scan" 
                  className="w-full h-full object-cover rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>
              <button 
                onClick={() => setShowFullScan(true)}
                className="mt-4 flex items-center gap-2 text-app-primary text-xs font-bold"
              >
                <Eye size={14} />
                Tap to view full scan
              </button>
            </div>
          </section>
        )}

        {/* Actions */}
        {!isEditing && (
          <div className="pt-4 space-y-4">
            <button className="w-full bg-white border border-app-secondary/30 text-app-text-main py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
              <Mail size={20} className="text-app-primary" />
              Send Invitations
            </button>
            <button className="w-full bg-app-primary text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-app-primary/30 active:scale-[0.98] transition-all">
              <Plus size={20} />
              Add to Calendar
            </button>
          </div>
        )}

        {/* Map Section */}
        <div className="space-y-4 pb-8">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-primary">Location Map</h3>
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold uppercase tracking-widest text-app-primary/60 hover:text-app-primary transition-colors flex items-center gap-1"
            >
              Open in Maps
              <ChevronRight size={12} />
            </a>
          </div>
          <div className="w-full h-64 bg-app-secondary/10 rounded-3xl overflow-hidden border border-app-secondary/20 relative group">
            <iframe
              title="Event Location"
              width="100%"
              height="100%"
              frameBorder="0"
              style={{ border: 0 }}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(event.location)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
              allowFullScreen
            />
            <div className="absolute inset-0 pointer-events-none border-2 border-transparent group-hover:border-app-primary/20 transition-colors rounded-3xl" />
          </div>
        </div>
      </main>

      {/* Full Screen Scan View */}
      <AnimatePresence>
        {showFullScan && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black flex flex-col"
          >
            <header className="p-6 flex justify-between items-center">
              <button 
                onClick={() => setShowFullScan(false)}
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white"
              >
                <X size={20} />
              </button>
              <span className="text-white font-bold">Original Invitation</span>
              <div className="w-10" />
            </header>
            <div className="flex-1 flex items-center justify-center p-4">
              <img 
                src={event.image} 
                alt="Full Scan" 
                className="max-w-full max-h-full object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ViewAllScreen({ events, onClose, onDeleteEvent, onViewEventDetails }: { 
  events: Event[], 
  onClose: () => void, 
  onDeleteEvent: (id: string) => void,
  onViewEventDetails: (event: Event) => void
}) {
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      className="fixed inset-0 z-[100] bg-app-bg flex flex-col overflow-y-auto pb-32"
    >
      {/* Background Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-app-secondary/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-app-primary/10 blur-[80px] rounded-full" />
      </div>

      <header className="sticky top-0 z-40 bg-app-bg/80 backdrop-blur-md px-6 pt-12 pb-4 flex items-center gap-4">
        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-app-secondary/40 flex items-center justify-center text-app-primary"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-2xl font-extrabold text-app-text-main tracking-tight">All Events</h2>
      </header>

      <main className="px-6 mt-6 space-y-4">
        {sortedEvents.map((event, idx) => {
          const status = getEventStatus(event);
          const isPast = status === "Past Event";
          
          return (
            <motion.div 
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-white/80 border border-app-secondary/40 rounded-3xl p-5 flex flex-col gap-4 relative overflow-hidden card-shadow ${isPast ? 'opacity-60 grayscale-[0.5]' : ''}`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-app-secondary/20 rounded-full -mr-16 -mt-16" />
              <div className="flex justify-between items-start z-10">
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1 leading-tight text-app-text-main">{event.title}</h3>
                  <div className="flex items-center gap-2 text-app-text-muted text-xs">
                    <MapPin size={14} className="text-app-primary/60" />
                    <span className="line-clamp-1">{event.location}</span>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full ${isPast ? 'bg-app-text-muted/20' : 'bg-app-primary/10'}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isPast ? 'text-app-text-muted' : 'text-app-primary'}`}>{status}</span>
                </div>
              </div>
            
            <div className="flex items-center justify-between mt-2 pt-4 border-t border-app-secondary/20 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-app-secondary/40 flex items-center justify-center text-app-primary">
                  <CalendarIcon size={18} />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-app-text-muted/60 uppercase tracking-widest">Date</div>
                  <div className="text-xs font-bold text-app-text-main">
                    {event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onDeleteEvent(event.id)}
                  className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center shadow-sm"
                >
                  <Trash2 size={18} />
                </button>
                <button 
                  onClick={() => onViewEventDetails(event)}
                  className="w-10 h-10 rounded-full bg-app-primary text-white flex items-center justify-center shadow-lg shadow-app-primary/20"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        );
      })}
      </main>
    </motion.div>
  );
}

function CameraScreen({ onClose, onScanComplete }: { onClose: () => void, onScanComplete: (e: Partial<Event>) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = "YOUR_API_KEY";
    if (!apiKey) {
      setError("Gemini API Key is missing. OCR features will only work within the AI Studio preview or when configured in the environment.");
    }
  }, []);

  const toggleFlash = async () => {
    const nextState = !isFlashOn;
    setIsFlashOn(nextState);
    
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      if (capabilities.torch) {
        try {
          await track.applyConstraints({
            advanced: [{ torch: nextState }]
          } as any);
        } catch (e) {
          console.error("Flash toggle failed", e);
        }
      }
    }
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;

      // Apply initial flash state if supported
      if (isFlashOn) {
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities() as any;
        if (capabilities.torch) {
          try {
            await track.applyConstraints({
              advanced: [{ torch: true }]
            } as any);
          } catch (e) {
            console.error("Initial flash failed", e);
          }
        }
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("Camera permission was denied. Please allow camera access in your browser settings and try again.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError("No camera found on this device.");
      } else {
        setError("Could not access camera. Please check permissions or try using the gallery.");
      }
    }
  };

  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleScan = async () => {
    if (!videoRef.current) return;
    
    setIsScanning(true);
    setError(null);

    try {
      // Capture frame
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");
      
      ctx.drawImage(videoRef.current, 0, 0);
      const base64Image = canvas.toDataURL('image/jpeg', 0.8);

      const data = await extractInvitationData(base64Image);
      
      if (data) {
        onScanComplete({ ...data, image: base64Image });
      } else {
        setError("No valid invitation found. Please try again or enter details manually.");
      }
    } catch (err: any) {
      console.error("Scan error:", err);
      setError(err.message || "An error occurred during scanning. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[100] bg-[#1A0B2E] flex flex-col"
    >
      {/* Top Bar */}
      <div className="safe-top flex justify-between items-center px-6 pt-8 pb-1">
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/90 border border-white/5"
        >
          <X size={18} />
        </motion.button>
        
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/5">
          <div className="w-1.5 h-1.5 rounded-full bg-app-secondary animate-pulse" />
          <span className="text-[8px] font-bold text-white/90 uppercase tracking-[0.2em]">Scanner Active</span>
        </div>

        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={toggleFlash}
          className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center border transition-all duration-300
            ${isFlashOn 
              ? 'bg-app-secondary text-app-primary border-app-secondary shadow-[0_0_15px_rgba(197,157,217,0.5)]' 
              : 'bg-white/10 text-white/90 border-white/5'}`}
        >
          <Zap size={16} fill={isFlashOn ? "currentColor" : "none"} />
        </motion.button>
      </div>

      {/* Viewport Container */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-2">
        <div className="relative w-full aspect-[3/4] max-w-[280px] overflow-hidden rounded-[28px] shadow-2xl ring-1 ring-white/10">
          {/* Real Camera Feed */}
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover grayscale-[0.2] contrast-125"
          />

          {/* Viewfinder Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/20 z-10" />

          {/* Frame Corners - More refined */}
          <div className="absolute top-5 left-5 w-6 h-6 border-t-2 border-l-2 border-app-secondary rounded-tl-lg opacity-80 z-20" />
          <div className="absolute top-5 right-5 w-6 h-6 border-t-2 border-r-2 border-app-secondary rounded-tr-lg opacity-80 z-20" />
          <div className="absolute bottom-5 left-5 w-6 h-6 border-b-2 border-l-2 border-app-secondary rounded-bl-lg opacity-80 z-20" />
          <div className="absolute bottom-5 right-5 w-6 h-6 border-b-2 border-r-2 border-app-secondary rounded-br-lg opacity-80 z-20" />
          
          {/* Scanning Line */}
          <AnimatePresence>
            {!isScanning && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, top: ['15%', '85%', '15%'] }}
                transition={{ 
                  opacity: { duration: 0.5 },
                  top: { duration: 3, repeat: Infinity, ease: 'easeInOut' } 
                }}
                className="absolute left-6 right-6 h-0.5 bg-app-secondary/80 shadow-[0_0_20px_rgba(197,157,217,1)] z-30"
              />
            )}
          </AnimatePresence>

          {/* Scanning Progress Overlay */}
          <AnimatePresence>
            {isScanning && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 bg-app-primary/40 backdrop-blur-[2px] flex flex-col items-center justify-center"
              >
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-8 h-8 border-4 border-white/20 border-t-app-secondary rounded-full mb-2"
                />
                <span className="text-white font-bold tracking-widest text-[9px] uppercase">Analyzing...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Viewfinder Grid (Subtle) */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-10 pointer-events-none z-10">
            <div className="border-r border-b border-white" />
            <div className="border-r border-b border-white" />
            <div className="border-b border-white" />
            <div className="border-r border-b border-white" />
            <div className="border-r border-b border-white" />
            <div className="border-b border-white" />
            <div className="border-r border-white" />
            <div className="border-r border-white" />
            <div />
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center gap-4">
          {error ? (
            <div className="flex flex-col items-center gap-3">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/20 backdrop-blur-xl px-4 py-3 rounded-2xl border border-red-500/30 shadow-xl flex items-center gap-3 max-w-[280px]"
              >
                <AlertCircle size={18} className="text-red-400 shrink-0" />
                <p className="text-red-100 text-[10px] font-medium leading-normal">{error}</p>
              </motion.div>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onScanComplete({})}
                className="px-4 py-2 bg-app-secondary/20 backdrop-blur-md rounded-full border border-app-secondary/30 text-app-secondary text-[10px] font-bold uppercase tracking-widest"
              >
                Enter Manually
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setError(null);
                  startCamera();
                }}
                className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white text-[10px] font-bold uppercase tracking-widest"
              >
                Retry Camera
              </motion.button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white/5 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/10 shadow-xl">
                <p className="text-white/80 text-[10px] font-medium tracking-wide">Align invitation within the frame</p>
              </div>
              <button 
                onClick={() => onScanComplete({})}
                className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-app-secondary transition-colors"
              >
                Skip to Manual Entry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="px-10 pt-1 pb-6 flex justify-between items-end">
        <div className="flex flex-col items-center gap-2">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            id="gallery-upload" 
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              
              setIsScanning(true);
              setError(null);
              
              try {
                const reader = new FileReader();
                reader.onload = async (event) => {
                  const base64 = event.target?.result as string;
                  const data = await extractInvitationData(base64);
                  if (data) {
                    onScanComplete({ ...data, image: base64 });
                  } else {
                    setError("No valid invitation found in the uploaded image.");
                  }
                  setIsScanning(false);
                };
                reader.readAsDataURL(file);
              } catch (err) {
                console.error("Upload error:", err);
                setError("Failed to process the image.");
                setIsScanning(false);
              }
            }}
          />
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => document.getElementById('gallery-upload')?.click()}
            className="w-11 h-11 rounded-xl bg-white/5 backdrop-blur-md flex items-center justify-center text-white/60 hover:text-white border border-white/5 transition-all"
          >
            <ImageIcon size={18} />
          </motion.button>
          <span className="text-[7px] font-bold text-white/40 uppercase tracking-widest">Gallery</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <motion.button 
            onClick={handleScan}
            disabled={isScanning}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            className="relative w-18 h-18 rounded-full border-4 border-white/10 p-1 transition-all"
          >
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.2)]">
              <div className="w-12 h-12 rounded-full border-2 border-app-primary/10" />
            </div>
          </motion.button>
          <span className="text-[8px] font-black text-white/90 uppercase tracking-[0.3em] ml-1">Scan</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onScanComplete({})}
            className="w-11 h-11 rounded-xl bg-white/5 backdrop-blur-md flex items-center justify-center text-white/60 hover:text-white border border-white/5 transition-all"
          >
            <Plus size={18} />
          </motion.button>
          <span className="text-[7px] font-bold text-white/40 uppercase tracking-widest">Manual</span>
        </div>
      </div>

      {/* Home Indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-white/5 rounded-full" />
    </motion.div>
  );
}

function ConfirmDetailsScreen({ 
  scannedData, 
  onClose, 
  onSave 
}: { 
  scannedData: Partial<Event>, 
  onClose: () => void, 
  onSave: (e: Event) => Promise<void> 
}) {
  const [title, setTitle] = useState(scannedData.title || '');
  const [location, setLocation] = useState(scannedData.location || '');
  const [date, setDate] = useState(scannedData.date || new Date());
  const [startTime, setStartTime] = useState(scannedData.startTime || '');
  const [endTime, setEndTime] = useState(scannedData.endTime || '');
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [notificationTime, setNotificationTime] = useState('1 hour before');
  const [isSaving, setIsSaving] = useState(false);
  const [showFullScan, setShowFullScan] = useState(false);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      console.log("This browser does not support desktop notification");
      return false;
    }
    
    if (Notification.permission === "granted") return true;
    
    const permission = await Notification.requestPermission();
    return permission === "granted";
  };

  const handleSave = async () => {
    // Check if date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(date);
    eventDate.setHours(0, 0, 0, 0);

    if (eventDate < today) {
      alert("Cannot save an event in the past. Please select a future date.");
      return;
    }

    setIsSaving(true);
    try {
      if (notificationEnabled) {
        await requestNotificationPermission();
      }

      const newEvent: Event = {
        id: Math.random().toString(36).substr(2, 9),
        title,
        location,
        date,
        status: "Just Added",
        notificationEnabled,
        notificationTime,
        image: scannedData.image,
        startTime,
        endTime
      };
      await onSave(newEvent);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      className="fixed inset-0 z-[120] bg-app-bg flex flex-col"
    >
      <header className="sticky top-0 z-10 bg-app-bg/80 backdrop-blur-md px-6 pt-12 pb-4 flex justify-between items-center border-b border-app-secondary/20">
        <button onClick={onClose} className="text-app-primary font-semibold">Cancel</button>
        <h2 className="text-xl font-bold text-app-text-main">Confirm Details</h2>
        <div className="w-12" />
      </header>

      <div className="flex-1 overflow-y-auto">
        <main className="px-6 py-6 space-y-8">
        {/* Original Scan Reference */}
        {scannedData.image && (
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted/60 text-center mb-4">Original Scan Reference</h3>
            <div className="flex flex-col items-center">
              <div 
                onClick={() => setShowFullScan(true)}
                className="w-32 h-40 bg-white rounded-2xl shadow-lg border border-app-secondary/30 p-2 overflow-hidden cursor-pointer"
              >
                <img 
                  src={scannedData.image} 
                  alt="Original Scan" 
                  className="w-full h-full object-cover rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>
              <button 
                onClick={() => setShowFullScan(true)}
                className="mt-4 flex items-center gap-2 text-app-primary text-xs font-bold"
              >
                <Eye size={14} />
                Tap to view full scan
              </button>
            </div>
          </section>
        )}

        {/* Event Name */}
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-main mb-3">What is the event?</h3>
          <div className="bg-white border border-app-secondary/40 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
            <div className="bg-app-secondary/20 p-2 rounded-lg text-app-primary">
              <Tag size={20} />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-app-text-muted/60 uppercase">Event Name</label>
              <input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent border-none p-0 text-app-text-main font-bold focus:ring-0"
              />
            </div>
          </div>
        </section>

        {/* When */}
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-main mb-3">When is it happening?</h3>
          <div className="bg-white border border-app-secondary/40 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 flex items-center gap-4 border-b border-app-secondary/20">
              <div className="bg-app-secondary/20 p-2 rounded-lg text-app-primary">
                <CalendarIcon size={20} />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-app-text-muted/60 uppercase">Date</label>
                <div className="flex items-center justify-between relative">
                  <span className="text-app-text-main font-bold">
                    {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                  <input 
                    type="date"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    value={date.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const [year, month, day] = e.target.value.split('-').map(Number);
                      const newDate = new Date(date);
                      newDate.setFullYear(year, month - 1, day);
                      setDate(newDate);
                    }}
                  />
                  <ChevronRight size={18} className="text-app-text-muted/40" />
                </div>
              </div>
            </div>
            <div className="flex divide-x divide-app-secondary/20">
              <div className="flex-1 p-4 flex items-center gap-4">
                <div className="bg-app-secondary/20 p-2 rounded-lg text-app-primary">
                  <Clock size={20} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-app-text-muted/60 uppercase">Starts</label>
                  <input 
                    value={startTime}
                    onChange={(e) => {
                      const newStartTime = e.target.value;
                      setStartTime(newStartTime);
                      setDate(prev => parseTimeString(newStartTime, prev));
                    }}
                    className="w-full bg-transparent border-none p-0 text-app-text-main font-bold focus:ring-0"
                  />
                </div>
              </div>
              <div className="flex-1 p-4">
                <label className="block text-[10px] font-bold text-app-text-muted/60 uppercase">Ends (Optional)</label>
                <input 
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-transparent border-none p-0 text-app-text-main font-bold focus:ring-0"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Where */}
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-main mb-3">Where is the venue?</h3>
          <div className="bg-white border border-app-secondary/40 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 flex items-center gap-4">
              <div className="bg-app-secondary/20 p-2 rounded-lg text-app-primary">
                <MapPin size={20} />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-app-text-muted/60 uppercase">Location Address</label>
                <textarea 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-transparent border-none p-0 text-app-text-main font-bold focus:ring-0 resize-none"
                  rows={2}
                />
              </div>
            </div>
            <div className="h-24 bg-app-secondary/10 relative">
               {/* Map placeholder */}
               <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="pb-10">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-main">Notifications</h3>
            <div className="flex items-center gap-2 bg-app-secondary/10 px-2 py-1 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
              <span className="text-[8px] font-bold text-app-primary uppercase tracking-wider">Smart Alerts</span>
            </div>
          </div>
          
          <div className="bg-white border border-app-secondary/40 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 flex items-center justify-between border-b border-app-secondary/20">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg transition-colors ${notificationEnabled ? 'bg-app-primary/10 text-app-primary' : 'bg-gray-100 text-gray-400'}`}>
                  {notificationEnabled ? <Bell size={20} /> : <BellOff size={20} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-app-text-main">Event Reminder</p>
                  <p className="text-[10px] text-app-text-muted/60 font-medium">Get notified before the event starts</p>
                </div>
              </div>
              <button 
                onClick={() => setNotificationEnabled(!notificationEnabled)}
                className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${notificationEnabled ? 'bg-app-primary' : 'bg-gray-200'}`}
              >
                <motion.div 
                  animate={{ x: notificationEnabled ? 24 : 4 }}
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>
            
            <AnimatePresence>
              {notificationEnabled && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-app-secondary/5 flex items-center justify-between">
                    <span className="text-xs font-bold text-app-text-main">Remind me</span>
                    <select 
                      value={notificationTime}
                      onChange={(e) => setNotificationTime(e.target.value)}
                      className="bg-transparent border-none text-xs font-bold text-app-primary focus:ring-0 cursor-pointer"
                    >
                      <option>15 minutes before</option>
                      <option>30 minutes before</option>
                      <option>1 hour before</option>
                      <option>2 hours before</option>
                      <option>1 day before</option>
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>
    </div>

    {/* Sticky Save Button Container */}
      <div className="p-6 bg-app-bg/80 backdrop-blur-md border-t border-app-secondary/20 safe-area-bottom">
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full py-4 bg-app-primary text-white font-bold rounded-2xl shadow-lg shadow-app-primary/30 flex items-center justify-center gap-2 transition-all ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Check size={20} />
          )}
          {isSaving ? 'Saving...' : 'Save Event'}
        </motion.button>
      </div>

      {/* Full Screen Scan View */}
      <AnimatePresence>
        {showFullScan && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black flex flex-col"
          >
            <header className="p-6 flex justify-between items-center">
              <button 
                onClick={() => setShowFullScan(false)}
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white"
              >
                <X size={20} />
              </button>
              <span className="text-white font-bold">Original Invitation</span>
              <div className="w-10" />
            </header>
            <div className="flex-1 flex items-center justify-center p-4">
              <img 
                src={scannedData.image} 
                alt="Full Scan" 
                className="max-w-full max-h-full object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AuthScreen({ onClose, onLogin }: { onClose: () => void, onLogin: (user: UserProfile) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = () => {
    // Mock login
    onLogin({
      name: name || (mode === 'login' ? 'Adya Sharana' : 'New User'),
      email: email || 'user@example.com',
      avatar: ProfileImage,
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      scannedCount: 12
    });
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-[110] bg-app-bg flex flex-col items-center justify-center px-6"
    >
      {/* Background Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-app-secondary/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-app-primary/10 blur-[80px] rounded-full" />
      </div>

      <motion.button 
        whileTap={{ scale: 0.9 }}
        onClick={onClose}
        className="absolute top-12 right-6 w-10 h-10 rounded-full bg-app-secondary/30 flex items-center justify-center text-app-primary"
      >
        <X size={20} />
      </motion.button>

      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-20 h-20 bg-app-primary rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-xl shadow-app-primary/30"
          >
            <LayoutGrid size={40} className="text-white" />
          </motion.div>
          <h2 className="text-3xl font-extrabold text-app-text-main tracking-tight">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-app-text-muted text-sm mt-2">
            {mode === 'login' ? 'Sign in to manage your events' : 'Join InviScan to start scanning'}
          </p>
        </div>

        <div className="bg-white/80 border border-app-secondary/40 rounded-3xl p-8 card-shadow backdrop-blur-md">
          <div className="space-y-4">
            {mode === 'signup' && (
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-app-primary/60">
                  <User size={18} />
                </span>
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-app-secondary/10 border-none rounded-2xl focus:ring-2 focus:ring-app-primary text-sm placeholder-app-text-muted/60 text-app-text-main outline-none transition-all"
                />
              </div>
            )}
            
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-app-primary/60">
                <Mail size={18} />
              </span>
              <input 
                type="email" 
                placeholder="Email Address" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-app-secondary/10 border-none rounded-2xl focus:ring-2 focus:ring-app-primary text-sm placeholder-app-text-muted/60 text-app-text-main outline-none transition-all"
              />
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-app-primary/60">
                <Lock size={18} />
              </span>
              <input 
                type="password" 
                placeholder="Password" 
                className="w-full pl-12 pr-4 py-4 bg-app-secondary/10 border-none rounded-2xl focus:ring-2 focus:ring-app-primary text-sm placeholder-app-text-muted/60 text-app-text-main outline-none transition-all"
              />
            </div>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              className="w-full py-4 bg-app-primary text-white font-bold rounded-2xl shadow-lg shadow-app-primary/30 mt-4"
            >
              {mode === 'login' ? 'Sign In' : 'Sign Up'}
            </motion.button>
          </div>

          <div className="mt-8 text-center">
            <button 
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-sm font-bold text-app-primary hover:opacity-70 transition-opacity"
            >
              {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ProfileScreen({ user, events, onClose, onLogout, onUpdateProfile }: { 
  user: UserProfile, 
  events: Event[],
  onClose: () => void, 
  onLogout: () => void,
  onUpdateProfile: (user: UserProfile) => void
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [avatar, setAvatar] = useState(user.avatar);
  const [activeSetting, setActiveSetting] = useState<'none' | 'notifications' | 'security'>('none');

  const upcomingCount = useMemo(() => {
    const now = new Date();
    return events.filter(e => e.date > now).length;
  }, [events]);

  const handleSave = () => {
    onUpdateProfile({ ...user, name, email, avatar });
    setIsEditing(false);
  };

  const AVATARS = [
    // Cute Humans
    'https://api.dicebear.com/7.x/lorelei/svg?seed=Felix',
    'https://api.dicebear.com/7.x/lorelei/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Milo',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Luna',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Oscar',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe',
    // Cute Animals & Fun Characters
    'https://api.dicebear.com/7.x/bottts/svg?seed=Panda',
    'https://api.dicebear.com/7.x/big-smile/svg?seed=Bunny',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Cat',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Dog',
    'https://api.dicebear.com/7.x/notionists/svg?seed=Fox',
    'https://api.dicebear.com/7.x/pixel-art/svg?seed=Bird',
    'https://api.dicebear.com/7.x/miniavs/svg?seed=Bear',
    'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Koala',
    'https://api.dicebear.com/7.x/thumbs/svg?seed=Hamster',
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[110] bg-app-bg flex flex-col"
    >
      {/* Header */}
      <div className="safe-top flex justify-between items-center px-6 pt-8 pb-4">
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-app-secondary/30 flex items-center justify-center text-app-primary"
        >
          <ChevronLeft size={24} />
        </motion.button>
        <h2 className="text-lg font-bold text-app-text-main">Profile</h2>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-12">
        {/* Profile Header */}
        <div className="flex flex-col items-center mt-6 mb-10">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsAvatarPickerOpen(true)}
            className="relative group"
          >
            <div className="w-28 h-28 rounded-[40px] overflow-hidden border-4 border-white shadow-xl group-hover:border-app-primary transition-colors">
              <img 
                src={user.avatar} 
                alt={user.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute inset-0 bg-black/20 rounded-[40px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera size={24} className="text-white" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-app-primary text-white rounded-2xl flex items-center justify-center shadow-lg border-2 border-white">
              <Pencil size={18} />
            </div>
          </motion.button>
          <h3 className="text-2xl font-extrabold text-app-text-main mt-6">{user.name}</h3>
          <p className="text-app-text-muted text-sm">{user.email}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="bg-white/60 p-4 rounded-3xl border border-app-secondary/30 text-center">
            <div className="text-2xl font-black text-app-primary">{user.scannedCount}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted mt-1">Scanned</div>
          </div>
          <div className="bg-white/60 p-4 rounded-3xl border border-app-secondary/30 text-center">
            <div className="text-2xl font-black text-app-primary">{upcomingCount}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted mt-1">Upcoming</div>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-app-primary mb-4 px-2">Account Settings</h4>
            <div className="bg-white/80 rounded-3xl border border-app-secondary/30 overflow-hidden">
              {isEditing ? (
                <div className="p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-app-text-muted uppercase ml-1">Full Name</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 bg-app-secondary/10 rounded-2xl outline-none focus:ring-2 focus:ring-app-primary transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-app-text-muted uppercase ml-1">Email Address</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-app-secondary/10 rounded-2xl outline-none focus:ring-2 focus:ring-app-primary transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-app-text-muted uppercase ml-1">Choose Avatar</label>
                    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                      {AVATARS.map((url, i) => (
                        <button 
                          key={i}
                          onClick={() => setAvatar(url)}
                          className={`flex-shrink-0 w-14 h-14 rounded-2xl overflow-hidden border-2 transition-all ${avatar === url ? 'border-app-primary scale-110 shadow-lg' : 'border-transparent opacity-60'}`}
                        >
                          <img src={url} alt={`Avatar ${i}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-3 bg-app-secondary/30 text-app-text-main font-bold rounded-2xl"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSave}
                      className="flex-1 py-3 bg-app-primary text-white font-bold rounded-2xl shadow-lg shadow-app-primary/20"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="w-full flex items-center justify-between p-5 hover:bg-app-secondary/10 transition-colors border-b border-app-secondary/20"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center">
                        <User size={20} />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-app-text-main">Personal Info</div>
                        <div className="text-[10px] text-app-text-muted">Name, email and avatar</div>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-app-text-muted/40" />
                  </button>
                  <button 
                    onClick={() => setActiveSetting('notifications')}
                    className="w-full flex items-center justify-between p-5 hover:bg-app-secondary/10 transition-colors border-b border-app-secondary/20"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center">
                        <Bell size={20} />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-app-text-main">Notifications</div>
                        <div className="text-[10px] text-app-text-muted">Alerts and reminders</div>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-app-text-muted/40" />
                  </button>
                  <button 
                    onClick={() => setActiveSetting('security')}
                    className="w-full flex items-center justify-between p-5 hover:bg-app-secondary/10 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
                        <Lock size={20} />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-app-text-main">Security</div>
                        <div className="text-[10px] text-app-text-muted">Password and privacy</div>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-app-text-muted/40" />
                  </button>
                </>
              )}
            </div>
          </section>

          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-app-primary mb-4 px-2">App Info</h4>
            <div className="bg-white/80 rounded-3xl border border-app-secondary/30 overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-app-secondary/20">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-gray-50 text-gray-500 flex items-center justify-center">
                    <AlertCircle size={20} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-app-text-main">Version</div>
                    <div className="text-[10px] text-app-text-muted">1.0.4 (Build 242)</div>
                  </div>
                </div>
              </div>
              <button 
                onClick={onLogout}
                className="w-full flex items-center gap-4 p-5 text-red-500 hover:bg-red-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center">
                  <LogOut size={20} />
                </div>
                <div className="text-sm font-bold">Sign Out</div>
              </button>
            </div>
          </section>
        </div>

        <div className="mt-10 text-center">
          <p className="text-[10px] text-app-text-muted font-medium uppercase tracking-[0.3em]">Joined {user.joinedDate}</p>
        </div>
      </div>

      {/* Avatar Picker Modal */}
      <AnimatePresence>
        {isAvatarPickerOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setIsAvatarPickerOpen(false)}
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full bg-white rounded-t-[40px] p-8 pb-12 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-black text-app-text-main">Choose Avatar</h3>
                  <p className="text-app-text-muted text-sm mt-1">Pick a cute character for your profile</p>
                </div>
                <button 
                  onClick={() => setIsAvatarPickerOpen(false)}
                  className="w-10 h-10 rounded-full bg-app-secondary/20 flex items-center justify-center text-app-text-muted"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {AVATARS.map((url, i) => (
                  <motion.button 
                    key={i}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      onUpdateProfile({ ...user, avatar: url });
                      setAvatar(url);
                      setIsAvatarPickerOpen(false);
                    }}
                    className={`aspect-square rounded-3xl overflow-hidden border-4 transition-all ${user.avatar === url ? 'border-app-primary shadow-lg' : 'border-app-secondary/20'}`}
                  >
                    <img src={url} alt={`Avatar ${i}`} className="w-full h-full object-cover" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modals */}
      <AnimatePresence>
        {activeSetting !== 'none' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-6 bottom-10 z-[120] bg-white rounded-[40px] shadow-2xl border border-app-secondary/30 p-8"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-app-text-main capitalize">{activeSetting} Settings</h3>
              <button 
                onClick={() => setActiveSetting('none')}
                className="w-8 h-8 rounded-full bg-app-secondary/20 flex items-center justify-center text-app-text-muted"
              >
                <X size={16} />
              </button>
            </div>
            
            {activeSetting === 'notifications' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-app-secondary/10 rounded-2xl">
                  <div className="text-sm font-bold">Push Notifications</div>
                  <div className="w-12 h-6 bg-app-primary rounded-full relative">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-app-secondary/10 rounded-2xl">
                  <div className="text-sm font-bold">Email Alerts</div>
                  <div className="w-12 h-6 bg-app-secondary/30 rounded-full relative">
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <button className="w-full p-4 bg-app-secondary/10 rounded-2xl text-left text-sm font-bold flex items-center justify-between">
                  Change Password
                  <ChevronRight size={16} />
                </button>
                <button className="w-full p-4 bg-app-secondary/10 rounded-2xl text-left text-sm font-bold flex items-center justify-between">
                  Two-Factor Authentication
                  <span className="text-[10px] text-app-primary">Enabled</span>
                </button>
              </div>
            )}
            
            <button 
              onClick={() => setActiveSetting('none')}
              className="w-full mt-8 py-4 bg-app-primary text-white font-bold rounded-2xl shadow-lg shadow-app-primary/20"
            >
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AppContent() {
  const { user, loading, isAuthReady } = useFirebase();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isViewAllOpen, setIsViewAllOpen] = useState(false);
  const [isNewFilterActive, setIsNewFilterActive] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [scannedData, setScannedData] = useState<Partial<Event> | null>(null);
  const [activeTab, setActiveTab] = useState<'events' | 'calendar'>('events');
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const notifiedEvents = useRef<Set<string>>(new Set());
  const hasClearedNewOnMount = useRef(false);

  // Firestore Listeners
  useEffect(() => {
    if (!user || !isAuthReady) {
      setEvents([]);
      setCurrentUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let userLoaded = false;
    let eventsLoaded = false;

    const checkLoaded = () => {
      if (userLoaded && eventsLoaded) {
        setIsLoading(false);
      }
    };

    // Listen to user profile
    const userUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setCurrentUser(snapshot.data() as UserProfile);
      }
      userLoaded = true;
      checkLoaded();
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}`));

    // Listen to events
    const eventsQuery = query(collection(db, 'events'), where('userId', '==', user.uid));
    const eventsUnsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const fetchedEvents = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          date: new Date(data.date)
        } as Event;
      });
      setEvents(fetchedEvents);
      eventsLoaded = true;
      checkLoaded();
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'events'));

    return () => {
      userUnsubscribe();
      eventsUnsubscribe();
    };
  }, [user, isAuthReady]);

  // Clear "new" status on refresh once events are loaded
  useEffect(() => {
    if (isAuthReady && user && events.length > 0 && !hasClearedNewOnMount.current) {
      const newEvents = events.filter(e => e.isNew);
      if (newEvents.length > 0) {
        clearNewStatus();
      }
      hasClearedNewOnMount.current = true;
    }
  }, [events, isAuthReady, user]);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission;
    }
    return 'denied';
  };

  // Notification Scheduling Logic
  useEffect(() => {
    const checkNotifications = () => {
      if (Notification.permission !== 'granted') return;
      
      const now = new Date();
      events.forEach(event => {
        if (!event.notificationEnabled || notifiedEvents.current.has(event.id)) return;
        
        const eventTime = event.date.getTime();
        const nowTime = now.getTime();
        
        let reminderOffset = 0;
        switch (event.notificationTime) {
          case '15 minutes before': reminderOffset = 15 * 60 * 1000; break;
          case '30 minutes before': reminderOffset = 30 * 60 * 1000; break;
          case '1 hour before': reminderOffset = 60 * 60 * 1000; break;
          case '2 hours before': reminderOffset = 120 * 60 * 1000; break;
          case '1 day before': reminderOffset = 24 * 60 * 60 * 1000; break;
          default: reminderOffset = 60 * 60 * 1000;
        }

        const reminderTime = eventTime - reminderOffset;
        const timeDiff = nowTime - reminderTime;
        
        if (timeDiff >= 0 && timeDiff < 60000 && nowTime < eventTime) {
          new Notification(`Reminder: ${event.title}`, {
            body: `Starting at ${event.startTime || event.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} at ${event.location}`,
            icon: '/favicon.ico'
          });
          notifiedEvents.current.add(event.id);
        }
      });
    };

    const interval = setInterval(checkNotifications, 30000);
    return () => clearInterval(interval);
  }, [events]);

  const updateEvent = async (updatedEvent: Event) => {
    if (!user) return;
    try {
      const eventRef = doc(db, 'events', updatedEvent.id);
      await updateDoc(eventRef, {
        ...updatedEvent,
        date: updatedEvent.date.toISOString()
      });
      setSelectedEvent(updatedEvent);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${updatedEvent.id}`);
    }
  };

  const addEvent = async (newEvent: Event) => {
    if (!user) return;
    try {
      const eventToSave = { 
        ...newEvent, 
        isNew: true, 
        userId: user.uid,
        createdAt: new Date().toISOString()
      };
      
      const eventRef = doc(db, 'events', eventToSave.id);
      await setDoc(eventRef, {
        ...eventToSave,
        date: eventToSave.date.toISOString()
      });

      setScannedData(null);
      setIsScannerOpen(false);
      setIsNewFilterActive(true);

      // Update scanned count for user
      if (currentUser) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          scannedCount: currentUser.scannedCount + 1
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `events/${newEvent.id}`);
    }
  };

  const updateUserProfile = async (updatedUser: UserProfile) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        ...updatedUser
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const notifyUser = async (event: Event) => {
    if (!currentUser?.email) {
      alert("Please log in to send notifications.");
      return;
    }
    
    try {
      const response = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email,
          eventTitle: event.title,
          eventDate: event.date,
          eventLocation: event.location
        })
      });
      
      const data = await response.json();
      if (data.success) {
        alert("Email notification sent successfully!");
      } else {
        alert("Failed to send notification: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to send notification:", error);
      alert("Failed to send notification. Please check your connection.");
    }
  };

  const deleteEvent = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'events', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `events/${id}`);
    }
  };

  const clearNewStatus = async () => {
    if (!user) return;
    try {
      const newEvents = events.filter(e => e.isNew);
      for (const event of newEvents) {
        await updateDoc(doc(db, 'events', event.id), { isNew: false });
      }
    } catch (error) {
      console.error("Failed to clear new status:", error);
    }
  };

  if (loading || !isAuthReady) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-app-primary/30 border-t-app-primary rounded-full animate-spin mx-auto" />
          <p className="text-app-text-muted font-medium animate-pulse">Initializing InviScan...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-app-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        {activeTab === 'events' ? (
          <Dashboard 
            events={events} 
            user={currentUser}
            onOpenScanner={() => setIsScannerOpen(true)} 
            onOpenAuth={() => currentUser ? setIsProfileOpen(true) : setIsAuthOpen(true)}
            onViewAll={() => setIsViewAllOpen(true)}
            onDeleteEvent={deleteEvent}
            onToggleNewFilter={() => {
              if (isNewFilterActive) {
                setIsNewFilterActive(false);
              } else {
                setIsNewFilterActive(true);
                clearNewStatus();
              }
            }}
            onShowAllEvents={() => setIsNewFilterActive(false)}
            isNewFilterActive={isNewFilterActive}
            onViewEventDetails={(event) => setSelectedEvent(event)}
            notificationPermission={notificationPermission}
            requestNotificationPermission={requestNotificationPermission}
          />
        ) : (
          <CalendarScreen 
            events={events} 
            onDeleteEvent={deleteEvent} 
            onViewEventDetails={(event) => setSelectedEvent(event)}
          />
        )}

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 inset-x-0 bg-white/60 ios-blur border-t border-app-secondary/30 pb-8 pt-2 z-50">
          <div className="max-w-md mx-auto px-10 flex justify-between items-center relative">
            <button 
              onClick={() => setActiveTab('events')}
              className={`flex flex-col items-center transition-colors ${activeTab === 'events' ? 'text-app-primary' : 'text-app-text-muted/50'}`}
            >
              <LayoutGrid size={24} />
              <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">Events</span>
            </button>
            
            <div className="relative -mt-14">
              <motion.button 
                onClick={() => setIsScannerOpen(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                className="bg-app-primary text-white w-16 h-16 rounded-full flex items-center justify-center shadow-xl shadow-app-primary/40 transition-transform border-4 border-app-bg"
              >
                <Camera size={30} />
              </motion.button>
            </div>
            
            <button 
              onClick={() => setActiveTab('calendar')}
              className={`flex flex-col items-center transition-colors ${activeTab === 'calendar' ? 'text-app-primary' : 'text-app-text-muted/50'}`}
            >
              <CalendarIcon size={24} />
              <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">Calendar</span>
            </button>
          </div>
        </nav>
      </div>
      
      <AnimatePresence>
        {isScannerOpen && !scannedData && (
          <CameraScreen 
            onClose={() => setIsScannerOpen(false)} 
            onScanComplete={(data) => setScannedData(data)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scannedData && (
          <ConfirmDetailsScreen 
            scannedData={scannedData}
            onClose={() => setScannedData(null)}
            onSave={addEvent}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isViewAllOpen && (
          <ViewAllScreen 
            events={events} 
            onClose={() => setIsViewAllOpen(false)} 
            onDeleteEvent={deleteEvent}
            onViewEventDetails={(event) => {
              setSelectedEvent(event);
              setIsViewAllOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedEvent && (
          <EventDetailsScreen 
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onSave={updateEvent}
            onNotify={notifyUser}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAuthOpen && (
          <AuthScreen 
            onClose={() => setIsAuthOpen(false)} 
            onLogin={(user) => {
              updateUserProfile(user);
              setIsAuthOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProfileOpen && currentUser && (
          <ProfileScreen 
            user={currentUser}
            events={events}
            onClose={() => setIsProfileOpen(false)}
            onLogout={() => {
              logout();
              setIsProfileOpen(false);
            }}
            onUpdateProfile={updateUserProfile}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <AppContent />
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
