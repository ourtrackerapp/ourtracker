import React from 'react';
import { motion } from 'motion/react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-[9999]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center justify-center"
      >
        <h1 className="text-5xl font-extrabold tracking-tight text-center leading-none">
          <span className="block loading-gradient-text pb-2">Our</span>
          <span className="block loading-gradient-text">Tracker</span>
        </h1>
      </motion.div>
    </div>
  );
};
