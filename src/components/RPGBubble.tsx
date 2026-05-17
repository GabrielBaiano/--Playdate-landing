import React, { useState, useEffect, useRef } from 'react';
import './RPGBubble.css';

interface RPGBubbleProps {
  text: string;
  speed?: number;
  direction?: 'left' | 'right' | 'top' | 'bottom';
  className?: string;
  width?: string;
  visible?: boolean;
}

export function RPGBubble({ text, speed = 40, direction = 'left', className = '', width = '450px', visible = true }: RPGBubbleProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible && !hasTriggered) {
      setHasTriggered(true);
      setIsTyping(true);
    } else if (!visible) {
      setHasTriggered(false);
      setIsTyping(false);
      setDisplayedText('');
    }
  }, [visible, hasTriggered]);

  useEffect(() => {
    if (!isTyping) return;

    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.substring(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [isTyping, text, speed]);

  return (
    <div ref={containerRef} className={`rpg-bubble rpg-bubble-${direction} ${visible ? 'rpg-bubble-visible' : ''} ${className}`} style={{ width }}>
      <p className="rpg-text">
        {displayedText}
        {isTyping && <span className="rpg-cursor">_</span>}
      </p>
    </div>
  );
}
