import { motion, AnimatePresence } from 'framer-motion';

interface MessageOverlayProps {
  message: string | null;
}

export function MessageOverlay({ message }: MessageOverlayProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed inset-x-0 top-[20%] flex items-center justify-center z-50 pointer-events-none"
        >
          <div className="bg-white/95 text-gray-900 px-6 py-2 rounded-lg shadow-lg text-lg font-medium backdrop-blur-sm border border-gray-200">
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 