import React, { useState, useEffect, useRef } from 'react';
import OpenAI from "openai";
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log("API Key:", process.env.OPENAI_API_KEY);

const getAICompletion = async () => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      store: true,
      messages: [
        {"role": "user", "content": "write a haiku about ai"},
      ],
    });

    console.log(completion.choices[0].message);
  } catch (error) {
    console.error("Error fetching AI completion:", error);
  }
};

getAICompletion();

// Add CSS for fade-in animation
const fadeInAnimation = {
  animation: 'fadeIn 1s ease-in-out',
};

// Add keyframes for fade-in animation
const styles = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;

interface AIResponse {
  text: string;
  type: string; // e.g., 'text', 'image', 'link', etc.
  data?: any;  // Additional data depending on the type
}

// Update simulateTyping to use AIResponse
const simulateTyping = (response: AIResponse, setMessage: React.Dispatch<React.SetStateAction<{ text: string; sender: string; type: string }[]>>) => {
  let index = 0;
  const typingDelay = 300; // Delay before typing starts
  const typingSpeed = 30; // Speed of typing

  setTimeout(() => {
    const interval = setInterval(() => {
      setMessage((prevMessages: { text: string; sender: string; type: string }[]) => {
        const lastMessage = prevMessages[prevMessages.length - 1];
        const newText = lastMessage.text + response.text[index];
        const updatedMessages = [...prevMessages.slice(0, -1), { ...lastMessage, text: newText }];
        return updatedMessages;
      });
      index++;
      if (index === response.text.length) {
        clearInterval(interval);
      }
    }, typingSpeed);
  }, typingDelay);
};

// New InputBox component
function InputBox({ input, setInput, handleSend }: { input: string; setInput: React.Dispatch<React.SetStateAction<string>>; handleSend: () => void }) {
  return (
    <div className="flex justify-center items-center border border-gray-300 rounded-2xl overflow-hidden w-[80%] mx-auto shadow-md">
      <input 
        type="text" 
        value={input} 
        onChange={(e) => setInput(e.target.value)} 
        onKeyPress={(e) => e.key === 'Enter' && handleSend()} 
        className="flex-1 p-3 text-black focus:outline-none"
        style={{ fontSize: '1.5rem' }}
        placeholder="Type a message..."
      />
      <button onClick={handleSend} className="p-2">
        <img src="/send.png" alt="Send" style={{ width: '24px', height: '24px' }} />
      </button>
    </div>
  );
}

export default function HomeComponent() {
  const [messages, setMessages] = useState<{ text: string; sender: string; type: string }[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    // Check if there are any stylesheets available
    if (document.styleSheets.length > 0) {
      const styleSheet = document.styleSheets[0];
      styleSheet.insertRule(styles, styleSheet.cssRules.length);
    }
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Update handleSend to use AIResponse
  const handleSend = () => {
    if (input.trim()) {
      setMessages([...messages, { text: input, sender: 'user', type: 'text' }]);
      setInput('');
      // Simulate AI response
      setTimeout(() => {
        const aiResponse: AIResponse = { text: 'This is a response from the AI agent.', type: 'text' };
        setMessages(prevMessages => [...prevMessages, { text: '', sender: 'ai', type: aiResponse.type }]);
        simulateTyping(aiResponse, setMessages);
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col h-[80vh] bg-gray-100 p-6 mb-30">
      <div className="flex items-center h-20 bg-[#18A0FB] text-white text-4xl font-bold py-2 px-4 rounded-t-lg shadow-md">
        <span className="mr-2">Diagno AI</span>
        <span style={{ width: '10px', height: '10px', backgroundColor: '#32CD32', borderRadius: '50%' }}></span>
      </div>
      <div className="flex-1 overflow-y-auto mb-4 border border-gray-300 rounded-lg p-4 shadow-md">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} my-2`}>
            {message.type === 'text' && (
              <span
                className={`inline-block p-3 rounded-lg font-medium`}
                style={{
                  backgroundColor: message.sender === 'user' ? '#18A0FB' : 'white',
                  color: message.sender === 'user' ? 'white' : 'black',
                  fontSize: '1.5rem',
                  ...(message.sender === 'ai' ? fadeInAnimation : {}),
                }}
              >
                {message.text}
              </span>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <InputBox input={input} setInput={setInput} handleSend={handleSend} />
    </div>
  );
} 