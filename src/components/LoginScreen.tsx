import React from 'react';
import { motion } from 'motion/react';
import { LogIn, ShieldCheck, Zap, Sparkles } from 'lucide-react';
import { signInWithGoogle } from '../firebase';

export function LoginScreen() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="flex items-center justify-center mb-12">
          <div className="relative">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-[-8px] border border-dashed border-orange-500/30 rounded-full"
            />
            <div className="w-20 h-20 bg-orange-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/20 rotate-12">
              <Zap className="text-white fill-white" size={40} />
            </div>
          </div>
        </div>

        <div className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-5xl font-black tracking-tighter mb-4 italic"
          >
            INVISCAN
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-zinc-500 font-medium"
          >
            Your events, secured and synchronized.
          </motion.p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={signInWithGoogle}
          className="w-full bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl hover:bg-zinc-100 transition-colors mb-8"
        >
          <LogIn size={20} />
          Sign in with Google
        </motion.button>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
            <ShieldCheck className="text-orange-500 mb-2" size={24} />
            <h3 className="text-sm font-bold mb-1">Secure Storage</h3>
            <p className="text-xs text-zinc-500">End-to-end encrypted cloud sync.</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
            <Sparkles className="text-orange-500 mb-2" size={24} />
            <h3 className="text-sm font-bold mb-1">Real-time</h3>
            <p className="text-xs text-zinc-500">Instant updates across devices.</p>
          </div>
        </div>
      </motion.div>

      <div className="absolute bottom-8 text-center w-full">
        <p className="text-zinc-600 text-[10px] uppercase tracking-[0.2em] font-bold">
          Powered by Firebase & Gemini
        </p>
      </div>
    </div>
  );
}
