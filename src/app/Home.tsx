import React, { useState, useEffect, useRef } from 'react';
import OpenAI from "openai";

interface Coordinates {
  lat: number;
  lng: number;
}

interface Clinic {
  name: string;
  address: string;
  distance: string;
  specialization: string;
  mapsUrl?: string;
}

const getAICompletion = async (userInput: string, conversationContext: string): Promise<AIResponse> => {
  try {
    const response = await fetch('/api/getAICompletion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        input: userInput,
        context: conversationContext 
      }),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching AI completion:", error);
    return { text: 'Error fetching AI response.', type: 'text', error: String(error) };
  }
};

const getNearbyClinicsBySpecialty = async (address: string, specialty: string): Promise<Clinic[]> => {
  try {
    const response = await fetch('/api/getNearbyClinicsBySpecialty', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address, specialty }),
    });
    return await response.json();
  } catch (error) {
    console.error("Error fetching nearby clinics:", error);
    return [];
  }
};

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
  type: string;
  data?: any;
  error?: string;
  requiresLocation?: boolean;
  diagnosis?: string;
  specialty?: string;
}

// Update simulateTyping to use AIResponse
const simulateTyping = (response: AIResponse, setMessage: React.Dispatch<React.SetStateAction<{ text: string; sender: string; type: string }[]>>) => {
  if (!response.text) {
    console.error("AI response text is undefined.");
    return;
  }
  let index = 0;
  const typingDelay = 300; // Delay before typing starts
  const typingSpeed = 30; // Speed of typing

  setTimeout(() => {
    const interval = setInterval(() => {
      setMessage((prevMessages: { text: string; sender: string; type: string }[]) => {
        const lastMessage = prevMessages[prevMessages.length - 1];
        if (!lastMessage || lastMessage.sender !== 'ai') {
          console.error("Last message is not valid for typing.");
          clearInterval(interval);
          return prevMessages;
        }
        const newText = response.text.slice(0, index + 1);
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

interface Message {
  text: string;
  sender: string;
  type: string;
}

interface ConversationState {
  hasGreeted: boolean;
  symptomStage: 'initial' | 'gathering' | 'pain_rating' | 'additional_symptoms' | 'complete';
  lastQuestion?: string;
  currentSymptoms: string[];
  painRating?: number;
  diagnosisMade: boolean;
  addressRequested: boolean;
}

export default function HomeComponent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [currentDiagnosis, setCurrentDiagnosis] = useState<string>('');
  const [userAddress, setUserAddress] = useState<string>('');
  const [awaitingLocation, setAwaitingLocation] = useState(false);
  const [recommendedClinics, setRecommendedClinics] = useState<any[]>([]);
  const [conversationState, setConversationState] = useState<ConversationState>({
    hasGreeted: false,
    symptomStage: 'initial',
    currentSymptoms: [],
    diagnosisMade: false,
    addressRequested: false
  });
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

  // Initial greeting
  useEffect(() => {
    const fetchInitialGreeting = async () => {
      if (!conversationState.hasGreeted) {
        setConversationState(prev => ({ ...prev, hasGreeted: true }));
        setMessages([{ 
          text: "Hello! I'm here to help you find the right medical care for whatever you're going through. I know discussing health concerns can be difficult, so please feel comfortable sharing your main symptom or health concern with me.", 
          sender: 'ai', 
          type: 'text' 
        }]);
      }
    };
    fetchInitialGreeting();
  }, []);

  const handleSend = async () => {
    if (input.trim()) {
      try {
        const userMessage = input.trim();
        
        // Add user message
        setMessages(prevMessages => [...prevMessages, { 
          text: userMessage, 
          sender: 'user', 
          type: 'text' 
        }]);
        
        setInput('');

        // Update conversation state based on user input
        let updatedState = { ...conversationState };
        let aiResponseText = '';

        switch (updatedState.symptomStage) {
          case 'initial':
            updatedState.symptomStage = 'pain_rating';
            updatedState.currentSymptoms = [userMessage];
            aiResponseText = "I'm sorry to hear you're experiencing that. On a scale of 1-10, how would you rate the severity of your pain or discomfort?";
            break;

          case 'pain_rating':
            const painRating = parseInt(userMessage);
            if (painRating >= 1 && painRating <= 10) {
              updatedState.painRating = painRating;
              updatedState.symptomStage = 'additional_symptoms';
              aiResponseText = "Thank you for sharing. That sounds quite challenging to deal with. Are you experiencing any other symptoms or issues along with this problem?";
            } else {
              aiResponseText = "I understand it can be hard to quantify how you feel. Could you please provide a pain rating between 1 and 10 to help me better understand your situation?";
            }
            break;

          case 'additional_symptoms':
            if (!updatedState.addressRequested) {
              updatedState.addressRequested = true;
              if (userMessage.toLowerCase() !== "no") {
                updatedState.currentSymptoms.push(userMessage);
              }
              aiResponseText = "I appreciate you sharing all of that with me, and I understand this must be difficult for you. To help you find the nearest specialized clinic that can provide proper care, could you please provide your address or location?";
            } else {
              // Add a processing message first
              setMessages(prevMessages => [...prevMessages, { 
                text: "Thank you. I'm searching for clinics in your area that can help you feel better...", 
                sender: 'ai', 
                type: 'text' 
              }]);

              // Update the address in state
              const address = userMessage;
              const specialty = determineSpecialty(updatedState.currentSymptoms);
              
              // Update all states at once
              updatedState.symptomStage = 'complete';
              setConversationState(updatedState);
              setUserAddress(address);

              // Now search for clinics
              await handleClinicSearch(specialty, address);
              return;
            }
            break;
        }

        setConversationState(updatedState);

        // Add AI response
        if (aiResponseText) {
          setMessages(prevMessages => [...prevMessages, { 
            text: aiResponseText, 
            sender: 'ai', 
            type: 'text' 
          }]);
        }

      } catch (error) {
        console.error('Error in handleSend:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        setMessages(prevMessages => [...prevMessages, { 
          text: `I apologize, but I encountered an error: ${errorMessage}`, 
          sender: 'ai', 
          type: 'text' 
        }]);
      }
    }
  };

  const handleClinicSearch = async (specialty: string, address: string) => {
    try {
      // Show processing message
      setMessages(prevMessages => [...prevMessages, { 
        text: `I understand you want to feel better soon. I'm searching for ${specialty} clinics near ${address} that can provide the care you need...`, 
        sender: 'ai', 
        type: 'text' 
      }]);

      const clinics = await getNearbyClinicsBySpecialty(address, specialty);
      
      // Format and display the clinic information
      const clinicMessage = formatClinicMessage(clinics);
      setMessages(prevMessages => [...prevMessages, { 
        text: clinicMessage, 
        sender: 'ai', 
        type: 'text' 
      }]);

    } catch (error) {
      console.error('Error fetching clinics:', error);
      setMessages(prevMessages => [...prevMessages, { 
        text: `I'm truly sorry, but I encountered an error while searching for clinics: ${error instanceof Error ? error.message : 'Please try again later. Your health is important, and I want to help you find the care you need.'}`, 
        sender: 'ai', 
        type: 'text' 
      }]);
    }
  };

  // Helper function to extract symptoms from text
  const extractSymptoms = (text: string): string[] => {
    const symptoms: string[] = [];
    const symptomPatterns = [
      /(?:have|experiencing|feeling|suffering from|with)\s+([^,.!?]+(?:pain|ache|fever|cough|nausea|vomiting|diarrhea|discomfort|swelling|rash))/gi,
      /([^,.!?]+(?:pain|ache|fever|cough|nausea|vomiting|diarrhea|discomfort|swelling|rash))/gi
    ];

    symptomPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && !symptoms.includes(match[1].trim())) {
          symptoms.push(match[1].trim());
        }
      }
    });

    return symptoms;
  };

  // Helper function to format clinic messages
  const formatClinicMessage = (clinics: any[]) => {
    if (!clinics || clinics.length === 0) {
      return "I apologize, but I couldn't find any specialized clinics in your area at the moment. I understand this may be disappointing when you're not feeling well. Please consider contacting your primary care physician for guidance.";
    }

    let message = "I understand how challenging it can be to deal with health issues. I've found some medical facilities that specialize in your condition and should be able to help you feel better soon:\n\n";
    
    clinics.forEach((clinic, index) => {
      // Create a simple numbered list with clickable links
      message += `${index + 1}. [${clinic.name}](${clinic.mapsUrl})\n`;
    });

    message += "\nClick on any facility name to view it on Google Maps. I hope you're able to get the care you need and start feeling better soon.";
    return message;
  };

  // Helper function to determine specialty based on symptoms
  const determineSpecialty = (symptoms: string[]): string => {
    // More comprehensive mapping of symptoms to specialties
    // Using terms that work well with Google Places API
    const symptomMap: { [key: string]: string } = {
      // Neurological
      'headache': 'Neurologist',
      'migraine': 'Neurologist',
      'dizzy': 'Neurologist',
      'faint': 'Neurologist', 
      'seizure': 'Neurologist',
      'memory': 'Neurologist',
      
      // Orthopedic
      'back pain': 'Orthopedic doctor',
      'joint pain': 'Orthopedic doctor',
      'bone': 'Orthopedic doctor',
      'muscle': 'Orthopedic doctor',
      'sprain': 'Orthopedic doctor',
      'fracture': 'Orthopedic doctor',
      
      // Cardiology
      'chest pain': 'Cardiologist',
      'heart': 'Cardiologist',
      'palpitation': 'Cardiologist',
      'blood pressure': 'Cardiologist',
      
      // Gastroenterology
      'stomach': 'Gastroenterologist',
      'abdomen': 'Gastroenterologist',
      'digest': 'Gastroenterologist',
      'nausea': 'Gastroenterologist',
      'vomit': 'Gastroenterologist',
      'diarrhea': 'Gastroenterologist',
      
      // Dermatology
      'skin': 'Dermatologist',
      'rash': 'Dermatologist',
      'acne': 'Dermatologist',
      'itch': 'Dermatologist',
      
      // ENT
      'ear': 'ENT doctor',
      'nose': 'ENT doctor',
      'throat': 'ENT doctor',
      'hearing': 'ENT doctor',
      'voice': 'ENT doctor',
      
      // Ophthalmology
      'eye': 'Ophthalmologist',
      'vision': 'Ophthalmologist',
      'sight': 'Ophthalmologist',
      
      // Pulmonology
      'lung': 'Pulmonologist',
      'breath': 'Pulmonologist',
      'cough': 'Pulmonologist',
      'asthma': 'Pulmonologist',
      
      // Urology
      'urinate': 'Urologist',
      'bladder': 'Urologist',
      'kidney': 'Urologist',
      
      // Gynecology
      'menstrual': 'Gynecologist',
      'vaginal': 'Gynecologist',
      'pregnancy': 'Gynecologist',
      
      // Psychiatry
      'anxiety': 'Psychiatrist',
      'depression': 'Psychiatrist',
      'mood': 'Psychiatrist',
      'mental': 'Psychiatrist',
      'sleep': 'Psychiatrist'
    };

    for (const symptom of symptoms) {
      const symptomLower = symptom.toLowerCase();
      for (const [key, specialty] of Object.entries(symptomMap)) {
        if (symptomLower.includes(key)) {
          return specialty;
        }
      }
    }
    
    // If we can't determine a specialty, use a more general search term
    return 'Medical clinic';
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