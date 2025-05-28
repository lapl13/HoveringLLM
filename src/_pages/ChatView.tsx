// Replace your current src/_pages/ChatView.tsx with this enhanced version

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useToast } from '../contexts/toast';
import { Settings, Send, Camera, Trash2, Paperclip } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Define the Screenshot type if not imported
interface Screenshot { path: string; preview: string; }
interface Message { sender: 'user' | 'llm'; text: string; images?: Screenshot[]; }

const ChatView: React.FC = () => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [pendingImages, setPendingImages] = useState<Screenshot[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { showToast } = useToast();

    // Listen for new screenshots from the main process
    useEffect(() => {
        const cleanup = window.electronAPI.onScreenshotTaken((data) => {
            if (data.path && data.preview) {
                setPendingImages(prev => [...prev, { path: data.path, preview: data.preview }]);
            } else {
                 showToast("Error", "Screenshot capture failed.", "error");
            }
        });
        return () => cleanup();
    }, [showToast]);

    // Function to trigger screenshot capture
    const handleTriggerScreenshot = () => {
        if (pendingImages.length >= 5) {
            showToast("Limit Reached", "You can attach up to 5 screenshots.", "neutral");
            return;
        }
        window.electronAPI.triggerScreenshot().catch(err => {
            showToast("Error", `Failed to take screenshot: ${err.message}`, "error");
        });
    };

    // Function to delete a pending image
    const handleDeletePendingImage = async (pathToDelete: string) => {
         try {
            await window.electronAPI.deleteScreenshot(pathToDelete);
            setPendingImages(prev => prev.filter(img => img.path !== pathToDelete));
         } catch (err: any) {
             showToast("Error", `Failed to delete image: ${err.message}`, "error");
         }
    };

    // Function to send the prompt (with images)
    const handleSend = async () => {
        const prompt = input.trim();
        if ((!prompt && pendingImages.length === 0) || isLoading) return;

        const imagePathsToSend = pendingImages.map(img => img.path);
        const userMessage: Message = { sender: 'user', text: prompt, images: [...pendingImages] };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setPendingImages([]); // Clear pending images
        setIsLoading(true);

        try {
            const result = await window.electronAPI.sendLLMPrompt(prompt, imagePathsToSend);
            if (result.success && result.data) {
                setMessages(prev => [...prev, { sender: 'llm', text: result.data }]);
            } else {
                const errorMsg = result.error || 'Unknown error';
                showToast("Error", errorMsg, "error");
                setMessages(prev => [...prev, { sender: 'llm', text: `Error: ${errorMsg}` }]);
            }
        } catch (error: any) { /* ... error handling ... */ }
        finally { setIsLoading(false); }
    };

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
    const openSettings = () => window.electronAPI.openSettingsPortal();

    // Function to render messages (handles code blocks and images)
    const renderMessageContent = (msg: Message) => {
        const parts = [];
        // Add images if they exist
        if (msg.images && msg.images.length > 0) {
             parts.push(
                <div key="images" className="flex flex-wrap gap-2 mb-2">
                    {msg.images.map((img, i) => (
                         <img key={i} src={img.preview} alt="attached" className="w-16 h-16 object-cover rounded border border-gray-500"/>
                    ))}
                </div>
             );
        }
        // Add text, handling code blocks
        if (msg.text) {
            const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
            let lastIndex = 0;
            let match;
            while ((match = codeBlockRegex.exec(msg.text)) !== null) {
                if (match.index > lastIndex) { parts.push(<pre key={`<span class="math-inline">\{msg\.sender\}\-</span>{lastIndex}-text`} className="whitespace-pre-wrap font-sans">{msg.text.substring(lastIndex, match.index)}</pre>); }
                parts.push( <SyntaxHighlighter key={`<span class="math-inline">\{msg\.sender\}\-</span>{match.index}-code`} language={match[1] || 'plaintext'} style={dracula} customStyle={{ margin: '5px 0', borderRadius: '5px', fontSize: '0.8em' }}>{match[2]}</SyntaxHighlighter> );
                lastIndex = codeBlockRegex.lastIndex;
            }
            if (lastIndex < msg.text.length) { parts.push(<pre key={`<span class="math-inline">\{msg\.sender\}\-</span>{lastIndex}-text`} className="whitespace-pre-wrap font-sans">{msg.text.substring(lastIndex)}</pre>); }
        }
        return parts;
    };

    return (
        <div className="flex flex-col h-[600px] w-[450px] p-3 bg-black/80 text-white rounded-lg border border-white/10">
            <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
               <h1 className="text-sm font-semibold ml-2">LLM Hover Window</h1>
               <Button variant="ghost" size="icon" onClick={openSettings} className="text-white/70 h-7 w-7 hover:bg-white/10 hover:text-white"> <Settings size={16} /> </Button>
            </div>

            <div className="flex-1 overflow-y-auto mb-3 pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                {messages.map((msg, index) => (
                    <div key={index} className={`mb-3 p-3 rounded-lg text-sm w-fit max-w-[90%] ${ msg.sender === 'user' ? 'bg-blue-600/70 ml-auto' : 'bg-gray-600/70 mr-auto'}`}>
                       {renderMessageContent(msg)}
                    </div>
                ))}
                {isLoading && <div className="text-center text-gray-400 text-xs py-2">Thinking...</div>}
                <div ref={messagesEndRef} />
            </div>

            {pendingImages.length > 0 && (
                 <div className="mb-2 p-2 border border-dashed border-gray-600 rounded-md bg-gray-900/50">
                     <div className="flex justify-between items-center mb-2">
                         <h3 className="text-xs text-gray-400"> <Paperclip size={12} className="inline mr-1"/> Screenshots to Send ({pendingImages.length}/5):</h3>
                         <Button variant="link" size="sm" className="text-red-500 h-auto p-0 text-xs" onClick={() => setPendingImages([])}>Clear All</Button>
                     </div>
                     <div className="flex gap-2 flex-wrap">
                        {pendingImages.map(img => (
                            <div key={img.path} className="relative group">
                                <img src={img.preview} alt="pending" className="w-12 h-12 object-cover rounded"/>
                                <button onClick={() => handleDeletePendingImage(img.path)} className="absolute -top-1 -right-1 p-0.5 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"> <Trash2 size={10} /> </button>
                            </div>
                        ))}
                     </div>
                 </div>
            )}

            <div className="flex">
                <Button variant="ghost" size="icon" onClick={handleTriggerScreenshot} className="h-9 w-9 mr-1 text-white/70 hover:bg-white/10" disabled={isLoading || pendingImages.length >= 5}> <Camera size={16}/> </Button>
                <Input className="flex-1 rounded-none bg-gray-800 text-white border-gray-700 h-9 border-l-0 border-r-0" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Type or attach screenshots..." disabled={isLoading} />
                <Button className="rounded-l-none h-9" onClick={handleSend} disabled={isLoading || (!input.trim() && pendingImages.length === 0)}> <Send size={16}/> </Button>
            </div>
        </div>
    );
};

export default ChatView;