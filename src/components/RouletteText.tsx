import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

interface RouletteDigitProps {
  char: string;
}

export const RouletteDigit: React.FC<RouletteDigitProps> = ({ char }) => {
  const isDigit = /^[0-9]$/.test(char);
  const num = isDigit ? parseInt(char, 10) : null;
  const prevNumRef = useRef<number | null>(num);
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    if (num !== null && prevNumRef.current !== null && num !== prevNumRef.current) {
      setIsRolling(true);
      const timer = setTimeout(() => {
        setIsRolling(false);
      }, 260);
      prevNumRef.current = num;
      return () => clearTimeout(timer);
    }
    prevNumRef.current = num;
  }, [num]);

  if (!isDigit || num === null) {
    return <span className="inline-block select-none">{char}</span>;
  }

  return (
    <span className="inline-block relative overflow-hidden h-[1.18em] w-[0.6em] align-top select-none">
      <motion.span
        className="absolute left-0 top-0 w-full flex flex-col items-center tabular-nums will-change-transform"
        animate={{
          y: `-${num * 10}%`,
          filter: isRolling ? 'blur(1.8px)' : 'blur(0px)',
          opacity: isRolling ? 0.82 : 1,
        }}
        transition={{
          y: {
            type: 'spring',
            stiffness: 480,
            damping: 30,
            mass: 0.5,
          },
          filter: {
            duration: 0.24,
            ease: 'easeOut',
          },
          opacity: {
            duration: 0.24,
          },
        }}
      >
        {DIGITS.map((d) => (
          <span
            key={d}
            className="h-[1.18em] flex items-center justify-center leading-none"
          >
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  );
};

interface RouletteTextProps {
  text: string;
  className?: string;
}

export const RouletteText: React.FC<RouletteTextProps> = ({ text, className }) => {
  const chars = text.split('');
  const total = chars.length;

  return (
    <span className={`inline-flex items-center justify-center ${className || ''}`}>
      {chars.map((char, index) => {
        const rightIndex = total - 1 - index;
        return <RouletteDigit key={`digit-pos-${rightIndex}`} char={char} />;
      })}
    </span>
  );
};
