// src/_pages/SubscribedApp.tsx
import { useRef, useEffect } from "react";
import ChatView from "./ChatView"; // Import the new view

interface SubscribedAppProps {
  credits: number // You can remove these if not needed
  currentLanguage: string
  setLanguage: (language: string) => void
}

const SubscribedApp: React.FC<SubscribedAppProps> = ({ credits, currentLanguage, setLanguage }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Effect to update window dimensions based on content size
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const height = containerRef.current.scrollHeight;
        const width = containerRef.current.scrollWidth;
        window.electronAPI?.updateContentDimensions({ width, height });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);
    updateDimensions(); // Initial call

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="min-h-0">
       <ChatView /> {/* Render only the ChatView */}
    </div>
  );
};

export default SubscribedApp;